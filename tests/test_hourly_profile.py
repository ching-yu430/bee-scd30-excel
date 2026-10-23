"""Hourly ordering, weighted means and exports through the visible UI."""
from pathlib import Path
import json
import unittest

import test_chart_editor as editor_tests
import test_quick_mode as quick_tests


class HourlyProfileTests(unittest.TestCase):
    setUpClass = classmethod(editor_tests.ChartEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(editor_tests.ChartEditorTests.tearDownClass.__func__)
    setUp = editor_tests.ChartEditorTests.open_home
    tearDown = editor_tests.ChartEditorTests.tearDown
    expose = editor_tests.ChartEditorTests.expose
    upload = quick_tests.QuickModeTests.upload
    render_quick = quick_tests.QuickModeTests.render_quick
    download_csv = quick_tests.QuickModeTests.download_csv

    def test_start_hour_is_available_before_and_after_plot_in_both_modes(self):
        self.upload()
        self.page.locator('#sourceNext').click()
        self.page.locator('#overviewView').select_option('co2hour')
        self.assertTrue(self.page.locator('#diurnalStart').is_visible())
        self.page.locator('#diurnalStart').select_option('9')
        self.assertEqual(self.page.evaluate('state.co2Chart'), None)
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("state.co2Chart?.data.labels[0]==='09:00'")
        self.assertTrue(self.page.locator('#diurnalStart').is_visible())
        self.assertEqual(self.page.evaluate('state.co2Chart.data.labels.at(-1)'), '08:00')
        self.page.locator('[data-step="1"]').click()
        self.page.locator('#chooseComparisonMode').click()
        self.upload('peer', 'timestamp,temperature,humidity,co2\n2026-09-01 08:00:00,35,80,3200\n')
        self.page.locator('#sourceNext').click()
        self.page.locator('#overviewView').select_option('co2hour')
        self.assertTrue(self.page.locator('#diurnalStart').is_visible())
        self.page.locator('#diurnalStart').select_option('9')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("state.co2Chart?.data.labels[0]==='09:00'&&state.co2Chart.data.datasets.length===2")
        self.page.locator('#diurnalStart').select_option('23')
        self.page.wait_for_function("state.co2Chart.data.labels[0]==='23:00'")
        self.assertEqual(self.page.evaluate('state.co2Chart.data.labels.at(-1)'), '22:00')

    def test_all_start_hours_keep_means_annotations_and_csv_in_sync(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.upload()
        self.render_quick('co2hour')
        original = self.page.evaluate('JSON.stringify(state.output)')
        self.page.evaluate('togglePoint(state.co2Chart,state.co2Chart.data.datasets[0],8)')
        for hour in range(24):
            self.page.locator('#diurnalStart').select_option(str(hour))
            self.page.wait_for_function('state.co2Chart.data.labels[0]===' + json.dumps(f'{hour:02d}:00'))
            chart = self.page.evaluate('({labels:state.co2Chart.data.labels,data:state.co2Chart.data.datasets[0].data})')
            self.assertEqual(chart['labels'], [f'{(hour+i)%24:02d}:00' for i in range(24)])
            self.assertEqual(chart['data'][chart['labels'].index('08:00')], 1600)
            self.assertTrue(self.page.evaluate('manualLabels.has(pointIdentity(state.co2Chart.data.datasets[0],state.co2Chart.data.labels.indexOf("08:00")))'))
            self.assertEqual(self.page.evaluate('Object.keys(Chart.instances).length'), 1)
        self.page.locator('#diurnalStart').select_option('9')
        rows = self.download_csv()
        self.assertEqual([row['時段'] for row in rows], [f'{(9+i)%24:02d}:00' for i in range(24)])
        self.assertEqual(rows[-1]['平均值'], '1600')
        self.page.locator('#profileCoverage > summary').click()
        self.assertEqual(self.page.locator('#profileCoverageRows tr').first.locator('td').nth(1).inner_text(), '09:00')
        self.assertEqual(self.page.evaluate('JSON.stringify(state.output)'), original)
        for metric, expected in [('temp', (25+27+30)/3), ('humidity', (60+64+70)/3), ('co2', 1600)]:
            self.page.locator('#overviewMetric').select_option(metric)
            self.assertAlmostEqual(self.page.evaluate('state.co2Chart.data.datasets[0].data.at(-1)'), expected)
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.page.locator('#openStyle').click()
        self.page.evaluate("() => {window.exportedText=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.exportedText.push(String(text));return original.call(this,text,...args)}}")
        with self.page.expect_download() as download:
            self.page.locator('#panelDownloadCurrent').click()
        self.assertTrue(Path(download.value.path()).read_bytes().startswith(b'\x89PNG'))
        self.assertIn('09:00', self.page.evaluate('window.exportedText'))
        self.assertIn('08:00', self.page.evaluate('window.exportedText'))

    def test_weighting_and_hour_survive_settings_and_mode_round_trip(self):
        self.upload()
        self.render_quick('co2hour')
        self.page.locator('#diurnalStart').select_option('9')
        self.page.locator('#profileMethod').select_option('days')
        self.page.wait_for_function('state.co2Chart.data.datasets[0].data.at(-1)===1800')
        rows = self.download_csv()
        self.assertEqual(rows[-1]['平均方式'], '每天等權平均')
        self.assertEqual(rows[-1]['有效天數'], '2')
        self.assertEqual(rows[-1]['樣本數'], '3')
        self.page.locator('#openStyle').click()
        with self.page.expect_download() as download:
            self.expose('#saveSettings').click()
        saved = Path(download.value.path()).read_bytes()
        self.assertEqual(json.loads(saved)['settings']['diurnalStart'], '9')
        self.page.locator('#closeStyle').click()
        self.page.locator('#diurnalStart').select_option('0')
        self.page.locator('#profileMethod').select_option('observations')
        self.expose('#loadSettings').set_input_files({'name': 'profile.json', 'mimeType': 'application/json', 'buffer': saved})
        self.page.wait_for_function("state.co2Chart?.data.labels[0]==='09:00'&&state.co2Chart.data.datasets[0].data.at(-1)===1800")
        self.page.locator('[data-step="1"]').click()
        self.page.locator('#chooseComparisonMode').click()
        self.page.locator('#chooseQuickMode').click()
        self.page.locator('#sourceNext').click()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.assertEqual(self.page.locator('#diurnalStart').input_value(), '9')
        self.assertEqual(self.page.locator('#profileMethod').input_value(), 'days')
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets[0].data.at(-1)'), 1800)
