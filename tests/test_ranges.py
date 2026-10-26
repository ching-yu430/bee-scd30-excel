"""All-point markers and visual comparison intervals, including PNG and touch."""
from pathlib import Path
import json
import unittest

import test_chart_editor as editor_tests


class ComparisonRangeTests(unittest.TestCase):
    setUpClass = classmethod(editor_tests.ChartEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(editor_tests.ChartEditorTests.tearDownClass.__func__)
    open_home = editor_tests.ChartEditorTests.open_home
    tearDown = editor_tests.ChartEditorTests.tearDown
    expose = editor_tests.ChartEditorTests.expose

    def setUp(self):
        self.open_home()
        self.page.locator('#chooseComparisonMode').click()
        for source, day, base in [('hive', '2026-07-01', 2000), ('peer', '2026-09-01', 1000)]:
            rows = 'timestamp,temperature,humidity,co2\n' + ''.join(
                f'{day} {hour:02d}:00:00,{20+hour/10},{50+hour},' +
                ('' if source == 'peer' and hour == 12 else str(base+hour*10)) + '\n' for hour in range(24))
            self.page.locator('#' + source + 'File').set_input_files(
                {'name': source + '.csv', 'mimeType': 'text/csv', 'buffer': rows.encode()})
            self.page.wait_for_function(f'state.{source}?.rows.length===24')
        self.page.locator('#sourceNext').click()
        self.page.locator('#overviewView').select_option('co2hour')
        self.page.locator('#diurnalStart').select_option('9')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty&&!document.querySelector("#sourceNext").disabled')

    def open_ranges(self):
        if not self.page.locator('#stylePanel').is_visible():
            self.page.locator('#openStyle').click()
        self.page.locator('#settingsTab-1').click()

    def manual_range(self, start='18:00', end='00:00', label='夜間差異'):
        self.open_ranges()
        for selector, text in [('#rangeFrom', start), ('#rangeTo', end), ('#rangeLabel', label)]:
            self.expose(selector).fill(text)
        self.page.locator('#rangeSave').click()
        self.assertFalse(self.page.locator('#rangeStatus').evaluate('el=>el.classList.contains("has-error")'))

    def coordinates(self, first='18:00', last='00:00', y1=.3, y2=.7):
        return self.page.evaluate('''args=>{
            const c=currentSettingsChart(),r=c.canvas.getBoundingClientRect(),a=c.chartArea;
            return args.hours.map((text,i)=>({x:r.left+c.scales.x.getPixelForValue(c.data.labels.indexOf(text))*r.width/c.width,
                y:r.top+(a.top+(a.bottom-a.top)*args.y[i])*r.height/c.height}));
        }''', {'hours': [first, last], 'y': [y1, y2]})

    def drag_range(self, first='18:00', last='00:00', y1=.3, y2=.7):
        self.page.locator('#selectRange').click()
        self.page.wait_for_function('currentSettingsChart().width===Math.round(currentSettingsChart().canvas.getBoundingClientRect().width)')
        self.page.locator('#co2DailyChart').scroll_into_view_if_needed()
        a, b = self.coordinates(first, last, y1, y2)
        self.page.mouse.move(a['x'], a['y'])
        self.page.mouse.down()
        self.page.mouse.move(b['x'], b['y'], steps=8)
        self.page.mouse.up()

    def test_markers_cover_every_valid_point_independently_of_text_limit_and_png(self):
        original = self.page.evaluate('JSON.stringify(state.output)')
        self.open_ranges()
        self.expose('#labelLimit').fill('2')
        self.expose('#showPoints').check()
        self.expose('#pointSize').fill('4')
        self.page.wait_for_function('state.co2Chart.data.datasets.every(ds=>ds.data.filter(validPoint).length===ds.data.filter((p,i)=>state.co2Chart.getDatasetMeta(state.co2Chart.data.datasets.indexOf(ds)).data[i].options.radius>0).length)')
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.map((ds,j)=>state.co2Chart.getDatasetMeta(j).data.filter(p=>p.options.radius>0).length)'), [24, 23])
        self.expose('#showValues').check()
        self.page.wait_for_function('state.co2Chart.$researchOptions.showValues')
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.map(ds=>ds.researchSelected.size)'), [2, 2])
        self.page.evaluate("window.pngMarkers=[];Chart.register({id:'pngMarkerAudit',afterDatasetsDraw:c=>{if(!c.canvas.isConnected)window.pngMarkers=c.data.datasets.map((ds,j)=>c.getDatasetMeta(j).data.filter(p=>p.options.radius>0).length)}})")
        with self.page.expect_download() as download:
            self.page.locator('#panelDownloadCurrent').click()
        self.assertTrue(Path(download.value.path()).read_bytes().startswith(b'\x89PNG'))
        self.assertEqual(self.page.evaluate('window.pngMarkers'), [24, 23])
        self.assertEqual(self.page.evaluate('JSON.stringify(state.output)'), original)
        self.page.locator('#closeStyle').click()
        self.page.locator('#overviewView').select_option('continuous')
        self.page.wait_for_function('workspaceStage===2')
        self.page.locator('#timeAlignment').select_option('calendar')
        self.page.locator('#aggregation').select_option('raw')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.assertTrue(self.page.evaluate('state.charts.every(c=>c.data.datasets.every((ds,j)=>ds.data.filter(validPoint).length===c.getDatasetMeta(j).data.filter(p=>p.options.radius>0).length))'))

    def test_mouse_time_selection_survives_reordering_and_exports(self):
        original = self.page.evaluate('currentCsv()')
        self.open_ranges()
        self.expose('#rangeLabel').fill('夜間差異')
        self.expose('#pickPoints').check()
        self.drag_range()
        self.page.wait_for_function('comparisonRanges.length===1')
        record = self.page.evaluate('comparisonRanges[0]')
        self.assertEqual((record['x1'], record['x2'], record['yAxis']), (18, 0, None))
        self.assertEqual(self.page.evaluate('manualLabels.size'), 0)
        self.assertEqual(self.page.evaluate('rangeRectangles(state.co2Chart,comparisonRanges[0]).length'), 1)
        self.page.locator('#diurnalStart').select_option('0')
        self.assertEqual(self.page.evaluate('rangeRectangles(state.co2Chart,comparisonRanges[0]).length'), 2)
        self.page.locator('#overviewMetric').select_option('temp')
        self.assertFalse(self.page.evaluate('comparisonRanges.some(r=>r.scope===state.co2Chart.$rangeScope)'))
        self.page.locator('#overviewMetric').select_option('co2')
        self.page.locator('#diurnalStart').select_option('9')
        self.assertEqual(self.page.evaluate('currentCsv()'), original)
        self.open_ranges()
        self.page.evaluate("() => {window.pngRanges=[];window.pngLabels=[];Chart.register({id:'pngRangeAudit',afterDraw:c=>{if(!c.canvas.isConnected)window.pngRanges=comparisonRanges.filter(r=>r.scope===c.$rangeScope).flatMap(r=>rangeRectangles(c,r))}});const old=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...args){window.pngLabels.push(String(t));return old.call(this,t,...args)}}")
        with self.page.expect_download() as download:
            self.page.locator('#panelDownloadCurrent').click()
        self.assertTrue(Path(download.value.path()).stat().st_size > 1000)
        self.assertEqual(self.page.evaluate('window.pngRanges.length'), 1)
        self.assertIn('夜間差異', self.page.evaluate('window.pngLabels'))
        self.assertEqual(self.page.evaluate('Object.keys(Chart.instances).length'), 1)

    def test_reverse_rectangle_drag_and_cancel(self):
        self.open_ranges()
        self.page.locator('#rangeKind').select_option('box')
        self.drag_range('00:00', '18:00', .8, .2)
        self.page.wait_for_function('comparisonRanges.length===1')
        record = self.page.evaluate('comparisonRanges[0]')
        self.assertEqual((record['x1'], record['x2'], record['yAxis']), (18, 0, 'y'))
        self.assertLess(record['y1'], record['y2'])
        rect = self.page.evaluate('rangeRectangles(state.co2Chart,comparisonRanges[0])[0]')
        area = self.page.evaluate('state.co2Chart.chartArea')
        self.assertGreater(rect['top'], area['top'])
        self.assertLess(rect['bottom'], area['bottom'])
        self.page.locator('#selectRange').click()
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('#selectRange').get_attribute('aria-pressed'), 'false')
        self.assertEqual(self.page.evaluate('comparisonRanges.length'), 1)
        self.page.locator('#selectRange').click()
        self.page.locator('#diurnalStart').select_option('0')
        self.assertEqual(self.page.locator('#selectRange').get_attribute('aria-pressed'), 'false')
        self.assertEqual(self.page.locator('#co2DailyChart').evaluate('c=>getComputedStyle(c).touchAction'), 'auto')
        self.open_ranges()
        self.expose('#pickPoints').check()
        self.page.locator('#selectRange').click()
        self.page.locator('#co2DailyChart').scroll_into_view_if_needed()
        a, b = self.coordinates('18:00', '00:00', .3, .5)
        self.page.mouse.move(a['x'], a['y'])
        self.page.mouse.down()
        self.page.mouse.move(b['x'], b['y'], steps=4)
        self.page.keyboard.press('Escape')
        self.page.mouse.up()
        self.assertEqual(self.page.evaluate('comparisonRanges.length'), 1)
        self.assertEqual(self.page.evaluate('manualLabels.size'), 0)

    def test_manual_edit_delete_and_invalid_bounds(self):
        self.manual_range(label='<b>重點</b>')
        self.assertEqual(self.page.locator('#rangeList b').count(), 0)
        self.assertIn('<b>重點</b>', self.page.locator('#rangeList').inner_text())
        self.page.locator('#rangeList button').filter(has_text='編輯').click()
        self.page.locator('#rangeMin').fill('1500')
        self.page.locator('#rangeMax').fill('1400')
        self.page.locator('#rangeSave').click()
        self.assertTrue(self.page.locator('#rangeStatus').evaluate('el=>el.classList.contains("has-error")'))
        self.assertIsNone(self.page.evaluate('comparisonRanges[0].yAxis'))
        self.page.locator('#rangeMax').fill('2200')
        self.page.locator('#rangeSave').click()
        self.assertEqual(self.page.evaluate('comparisonRanges.length'), 1)
        self.assertEqual(self.page.evaluate('comparisonRanges[0].y1'), 1500)
        self.page.locator('#rangeList button').filter(has_text='刪除').click()
        self.assertEqual(self.page.evaluate('comparisonRanges.length'), 0)

    def test_settings_round_trip_legacy_clear_and_invalid_import(self):
        self.manual_range()
        with self.page.expect_download() as download:
            self.expose('#saveSettings').click()
        saved = Path(download.value.path()).read_bytes()
        self.page.locator('#settingsTab-1').click()
        self.page.locator('#rangeClear').click()
        self.expose('#loadSettings').set_input_files({'name': 'ranges.json', 'mimeType': 'application/json', 'buffer': saved})
        self.page.wait_for_function('comparisonRanges.length===1')
        before = self.page.evaluate('JSON.stringify(snapshotSettings())')
        invalid = json.loads(saved)
        invalid['highlights'][0]['color'] = 'invalid'
        invalid['settings']['chartTitle'] = '不應套用'
        self.expose('#loadSettings').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': json.dumps(invalid).encode()})
        self.page.wait_for_function('document.querySelector("#analysisStatus").textContent.includes("無法載入設定")')
        self.assertEqual(self.page.evaluate('JSON.stringify(snapshotSettings())'), before)
        legacy = json.loads(saved)
        del legacy['highlights']
        self.expose('#loadSettings').set_input_files({'name': 'legacy.json', 'mimeType': 'application/json', 'buffer': json.dumps(legacy).encode()})
        self.page.wait_for_function('comparisonRanges.length===0')

    def test_elapsed_experiment_ranges_use_day_coordinates(self):
        self.page.locator('#overviewView').select_option('continuous')
        self.page.wait_for_function('workspaceStage===2')
        self.page.locator('#hiveOriginConfirmed').check()
        self.page.locator('#peerOriginConfirmed').check()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.manual_range('1.25', '1.75')
        self.assertEqual(self.page.evaluate('comparisonRanges[0].domain'), 'elapsed')
        self.assertEqual(self.page.evaluate('comparisonRanges[0].x1'), 6*3600000)
        self.assertEqual(self.page.evaluate('comparisonRanges[0].x2'), 18*3600000)
        self.assertEqual(self.page.evaluate('rangeRectangles(currentSettingsChart(),comparisonRanges[0]).length'), 1)

    def test_touch_drag_and_inactive_scroll(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.locator('#selectRange').click()
        self.page.locator('#co2DailyChart').scroll_into_view_if_needed()
        self.page.wait_for_function('currentSettingsChart().width===Math.round(currentSettingsChart().canvas.getBoundingClientRect().width)')
        a, b = self.coordinates('09:00', '11:00', .35, .45)
        cdp = self.page.context.new_cdp_session(self.page)
        cdp.send('Emulation.setTouchEmulationEnabled', {'enabled': True})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': a['x'], 'y': a['y']}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': b['x'], 'y': b['y']}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        self.page.wait_for_function('comparisonRanges.length===1')
        self.assertEqual(self.page.evaluate('comparisonRanges[0].x1'), 9)
        self.assertEqual(self.page.evaluate('comparisonRanges[0].x2'), 11)
        self.assertEqual(self.page.locator('#co2DailyChart').evaluate('canvas=>getComputedStyle(canvas).touchAction'), 'auto')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
