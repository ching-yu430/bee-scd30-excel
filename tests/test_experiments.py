"""End-to-end checks for independent experimental periods and station pairing."""
from pathlib import Path
import csv
import io
import json
import unittest

import test_chart_editor as editor_tests


class ExperimentComparisonTests(unittest.TestCase):
    setUpClass = classmethod(editor_tests.ChartEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(editor_tests.ChartEditorTests.tearDownClass.__func__)
    tearDown = editor_tests.ChartEditorTests.tearDown
    open_home = editor_tests.ChartEditorTests.open_home
    expose = editor_tests.ChartEditorTests.expose
    fill_live = editor_tests.ChartEditorTests.fill_live

    def setUp(self):
        editor_tests.ChartEditorTests.setUp(self)
        self.page.locator('#closeStyle').click()
        self.page.locator('[data-step="1"]').click()
        self.page.locator('#experimentPurpose').select_option('different')
        self.page.locator('#hiveName').fill('第一次實驗')
        self.page.locator('#peerName').fill('第二次實驗')
        # Different schema, two non-overlapping dates, and unequal sample counts.
        self.upload('peer', '日期,時間,溫度,濕度,CO2\n'
                    '2026/09/01,08:00:00,30,70,2000\n'
                    '2026/09/01,08:30:00,32,74,2400\n'
                    '2026/09/01,09:00:00,34,78,3000\n'
                    '2026/09/02,08:00:00,36,80,4000\n', rows=4)
        for source in ['hive', 'peer']:
            if self.page.locator('#' + source + 'UseWeather').is_checked():
                self.page.locator('#' + source + 'UseWeather').uncheck()

    def upload(self, source, text, rows):
        self.page.locator('#' + source + 'File').set_input_files(
            {'name': source + '.csv', 'mimeType': 'text/csv', 'buffer': text.encode()})
        self.page.wait_for_function(f'state.{source}?.rows.length==={rows}')

    def render_profile(self, metric='co2'):
        self.page.locator('#sourceNext').click()
        self.page.locator('#overviewView').select_option('co2hour')
        self.page.locator('#overviewMetric').select_option(metric)
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("state.co2Chart!==null&&state.renderMode==='co2hour'&&!document.querySelector('#sourceNext').disabled")

    def csv_download(self):
        with self.page.expect_download() as download:
            self.page.locator('#downloadCsv').click()
        return list(csv.DictReader(io.StringIO(Path(download.value.path()).read_text(encoding='utf-8-sig'))))

    def test_different_periods_profile_and_equal_day_mean(self):
        self.render_profile()
        profiles = self.page.evaluate('state.co2Chart.data.datasets.map(d=>({source:d.sourceId,label:d.label,values:d.data}))')
        self.assertEqual(len(profiles), 2)
        self.assertEqual(profiles[0]['label'], '第一次實驗 CO₂')
        self.assertEqual(profiles[0]['values'][8], 1200)
        self.assertEqual(profiles[1]['values'][8], 2800)
        self.assertIsNone(profiles[1]['values'][0])
        self.assertFalse(self.page.locator('#commonPeriod').is_visible())
        self.assertFalse(self.page.locator('#hiveOriginConfirmed').is_visible())
        rows = self.csv_download()
        second = next(row for row in rows if row['資料來源'] == '第二次實驗' and row['時段'] == '08:00')
        self.assertEqual(second['平均值'], '2800')
        self.assertEqual(second['有效天數'], '2')
        self.assertEqual(second['樣本數'], '3')
        self.assertIn('2026-09-01', second['分析開始'])
        self.page.locator('#profileMethod').select_option('days')
        self.page.wait_for_function('state.co2Chart.data.datasets[1].data[8]===3100')
        rows = self.csv_download()
        self.assertEqual(next(row['平均值'] for row in rows if row['資料來源'] == '第二次實驗' and row['時段'] == '08:00'), '3100')
        self.page.locator('#overviewMetric').select_option('temp')
        self.page.wait_for_function("state.co2Chart.data.datasets.every(d=>d.metricKey==='temp')")
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets[1].data[8]'), 33.5)
        self.page.locator('#openStyle').click()
        self.fill_live('#peerName-temp', '第二次溫度', "state.co2Chart.data.datasets[1].label==='第二次溫度'")
        with self.page.expect_download() as download:
            self.page.locator('#panelDownloadCurrent').click()
        self.assertTrue(Path(download.value.path()).read_bytes().startswith(b'\x89PNG'))
        self.page.locator('#closeStyle').click()
        self.page.locator('#overviewView').select_option('continuous')
        self.page.wait_for_function("workspaceStage===2&&document.querySelector('#workflowStatus').textContent.includes('第 1 天')")
        self.page.locator('#hiveOriginConfirmed').check()
        self.page.locator('#peerOriginConfirmed').check()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("state.renderMode==='continuous'&&isRelativeComparison()")

    def test_elapsed_axis_requires_confirmed_origins_and_keeps_real_dates(self):
        self.page.locator('#sourceNext').click()
        self.page.locator('#aggregation').select_option('hour')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("document.querySelector('#workflowStatus').textContent.includes('第 1 天')")
        self.assertEqual(self.page.evaluate('workspaceStage'), 2)
        self.page.locator('#hiveOriginConfirmed').check()
        self.page.locator('#peerOriginConfirmed').check()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("state.renderMode==='continuous'&&isRelativeComparison()&&!document.querySelector('#sourceNext').disabled")
        points = self.page.evaluate("state.charts.find(c=>c.data.datasets[0].metricKey==='co2').data.datasets.map(d=>d.data.filter(p=>p.y!==null))")
        self.assertEqual(points[0][0]['x'], 8 * 3600000)
        self.assertEqual(points[1][0]['x'], 8 * 3600000)
        self.assertNotEqual(points[0][0]['originalTime'], points[1][0]['originalTime'])
        rows = self.csv_download()
        second = next(row for row in rows if row['資料來源'] == '第二次實驗' and row['指標'] == 'CO₂')
        self.assertIn('2026-09-01', second['實際時間'])
        self.assertAlmostEqual(float(second['實驗天數']), 1 + 8 / 24)
        self.page.locator('[data-step="2"]').click()
        self.page.locator('#peerPeriodStart').fill('2026-09-02T00:00')
        self.page.locator('#peerPeriodStart').press('Tab')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("state.output.filter(r=>r.source==='peer'&&r.key==='co2').length===1")
        self.assertEqual(self.page.evaluate("state.output.find(r=>r.source==='peer'&&r.key==='co2').value"), 4000)

    def test_each_station_uses_its_parent_experiment_period(self):
        self.page.locator('#hiveUseWeather').check()
        self.page.locator('#peerUseWeather').check()
        self.upload('weatherPeer', 'timestamp,temperature,humidity,precipitation\n'
                    '2026-07-01 08:00:00,99,99,99\n'
                    '2026-09-01 08:00:00,20,50,1\n'
                    '2026-09-02 08:00:00,22,60,2\n', rows=3)
        self.render_profile('humidity')
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.length'), 4)
        station = self.page.evaluate("state.co2Chart.data.datasets.find(d=>d.sourceId==='weatherPeer').data[8]")
        self.assertEqual(station, 55)
        self.assertEqual(self.page.evaluate("state.output.filter(r=>r.source==='weatherPeer'&&r.key==='temp').map(r=>r.value)"), [20, 22])
        rows = self.csv_download()
        station_row = next(row for row in rows if row['資料來源'] == '第二次實驗 氣象站' and row['時段'] == '08:00')
        self.assertEqual(station_row['有效天數'], '2')
        self.assertEqual(station_row['平均值'], '55')
        self.assertIn('2026-09', station_row['分析開始'])
        # The new station is also independently queryable and can form a subset.
        self.page.locator('#queryTab').click()
        self.page.locator('#querySource').select_option('weatherPeer')
        self.page.locator('#runQuery').click()
        self.page.wait_for_function('queryRows.length===3')
        self.page.locator('#plotQueryResults').click()
        self.page.wait_for_function("state.querySubset?.weatherPeer.size===3&&state.output.some(r=>r.source==='weatherPeer')")

    def test_anomaly_day_drilldown_and_return_preserve_overview(self):
        self.render_profile()
        self.page.locator('#openExperimentAnomalies').click()
        self.page.locator('#anomalySource').select_option('both')
        self.page.locator('#anomalyHigh-co2').fill('3500')
        self.page.locator('#scanAnomalies').click()
        self.page.wait_for_function("anomalyActive&&anomalyEvents.some(e=>e.source==='peer')")
        self.page.locator('#plotTab').click()
        before = self.page.evaluate("({purpose:value('experimentPurpose'),mode:value('chartMode'),a:value('hivePeriodStart'),b:value('peerPeriodStart')})")
        self.page.locator('#experimentAnomalyDays button').filter(has_text='第二次實驗').click()
        self.page.wait_for_function("state.experimentDetail?.source==='peer'&&state.renderMode==='continuous'")
        self.assertFalse(self.page.evaluate('isRelativeComparison()'))
        self.assertEqual(self.page.evaluate('activePlotSources()'), ['peer'])
        self.assertEqual(self.page.evaluate("value('startDate').slice(0,10)"), '2026-09-02')
        self.assertEqual(self.page.evaluate("value('endDate').slice(0,10)"), '2026-09-02')
        self.page.locator('#returnExperimentOverview').click()
        self.page.wait_for_function("!state.experimentDetail&&state.renderMode==='co2hour'")
        self.assertEqual(self.page.evaluate("({purpose:value('experimentPurpose'),mode:value('chartMode'),a:value('hivePeriodStart'),b:value('peerPeriodStart')})"), before)
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.length'), 2)

    def test_experiment_settings_round_trip_and_safe_names(self):
        self.page.locator('#hiveName').fill('A <b>實驗</b>')
        self.page.locator('#hiveName').press('Tab')
        self.render_profile()
        self.page.locator('#profileMethod').select_option('days')
        self.page.locator('#openStyle').click()
        with self.page.expect_download() as download:
            self.expose('#saveSettings').click()
        saved = Path(download.value.path()).read_bytes()
        config = json.loads(saved)
        self.assertTrue(config['settings']['peerPeriodStart'].startswith('2026-09-01T08:00'))
        self.assertEqual(config['settings']['hiveName'], 'A <b>實驗</b>')
        self.page.locator('#loadSettings').set_input_files({'name': 'experiment.json', 'mimeType': 'application/json', 'buffer': saved})
        self.page.wait_for_function("state.co2Chart?.data.datasets[1].data[8]===3100")
        self.assertEqual(self.page.evaluate("value('experimentPurpose')"), 'different')
        self.assertEqual(self.page.locator('#experimentContext b').count(), 0)
        self.assertEqual(self.page.locator('#timePreview b').count(), 0)
        self.page.locator('#resultPeriodDetails').evaluate('el=>el.open=true')
        self.assertIn('A <b>實驗</b>', self.page.locator('#experimentContext').inner_text())

    def test_mobile_import_and_profile_do_not_overflow(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.assertTrue(self.page.locator('#experimentPurpose').is_visible())
        self.assertTrue(self.page.locator('#hiveName').is_visible())
        self.assertTrue(self.page.locator('#peerName').is_visible())
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
        self.render_profile()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
        self.page.locator('#openStyle').click()
        self.fill_live('#innerName-co2', '手機實驗比較', "state.co2Chart.data.datasets[0].label==='手機實驗比較'")
        with self.page.expect_download() as download:
            self.page.locator('#panelDownloadCurrent').click()
        self.assertGreater(Path(download.value.path()).stat().st_size, 1000)

    def test_excel_and_csv_can_be_compared_as_separate_experiments(self):
        data = self.page.evaluate("""() => {
            const sheet=XLSX.utils.aoa_to_sheet([
                ['日期','時間','溫度','濕度','CO₂'],
                [new Date(2026,9,5),'08:00:00',28,65,2100],
                [new Date(2026,9,6),'08:00:00',30,68,2300]
            ]);
            const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'實驗');
            return Array.from(new Uint8Array(XLSX.write(book,{type:'array',bookType:'xlsx'})));
        }""")
        self.page.locator('#peerFile').set_input_files({'name': 'second.xlsx', 'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'buffer': bytes(data)})
        self.page.wait_for_function('state.peer.rows.length===2')
        self.render_profile()
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets[1].data[8]'), 2200)
        self.assertTrue(self.page.locator('#peerPeriodStart').input_value().startswith('2026-10-05'))

    def test_ambiguous_dates_can_be_corrected_for_one_experiment(self):
        self.upload('peer', 'Date,Clock,Temperature,RH,CO2\n'
                    '01/09/2026,08:00:00,32,70,2500\n'
                    '02/09/2026,08:00:00,34,72,3500\n', rows=0)
        self.assertIn('尚無有效時間', self.page.locator('#peerDataSummary').inner_text())
        self.expose('#peerFileMappings select[aria-label$="日期格式"]').select_option('dmy')
        self.expose('#peerFileMappings select[aria-label$="獨立時間欄（選填）"]').select_option('Clock')
        self.page.wait_for_function('state.peer.rows.length===2')
        self.render_profile()
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets[1].data[8]'), 3000)
        self.assertTrue(self.page.locator('#peerPeriodStart').input_value().startswith('2026-09-01T08:00'))

    def test_station_purpose_shows_one_experiment_without_losing_other_data(self):
        self.page.locator('#experimentPurpose').select_option('weather')
        self.assertFalse(self.page.locator('#peerExperimentCard').is_visible())
        self.assertTrue(self.page.locator('#hiveStationFiles').is_visible())
        self.render_profile('humidity')
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.map(d=>d.sourceId)'), ['hive', 'weather'])
        self.assertEqual(self.page.evaluate('state.peer.rows.length'), 4)


if __name__ == '__main__':
    unittest.main()
