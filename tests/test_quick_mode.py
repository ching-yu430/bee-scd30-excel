"""Novice single-dataset flow and the fixed, keyboard-accessible settings panel."""
from pathlib import Path
import csv
import io
import json
import unittest

import test_chart_editor as editor_tests


class QuickModeTests(unittest.TestCase):
    setUpClass = classmethod(editor_tests.ChartEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(editor_tests.ChartEditorTests.tearDownClass.__func__)
    setUp = editor_tests.ChartEditorTests.open_home
    tearDown = editor_tests.ChartEditorTests.tearDown
    expose = editor_tests.ChartEditorTests.expose
    fill_live = editor_tests.ChartEditorTests.fill_live

    def upload(self, source='hive', text=None):
        text = text or ('timestamp,temperature,humidity,co2\n'
                        '2026-07-01 08:00:00,25,60,1000\n'
                        '2026-07-01 08:30:00,27,64,1400\n'
                        '2026-07-02 08:00:00,30,70,2400\n')
        self.page.locator('#' + source + 'File').set_input_files(
            {'name': source + '.csv', 'mimeType': 'text/csv', 'buffer': text.encode()})
        self.page.wait_for_function(f'state.{source}?.rows.length>0')

    def render_quick(self, mode='continuous'):
        self.page.locator('#sourceNext').click()
        self.page.locator('#overviewView').select_option(mode)
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty&&!document.querySelector("#sourceNext").disabled')

    def download_csv(self):
        with self.page.expect_download() as download:
            self.page.locator('#downloadCsv').click()
        return list(csv.DictReader(io.StringIO(Path(download.value.path()).read_text(encoding='utf-8-sig'))))

    def test_single_upload_to_trend_profile_rename_and_download(self):
        self.assertEqual(self.page.locator('#chooseQuickMode').get_attribute('aria-pressed'), 'true')
        self.assertFalse(self.page.locator('#peerFile').is_visible())
        self.assertFalse(self.page.locator('#experimentPurpose').is_visible())
        self.upload()
        self.render_quick()
        self.assertEqual(self.page.evaluate('activePlotSources()'), ['hive'])
        self.assertFalse(self.page.evaluate('isRelativeComparison()'))
        self.assertEqual(self.page.evaluate('state.charts[2].data.datasets[0].data.map(p=>p.y).filter(v=>v!==null)'), [1200, 2400])
        self.page.locator('#overviewView').select_option('co2hour')
        self.page.wait_for_function('state.co2Chart?.data.datasets[0].data[8]===1600')
        self.assertEqual(self.page.evaluate('workspaceStage'), 3)
        self.page.locator('#openStyle').click()
        self.fill_live('#innerName-co2', '我的 CO₂', "state.co2Chart.data.datasets[0].label==='我的 CO₂'")
        with self.page.expect_download() as download:
            self.page.locator('#panelDownloadCurrent').click()
        self.assertTrue(Path(download.value.path()).read_bytes().startswith(b'\x89PNG'))
        self.page.locator('#closeStyle').click()
        rows = self.download_csv()
        hour = next(row for row in rows if row['時段'] == '08:00')
        self.assertEqual(hour['平均值'], '1600')
        self.assertEqual(hour['有效天數'], '2')

    def test_temperature_only_dataset_and_optional_period(self):
        self.upload(text='日期,溫度\n2026-07-01 08:00:00,25\n2026-07-02 08:00:00,30\n')
        self.page.locator('#sourceNext').click()
        self.assertEqual(self.page.locator('#overviewMetric').input_value(), 'temp')
        self.assertTrue(self.page.locator('#overviewMetric option[value=co2]').evaluate('option=>option.disabled'))
        self.expose('#startDate').fill('2026-07-02T00:00')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.assertEqual(self.page.evaluate('state.output.map(row=>row.value)'), [30])
        self.assertEqual(self.page.evaluate('currentSettingsChart().data.datasets[0].metricKey'), 'temp')
        self.page.locator('[data-step="2"]').click()
        self.expose('#quickPeriod button:not(#singleDay)').click()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.assertEqual(self.page.evaluate('state.output.map(row=>row.value)'), [25, 30])

    def test_modes_keep_imports_and_independent_analysis_drafts(self):
        self.page.locator('#chooseComparisonMode').click()
        self.upload()
        self.upload('peer', 'timestamp,temperature,humidity,co2\n2026-09-01 08:00:00,35,80,3200\n')
        self.page.locator('#sourceNext').click()
        self.page.locator('#overviewView').select_option('co2hour')
        self.page.locator('#hivePeriodStart').fill('2026-07-02T00:00')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('state.co2Chart?.data.datasets.length===2')
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.map(d=>d.data[8])'), [2400, 3200])
        self.page.locator('[data-step="1"]').click()
        self.page.locator('#chooseQuickMode').click()
        self.render_quick('co2hour')
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.map(d=>d.data[8])'), [1600])
        self.assertEqual(self.page.evaluate('state.peer.rows.length'), 1)
        self.page.locator('[data-step="1"]').click()
        self.page.locator('#chooseComparisonMode').click()
        self.page.locator('#sourceNext').click()
        self.assertEqual(self.page.locator('#hivePeriodStart').input_value(), '2026-07-02T00:00')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('state.co2Chart?.data.datasets.length===2')
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.map(d=>d.data[8])'), [2400, 3200])

    def test_quick_settings_round_trip_and_incomplete_columns_are_actionable(self):
        self.upload(text='timestamp,Measurement\n2026-07-01 08:00:00,1000\n')
        self.page.locator('#sourceNext').click()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('!document.querySelector("#sourceNext").disabled')
        self.assertEqual(self.page.evaluate('workspaceStage'), 2)
        self.assertIn('欄位配對', self.page.locator('#workflowStatus').inner_text())
        self.page.locator('[data-step="1"]').click()
        self.expose('#hiveFileMappings .mapping-time-fields label:nth-child(5) select').select_option('Measurement')
        self.render_quick('co2hour')
        self.page.locator('#openStyle').click()
        with self.page.expect_download() as download:
            self.expose('#saveSettings').click()
        saved = Path(download.value.path()).read_bytes()
        self.assertEqual(json.loads(saved)['settings']['workspaceMode'], 'quick')
        self.page.locator('#closeStyle').click()
        self.page.locator('[data-step="1"]').click()
        self.page.locator('#chooseComparisonMode').click()
        self.expose('#loadSettings').set_input_files({'name': 'quick.json', 'mimeType': 'application/json', 'buffer': saved})
        self.page.wait_for_function('isQuickMode()&&state.co2Chart?.data.datasets[0].data[8]===1000')
        self.assertEqual(self.page.evaluate('requestedSources()'), ['hive'])

    def test_settings_tabs_keep_actions_visible_and_remember_scroll_on_mobile(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.upload()
        self.render_quick()
        self.page.locator('#openStyle').click()
        self.assertEqual(self.page.locator('#openStyle').text_content(), '圖表設定')
        for index in [0, 1, 2, 3]:
            self.page.locator('#settingsTab-' + str(index)).click()
            self.assertEqual(self.page.locator('#settingsTabs [aria-selected=true]').count(), 1)
            self.page.locator('#settingsScroll').evaluate('el=>el.scrollTop=el.scrollHeight')
            for selector in ['#settingsTabs', '#applyFormat', '#panelDownloadCurrent', '#closeStyle']:
                box = self.page.locator(selector).bounding_box()
                self.assertGreaterEqual(box['y'], 0)
                self.assertLessEqual(box['y'] + box['height'], 845)
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.page.locator('#settingsTab-2').click()
        self.page.locator('#settingsScroll').evaluate('el=>el.scrollTop=200')
        self.page.locator('#settingsTab-1').click()
        self.page.locator('#settingsTab-2').click()
        self.assertAlmostEqual(self.page.locator('#settingsScroll').evaluate('el=>el.scrollTop'), 200, delta=2)
        self.page.locator('#settingsTab-2').press('Home')
        self.assertEqual(self.page.locator('#settingsTab-0').get_attribute('aria-selected'), 'true')
        self.page.locator('#settingsTab-0').press('ArrowRight')
        self.assertTrue(self.page.locator('#showMax').is_visible())
        self.expose('#showMax').check()
        self.page.wait_for_function('state.charts[2].$researchOptions.showMax')
        self.page.locator('#settingsTab-1').press('End')
        self.assertTrue(self.page.locator('#saveSettings').is_visible())
        with self.page.expect_download() as download:
            self.page.locator('#panelDownloadCurrent').click()
        self.assertTrue(Path(download.value.path()).read_bytes().startswith(b'\x89PNG'))
