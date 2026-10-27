"""Both paired station uploaders must support the same complete workflow."""
from pathlib import Path
import csv
import io
import unittest

import test_chart_editor as editor_tests


class StationImportTests(unittest.TestCase):
    setUpClass = classmethod(editor_tests.ChartEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(editor_tests.ChartEditorTests.tearDownClass.__func__)
    setUp = editor_tests.ChartEditorTests.open_home
    tearDown = editor_tests.ChartEditorTests.tearDown
    expose = editor_tests.ChartEditorTests.expose

    def choose_comparison(self):
        self.page.locator('#chooseComparisonMode').click()
        for source in ['hive', 'peer']:
            self.page.locator('#'+source+'UseWeather').check()

    def file(self, name, day, hour, temperature, rain):
        rows=f'timestamp,temperature,humidity,co2,precipitation,alternateRain\n{day} {hour:02d}:00:00,{temperature},65,800,{rain},{rain+10}\n'
        return {'name':name,'mimeType':'text/csv','buffer':rows.encode()}

    def test_both_station_uploaders_open_from_keyboard_and_merge_multiple_files(self):
        self.choose_comparison()
        for source, key in [('weather','Enter'),('weatherPeer','Space')]:
            button=self.page.locator('#'+source+'File').locator('..')
            with self.page.expect_file_chooser() as chooser:
                button.press(key)
            self.assertTrue(chooser.value.is_multiple)
            chooser.value.set_files([self.file('first.csv','2026-07-01',8,20,1),self.file('second.csv','2026-07-01',9,22,3)])
            self.page.wait_for_function(f'state.{source}?.rows.length===2')
            self.assertIn('2 筆資料',self.page.locator('#'+source+'Status').inner_text())
            self.assertEqual(self.page.locator('#'+source+'Status').get_attribute('role'),'status')
            self.assertEqual(self.page.locator('#'+source+'File').get_attribute('accept'),'.csv,.xlsx,.xls')
            self.assertEqual(self.page.evaluate(f"state.{source}.mapping.rain"),'precipitation')
            self.expose(f'[data-source="{source}"][data-key="rain"]').select_option('alternateRain')
            self.assertEqual(self.page.evaluate(f"state.{source}.mapping.rain"),'alternateRain')

    def test_each_station_rainfall_uses_its_files_period_and_editable_mapping(self):
        self.choose_comparison()
        for source, day in [('hive','2026-07-01'),('peer','2026-09-01')]:
            data=f'timestamp,temperature,humidity,co2\n{day} 08:00:00,25,60,1000\n{day} 09:00:00,26,62,1200\n'
            self.page.locator('#'+source+'File').set_input_files({'name':source+'.csv','mimeType':'text/csv','buffer':data.encode()})
            self.page.wait_for_function(f'state.{source}?.rows.length===2')
        for source,day in [('weather','2026-07-01'),('weatherPeer','2026-09-01')]:
            self.page.locator('#'+source+'File').set_input_files([self.file('first.csv',day,8,20,1),self.file('second.csv',day,9,22,3)])
            self.page.wait_for_function(f'state.{source}?.rows.length===2')
        self.expose('[data-source="weatherPeer"][data-key="rain"]').select_option('alternateRain')
        self.page.locator('#sourceNext').click()
        self.page.locator('#overviewView').select_option('rainfall')
        self.page.locator('#aggregation').select_option('hour')
        self.page.locator('#rainStation').select_option('weatherPeer')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("state.renderMode==='rainfall'&&!state.dirty")
        self.assertEqual(self.page.evaluate('state.rainOutput.map(r=>r.value)'),[11,13])
        self.page.locator('#resultModeOptions').evaluate('el=>el.open=true')
        self.page.locator('#rainStation').select_option('weather')
        self.page.wait_for_function('state.rainOutput[0]?.value===1')
        self.assertEqual(self.page.evaluate('state.rainOutput.map(r=>r.value)'),[1,3])
        with self.page.expect_download() as downloaded:
            self.page.locator('#downloadCsv').click()
        rows=list(csv.DictReader(io.StringIO(Path(downloaded.value.path()).read_text(encoding='utf-8-sig'))))
        rain=[r for r in rows if r['指標']=='降水量（mm）']
        self.assertEqual([r['數值'] for r in rain],['1','3'])
        self.assertTrue(all('2026-07-01' in r['時間'] for r in rain))

    def test_failed_station_upload_keeps_previous_dataset_for_both_sides(self):
        self.choose_comparison()
        for source in ['weather','weatherPeer']:
            self.page.locator('#'+source+'File').set_input_files(self.file('valid.csv','2026-07-01',8,20,1))
            self.page.wait_for_function(f'state.{source}?.rows.length===1')
            self.page.evaluate(f'window.previousStation=state.{source}')
            self.page.locator('#'+source+'File').set_input_files({'name':'broken.csv','mimeType':'text/csv','buffer':b'"unterminated'})
            self.page.wait_for_function(f'document.querySelector("#{source}Status").textContent.includes("無法讀取")')
            self.assertTrue(self.page.evaluate(f'state.{source}===window.previousStation'))

    def test_right_station_can_be_imported_first_mapped_queried_and_exported(self):
        self.choose_comparison()
        self.page.locator('#weatherPeerFile').set_input_files(self.file('only-b.csv','2026-07-01',8,20,1))
        self.page.wait_for_function("document.querySelector('#weatherPeerStatus').textContent.includes('已載入')")
        self.assertEqual(self.page.locator('[data-source="weatherPeer"][data-key="time"]').count(),1)
        self.expose('[data-source="weatherPeer"][data-key="rain"]').select_option('alternateRain')
        self.assertEqual(self.page.evaluate('state.weatherPeer.mapping.rain'),'alternateRain')
        self.page.locator('#queryTab').click()
        self.page.locator('#querySource').select_option('weatherPeer')
        self.page.locator('#queryOp').select_option('none')
        self.page.locator('#runQuery').click()
        self.page.wait_for_function('queryRows.length===1')
        self.page.locator('#openStyle').click()
        with self.page.expect_download() as downloaded:
            self.page.locator('#exportQuery').click()
        rows=list(csv.DictReader(io.StringIO(Path(downloaded.value.path()).read_text(encoding='utf-8-sig'))))
        self.assertEqual(rows[0]['溫度（°C）'],'20')
        self.page.locator('#closeStyle').click()
        self.page.locator('#plotQueryResults').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty&&state.output.length>0')
        self.assertEqual(self.page.evaluate('activePlotSources()'),['weatherPeer'])
        with self.page.expect_download() as downloaded:
            self.page.locator('#downloadCurrentPng').click()
        self.assertTrue(Path(downloaded.value.path()).read_bytes().startswith(b'\x89PNG'))
