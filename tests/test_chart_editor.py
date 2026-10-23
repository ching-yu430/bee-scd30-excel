"""Browser regression checks: python3 -m unittest discover -s tests -v.

Requires Playwright and Chromium. BEE_TEST_ASSET_DIR may point to TLS-verified
chart.umd.min.js and xlsx.full.min.js downloads for an offline browser run.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import shutil
import threading
import unittest

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class ChartEditorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[1]
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.playwright = sync_playwright().start()
        options = {'headless': True}
        chromium = os.environ.get('BEE_TEST_CHROMIUM') or shutil.which('chromium')
        if chromium:
            options['executable_path'] = chromium
        if os.environ.get('HTTPS_PROXY'):
            options['proxy'] = {'server': os.environ['HTTPS_PROXY'], 'bypass': '127.0.0.1,localhost'}
        cls.browser = cls.playwright.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.page = self.browser.new_page(timezone_id='Asia/Taipei', viewport={'width': 1440, 'height': 1000})
        self.page.set_default_timeout(7000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        assets = os.environ.get('BEE_TEST_ASSET_DIR')
        if assets:
            for package, filename in [('chart.js@4.4.7', 'chart.umd.min.js'), ('xlsx@0.18.5', 'xlsx.full.min.js')]:
                path = str(Path(assets) / filename)
                self.page.route('https://cdn.jsdelivr.net/npm/' + package + '/dist/' + filename,
                                lambda route, request, path=path: route.fulfill(path=path, content_type='application/javascript'))
        # Optional fonts have no bearing on editor behavior or chart data.
        self.page.route('https://fonts.googleapis.com/**', lambda route: route.abort())
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/', wait_until='networkidle')
        self.assertEqual(self.page.evaluate('missingWebsiteParts'), [])
        for source, delta in [('hive', 0), ('peer', 1), ('weather', 2)]:
            csv = ('timestamp,temperature,humidity,co2,precipitation\n'
                   f'2026-07-01 08:00:00,{25 + delta},60,1000,1\n'
                   f'2026-07-01 08:30:00,{27 + delta},64,1400,2\n'
                   f'2026-07-01 09:00:00,{29 + delta},68,1800,3\n')
            self.page.locator('#' + source + 'File').set_input_files(
                {'name': source + '.csv', 'mimeType': 'text/csv', 'buffer': csv.encode()})
            self.page.wait_for_function(f'state.{source}?.rows.length===3')
        self.page.locator('#sourceNext').click()
        self.page.locator('#comparisonMode').select_option('all')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('state.charts.length===3')
        self.page.locator('#openStyle').click()

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [])
        finally:
            self.page.close()

    def expose(self, selector):
        self.page.locator(selector).evaluate("el => {for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true}")
        return self.page.locator(selector)

    def fill_live(self, selector, value, condition):
        self.expose(selector).fill(value)
        self.page.wait_for_function(condition)
        self.assertEqual(self.page.evaluate('document.activeElement.id'), selector[1:])

    def test_names_titles_axes_and_png_apply_while_typing(self):
        original = self.page.evaluate('JSON.stringify(state.output)')
        for prefix, name in [('inner', '實驗組溫度'), ('peer', '對照組溫度'), ('outer', '氣象站溫度')]:
            self.fill_live('#' + prefix + 'Name-temp', name,
                           'state.charts[0].data.datasets.some(d=>d.label===' + json.dumps(name) + ')')
        self.fill_live('#chartTitle', '蜂箱比較', "state.charts[0].$title.startsWith('蜂箱比較')")
        self.fill_live('#axisTitle-temp', '自訂溫度軸', "state.charts[0].options.scales.temp.title.text==='自訂溫度軸'")
        self.fill_live('#lineWidth', '4', 'state.charts[0].data.datasets.every(d=>d.borderWidth===4)')
        self.expose('#showLegend').uncheck()
        self.page.wait_for_function("document.querySelector('#chart-0').closest('.chart-card').querySelector('.line-legend').hidden")
        self.expose('#showLegend').check()
        self.page.wait_for_function("!document.querySelector('#chart-0').closest('.chart-card').querySelector('.line-legend').hidden")
        self.page.evaluate("() => {window.exportedText=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.exportedText.push(String(text));return original.call(this,text,...args)}}")
        with self.page.expect_download() as download:
            self.page.locator('#downloadCurrentPng').click()
        self.assertTrue(Path(download.value.path()).read_bytes().startswith(b'\x89PNG\r\n\x1a\n'))
        text = self.page.evaluate('window.exportedText')
        for name in ['實驗組溫度', '對照組溫度', '氣象站溫度', '自訂溫度軸']:
            self.assertIn(name, text)
        self.assertTrue(any('蜂箱比較' in item for item in text))
        self.assertEqual(self.page.evaluate('JSON.stringify(state.output)'), original)

    def test_hidden_series_and_manual_points_survive_renaming(self):
        self.page.evaluate('togglePoint(state.charts[0],state.charts[0].data.datasets[0],0)')
        self.page.locator('#closeStyle').click()
        self.page.locator('#charts > .chart-card').first.locator('.line-legend button').first.click()
        self.page.locator('#openStyle').click()
        self.fill_live('#innerName-temp', '改名後仍隱藏', "state.charts[0].data.datasets[0].label==='改名後仍隱藏'")
        self.assertFalse(self.page.evaluate('state.charts[0].isDatasetVisible(0)'))
        self.assertTrue(self.page.evaluate("manualLabels.has(pointIdentity(state.charts[0].data.datasets[0],0))"))
        legacy = self.page.evaluate('snapshotSettings()')
        legacy['version'] = 7
        legacy['hiddenSeries'] = ['改名後仍隱藏']
        self.page.locator('#loadSettings').set_input_files({'name': 'hidden-v7.json', 'mimeType': 'application/json', 'buffer': json.dumps(legacy).encode()})
        self.page.wait_for_function('!state.charts[0].isDatasetVisible(0)')
        self.fill_live('#innerName-temp', '舊設定改名仍隱藏', "state.charts[0].data.datasets[0].label==='舊設定改名仍隱藏'")
        self.assertFalse(self.page.evaluate('state.charts[0].isDatasetVisible(0)'))

    def test_live_names_and_colors_in_other_chart_modes(self):
        self.fill_live('#innerName-temp', '自訂溫度', "state.charts[0].data.datasets[0].label==='自訂溫度'")
        color = self.expose('[data-metric="temp"][data-prop="color"]')
        color.fill('#123456')
        self.page.wait_for_function("state.charts[0].data.datasets[0].borderColor==='#123456'")
        self.page.locator('#closeStyle').click()
        self.page.locator('#chartPicker').select_option(index=2)
        self.page.locator('#openStyle').click()
        self.fill_live('#innerName-co2', '自訂二氧化碳', "state.charts[2].data.datasets[0].label==='自訂二氧化碳'")
        self.page.locator('#closeStyle').click()
        for mode, expected in [('combined', '自訂溫度'), ('daily', '自訂溫度'), ('co2hour', '自訂二氧化碳'), ('rainfall', '我的蜂箱 相對濕度')]:
            with self.subTest(mode=mode):
                self.page.locator('[data-step="2"]').click()
                self.page.locator('#chartMode').select_option(mode)
                self.page.locator('#sourceNext').click()
                self.page.wait_for_function("workspaceStage===3&&!document.querySelector('#sourceNext').disabled&&state.renderMode===" + json.dumps(mode))
                self.page.wait_for_function("([...(state.co2Chart?[state.co2Chart]:state.charts)]).some(c=>c.data.datasets.some(d=>d.label===" + json.dumps(expected) + '))')
                self.assertGreater(self.page.evaluate('state.output.length'), 0)

    def test_difference_and_overlay_use_custom_names(self):
        self.fill_live('#innerName-temp', '實驗溫度', "state.charts[0].data.datasets[0].label==='實驗溫度'")
        self.fill_live('#peerName-temp', '對照溫度', "state.charts[0].data.datasets[1].label==='對照溫度'")
        self.page.locator('#closeStyle').click()
        self.page.locator('[data-step="2"]').click()
        self.page.locator('#chartMode').select_option('difference')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("state.charts[0].data.datasets[0].label==='實驗溫度 − 對照溫度'")
        self.page.locator('[data-step="2"]').click()
        self.page.locator('#chartMode').select_option('overlay')
        self.page.locator('#overlayMetric').select_option('temp')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function("state.charts[0].data.datasets[0].label==='實驗溫度 · 2026-07-01'")

    def test_pending_edits_are_included_in_download(self):
        self.expose('#innerName-temp').fill('立刻匯出的圖例')
        with self.page.expect_download() as download:
            self.page.locator('#downloadCurrentPng').click()
        self.assertTrue(Path(download.value.path()).stat().st_size > 1000)
        self.assertEqual(self.page.evaluate('state.charts[0].data.datasets[0].label'), '立刻匯出的圖例')

    def test_settings_round_trip_and_legacy_import(self):
        self.fill_live('#innerName-temp', '儲存的圖例', "state.charts[0].data.datasets[0].label==='儲存的圖例'")
        self.fill_live('#axisTitle-temp', '儲存的座標軸', "state.metrics.temp.title==='儲存的座標軸'")
        with self.page.expect_download() as download:
            self.expose('#saveSettings').click()
        saved = Path(download.value.path()).read_bytes()
        self.assertEqual(json.loads(saved)['version'], 22)
        self.expose('#resetFormat').click()
        self.page.wait_for_function("state.charts[0].data.datasets[0].label!=='儲存的圖例'")
        self.page.locator('#loadSettings').set_input_files({'name': 'saved.json', 'mimeType': 'application/json', 'buffer': saved})
        self.page.wait_for_function("state.charts[0].data.datasets[0].label==='儲存的圖例'")
        self.assertEqual(self.page.evaluate('state.metrics.temp.title'), '儲存的座標軸')
        legacy = json.loads(saved)
        legacy['version'] = 7
        legacy['settings']['innerName-temp'] = '舊設定的圖例'
        self.page.locator('#loadSettings').set_input_files({'name': 'legacy.json', 'mimeType': 'application/json', 'buffer': json.dumps(legacy).encode()})
        self.page.wait_for_function("state.charts[0].data.datasets[0].label==='舊設定的圖例'")

    def test_invalid_axis_settings_block_export_and_recover(self):
        self.expose('#axisMin-temp').fill('30')
        self.expose('#axisMax-temp').fill('20')
        self.page.wait_for_function("document.querySelector('#styleStatus').classList.contains('has-error')")
        downloads = []
        self.page.on('download', lambda download: downloads.append(download))
        self.page.locator('#panelDownloadCurrent').click()
        self.assertEqual(downloads, [])
        self.fill_live('#axisMax-temp', '40', "state.charts[0].options.scales.temp.max===40")
        self.assertFalse(self.page.locator('#styleStatus').evaluate("el=>el.classList.contains('has-error')"))

    def test_mobile_and_workspace_actions_stay_accessible(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.assertTrue(self.page.locator('#innerName-temp').is_visible())
        self.fill_live('#innerName-temp', '手機圖例', "state.charts[0].data.datasets[0].label==='手機圖例'")
        with self.page.expect_download() as download:
            self.page.locator('#panelDownloadCurrent').click()
        self.assertTrue(Path(download.value.path()).stat().st_size > 1000)
        self.page.locator('#closeStyle').click()
        for selector in ['#openStyle', '#downloadCurrentPng', '#downloadCsv', '#chartPicker']:
            box = self.page.locator(selector).bounding_box()
            self.assertIsNotNone(box)
            self.assertGreaterEqual(box['x'], 0)
            self.assertLessEqual(box['x'] + box['width'], 391)
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
        for tab in ['query', 'anomaly']:
            self.page.locator('#' + tab + 'Tab').click()
            self.page.locator('#openStyle').click()
            self.assertTrue(self.page.locator('#stylePanel').is_visible())
            self.assertFalse(self.page.locator('#styleFeedback').is_visible())
            self.page.locator('#closeStyle').click()
        self.page.locator('#plotTab').click()
        self.assertTrue(self.page.locator('#openStyle').is_visible())


if __name__ == '__main__':
    unittest.main()
