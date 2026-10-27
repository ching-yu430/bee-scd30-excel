"""Task-based checks for recoverable results, source actions, and feedback."""
from pathlib import Path
import json
import unittest

import test_chart_editor as editor_tests
import test_result_tools as result_tests


class UsabilityTests(unittest.TestCase):
    setUpClass = classmethod(editor_tests.ChartEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(editor_tests.ChartEditorTests.tearDownClass.__func__)
    setUp = result_tests.ResultToolsTests.setUp
    open_home = editor_tests.ChartEditorTests.open_home
    tearDown = editor_tests.ChartEditorTests.tearDown
    expose = editor_tests.ChartEditorTests.expose

    def test_group_show_restores_hidden_series_and_preserves_other_sources(self):
        original=self.page.evaluate('currentCsv()')
        self.page.locator('.line-legend button:visible').filter(has_text='九月實驗 CO₂').click()
        self.page.locator('#sourceShown-weather').uncheck()
        self.page.locator('#sourceShown-peer').uncheck()
        self.page.locator('#sourceShown-peer').check()
        self.assertTrue(self.page.evaluate('state.co2Chart.isDatasetVisible(1)'))
        self.assertFalse(self.page.evaluate('state.co2Chart.isDatasetVisible(2)'))
        self.assertEqual(self.page.evaluate('currentCsv()'),original)
        self.page.locator('.line-legend button:visible').filter(has_text='九月實驗 CO₂').click()
        self.page.locator('#overviewView').select_option('daily')
        self.page.wait_for_function("state.renderMode==='daily'&&!state.dirty")
        self.page.locator('#sourceShown-peer').uncheck();self.page.locator('#sourceShown-peer').check()
        self.assertTrue(self.page.evaluate("state.charts.every(c=>c.data.datasets.every((ds,i)=>ds.sourceId!=='peer'||c.isDatasetVisible(i)))"))
        self.page.locator('#overviewView').select_option('co2hour')
        self.page.wait_for_function('Boolean(state.co2Chart)&&!state.dirty')
        self.assertTrue(self.page.evaluate('state.co2Chart.isDatasetVisible(1)'))
        self.assertFalse(self.page.evaluate('state.co2Chart.isDatasetVisible(2)'))

    def test_latest_station_import_wins_and_stale_completion_preserves_new_annotations(self):
        for source in ['weather','weatherPeer']:
            with self.subTest(source=source):
                observed=self.page.evaluate('''async source=>{
                    const before=read;let release;const paused=new Promise(resolve=>release=resolve);
                    read=async file=>{if(file.name==='slow.csv')await paused;return [{timestamp:'2026-07-01 08:00:00',temperature:file.name==='slow.csv'?10:30,humidity:60,co2:800}]};
                    try{
                        const slow=load([{name:'slow.csv'}],source);await load([{name:'latest.csv'}],source);
                        comparisonRanges.push({scope:state.co2Chart.$rangeScope,domain:'hours',x1:9,x2:10,yAxis:null,y1:null,y2:null,label:'新資料標記',color:'#b7791f',opacity:.12});
                        release();await slow;
                        return {temperature:state[source].rows[0].temperature,ranges:comparisonRanges.map(r=>r.label),status:document.getElementById(source+'Status').textContent};
                    }finally{read=before}
                }''',source)
                self.assertEqual(observed['temperature'],30)
                self.assertEqual(observed['ranges'],['新資料標記'])
                self.assertIn('已載入',observed['status'])

    def test_latest_failed_import_retains_data_and_ignores_older_success(self):
        observed=self.page.evaluate('''async()=>{
            const original=state.weatherPeer,before=read;let release;
            const paused=new Promise(resolve=>release=resolve);
            read=async file=>{if(file.name==='slow.csv'){await paused;return [{timestamp:'2026-07-01 08:00:00',temperature:10,humidity:60,co2:800}]};throw Error('讀取失敗測試')};
            try{const slow=load([{name:'slow.csv'}],'weatherPeer');await load([{name:'invalid.csv'}],'weatherPeer');release();await slow;return {retained:state.weatherPeer===original,status:document.querySelector('#weatherPeerStatus').textContent}}finally{read=before}
        }''')
        self.assertTrue(observed['retained'])
        self.assertIn('讀取失敗測試',observed['status'])

    def test_same_file_can_be_selected_again_after_success_and_failure(self):
        self.page.locator('[data-step="1"]').click()
        for source in ['hive','peer','weather','weatherPeer']:
            with self.subTest(source=source):
                rows=b'timestamp,temperature,humidity,co2\n2026-07-01 08:00:00,20,60,800\n'
                file={'name':'repeat.csv','mimeType':'text/csv','buffer':rows}
                field=self.page.locator('#'+source+'File')
                field.set_input_files(file)
                self.page.wait_for_function(f'state.{source}?.rows.length===1&&document.querySelector("#{source}File").value===""')
                field.set_input_files({'name':'repeat.csv','mimeType':'text/csv','buffer':rows.replace(b',800',b',900')})
                self.page.wait_for_function(f'document.querySelector("#{source}File").value===""')
                self.assertEqual(self.page.evaluate(f"Number(state.{source}.rows[0][state.{source}.mapping.co2])"),900)
                field.set_input_files({'name':'invalid.csv','mimeType':'text/csv','buffer':b'"unterminated'})
                self.page.wait_for_function(f'document.querySelector("#{source}File").value===""')
                self.assertIn('無法讀取' if source.startswith('weather') else '匯入失敗',self.page.locator('#'+source+'Status').inner_text())

    def test_empty_results_disable_downloads_and_offer_direct_recovery(self):
        self.page.locator('[data-step="2"]').click()
        for source in ['hive','peer']:
            self.page.locator('#'+source+'PeriodStart').fill('2027-01-01T00:00')
            self.page.locator('#'+source+'PeriodEnd').fill('2027-01-02T00:00')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!currentSettingsChart()')
        self.assertTrue(self.page.locator('#resultEmpty').is_visible())
        self.assertFalse(self.page.locator('#resultsTools').is_visible())
        for selector in ['#downloadCurrentPng','#downloadCsv','#panelDownloadCurrent','#panelDownloadCsv']:
            self.assertTrue(self.page.locator(selector).is_disabled())
        self.page.locator('#adjustEmptyResults').click()
        self.assertEqual(self.page.evaluate('workspaceStage'),2)
        self.page.locator('#hiveFullRange').click();self.page.locator('#peerFullRange').click()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty&&Boolean(state.co2Chart)')
        self.assertFalse(self.page.locator('#resultEmpty').is_visible())
        self.assertFalse(self.page.locator('#downloadCsv').is_disabled())
        with self.page.expect_download() as downloaded:self.page.locator('#downloadCsv').click()
        self.assertGreater(Path(downloaded.value.path()).stat().st_size,100)

    def test_settings_import_errors_are_visible_and_leave_settings_intact(self):
        self.page.locator('#openStyle').click()
        original=self.page.evaluate('JSON.stringify(snapshotSettings())')
        field=self.expose('#loadSettings')
        field.set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"settings":'})
        self.page.wait_for_function('document.querySelector("#styleStatus").classList.contains("has-error")')
        self.assertTrue(self.page.locator('#styleStatus').is_visible())
        self.assertIn('無法載入設定',self.page.locator('#styleStatus').inner_text())
        self.assertEqual(self.page.evaluate('JSON.stringify(snapshotSettings())'),original)
        self.assertEqual(field.input_value(),'')

    def test_more_menu_closes_on_escape_and_outside_press(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('#resultDownloads > summary').click()
        self.assertTrue(self.page.locator('#imageOptions').is_visible())
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('#resultDownloads').evaluate('el=>el.open'))
        self.assertEqual(self.page.evaluate('document.activeElement.closest("#resultDownloads")?.id'),'resultDownloads')
        self.page.locator('#resultDownloads > summary').click()
        self.page.locator('.chart-heading h2').click()
        self.assertFalse(self.page.locator('#resultDownloads').evaluate('el=>el.open'))

    def test_download_names_identify_chart_and_analysis_instead_of_old_release(self):
        self.page.locator('#openStyle').click()
        self.expose('#chartTitle').fill('試驗 / 圖表：比較?')
        self.page.locator('#closeStyle').click()
        with self.page.expect_download() as downloaded:self.page.locator('#downloadCurrentPng').click()
        png=downloaded.value
        self.assertTrue(Path(png.path()).read_bytes().startswith(b'\x89PNG'))
        self.assertIn('試驗',png.suggested_filename)
        self.assertIn('七月實驗',png.suggested_filename)
        self.assertIn('2026-07-01',png.suggested_filename)
        self.assertNotRegex(png.suggested_filename,r'[<>:"/\\|?*]')
        with self.page.expect_download() as downloaded:self.page.locator('#downloadCsv').click()
        self.assertIn('試驗',downloaded.value.suggested_filename)
        self.page.locator('#openStyle').click()
        with self.page.expect_download() as downloaded:self.expose('#saveSettings').click()
        self.assertIn('分析設定',downloaded.value.suggested_filename)
        self.assertEqual(json.loads(Path(downloaded.value.path()).read_text())['version'],23)
