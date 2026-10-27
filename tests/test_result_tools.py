"""Source controls, direct image navigation, and reversible A/B exchanges."""
from pathlib import Path
import json
import unittest

import test_chart_editor as editor_tests


class ResultToolsTests(unittest.TestCase):
    setUpClass = classmethod(editor_tests.ChartEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(editor_tests.ChartEditorTests.tearDownClass.__func__)
    open_home = editor_tests.ChartEditorTests.open_home
    tearDown = editor_tests.ChartEditorTests.tearDown
    expose = editor_tests.ChartEditorTests.expose

    def setUp(self):
        self.open_home()
        self.page.locator('#chooseComparisonMode').click()
        self.page.locator('#hiveUseWeather').check()
        self.page.locator('#peerUseWeather').check()
        self.page.locator('#hiveName').fill('七月實驗')
        self.page.locator('#peerName').fill('九月實驗')
        for source, day, base in [('hive', '2026-07-01', 1000), ('peer', '2026-09-01', 2000),
                                  ('weather', '2026-07-01', 500), ('weatherPeer', '2026-09-01', 700)]:
            header = 'timestamp,temperature,humidity,co2,precipitation\n'
            if source == 'peer':
                header = '日期時間,溫度,濕度,CO2,precipitation\n'
            rows = header + ''.join(f'{day} {hour:02d}:00:00,{20+hour},{50+hour},{base+hour*10},1\n' for hour in range(24))
            self.page.locator('#' + source + 'File').set_input_files({'name': source + '.csv', 'mimeType': 'text/csv', 'buffer': rows.encode()})
            self.page.wait_for_function(f'state.{source}?.rows.length===24')
        self.page.locator('#sourceNext').click()
        self.page.locator('#overviewView').select_option('co2hour')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')

    def source_visibility(self):
        return self.page.evaluate('resultCharts().map(c=>c.data.datasets.map((ds,i)=>[ds.sourceId,c.isDatasetVisible(i)]))')

    def fill_color(self, selector, color):
        opened = not self.page.locator('#stylePanel').is_visible()
        if opened:
            self.page.locator('#openStyle').click()
        self.page.locator('#settingsTab-0').click()
        self.page.locator(selector).fill(color)
        self.page.locator(selector).dispatch_event('change')
        self.page.wait_for_function('formatPreviewTimer===null')
        if opened:
            self.page.locator('#closeStyle').click()

    def test_source_switches_follow_modes_and_export_without_filtering_data(self):
        original = self.page.evaluate('currentCsv()')
        self.page.locator('#sourceShown-peer').uncheck()
        self.page.locator('#sourceShown-weather').uncheck()
        self.assertEqual(self.source_visibility(), [[['hive', True], ['peer', False], ['weather', False], ['weatherPeer', True]]])
        self.assertEqual(self.page.evaluate('currentCsv()'), original)
        self.page.evaluate("window.pngSources=[];Chart.register({id:'sourceAudit',afterDraw:c=>{if(!c.canvas.isConnected)window.pngSources=c.data.datasets.map((ds,i)=>[ds.sourceId,c.isDatasetVisible(i)])}})")
        with self.page.expect_download() as downloaded:
            self.page.locator('#downloadCurrentPng').click()
        self.assertTrue(Path(downloaded.value.path()).read_bytes().startswith(b'\x89PNG'))
        self.assertEqual(self.page.evaluate('window.pngSources'), self.source_visibility()[0])
        self.page.locator('#overviewView').select_option('combined')
        self.page.locator('#hiveOriginConfirmed').check()
        self.page.locator('#peerOriginConfirmed').check()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        visible = self.source_visibility()[0]
        self.assertTrue(all(shown == (source in ['hive', 'weatherPeer']) for source, shown in visible))
        self.page.locator('#showAllSources').click()
        self.assertTrue(all(shown for source, shown in self.source_visibility()[0]))
        self.page.locator('#sourceShown-peer').uncheck()
        self.page.locator('.line-legend button:visible').filter(has_text='九月實驗 CO₂').click()
        self.assertTrue(self.page.locator('#sourceShown-peer').is_checked())
        self.assertTrue(all(shown for source, shown in self.source_visibility()[0]))

    def test_independent_source_colors_panel_json_and_png(self):
        before = self.page.evaluate('state.co2Chart.data.datasets.map(ds=>ds.borderColor)')
        self.fill_color('#panelColor-hive-co2', '#135724')
        self.fill_color('#panelColor-peer-co2', '#614abc')
        self.fill_color('#panelColor-weather-co2', '#bc7234')
        expected = ['#135724', '#614abc', '#bc7234', before[3]]
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.map(ds=>ds.borderColor)'), expected)
        self.page.locator('#openStyle').click()
        self.fill_color('#panelColor-weatherPeer-co2', '#345678')
        self.expose('#peerName-co2').fill('另一組 CO₂')
        self.page.wait_for_function("state.co2Chart.data.datasets[1].label==='另一組 CO₂'")
        self.page.locator('#sourceShown-peer').evaluate('el=>{el.checked=false;el.dispatchEvent(new Event("change"))}')
        with self.page.expect_download() as downloaded:
            self.expose('#saveSettings').click()
        saved = Path(downloaded.value.path()).read_bytes()
        self.expose('#resetFormat').click()
        self.assertEqual(self.page.evaluate("value('sourceColorValue-peer-co2')"), '')
        self.expose('#loadSettings').set_input_files({'name': 'appearance.json', 'mimeType': 'application/json', 'buffer': saved})
        self.page.wait_for_function("state.co2Chart.data.datasets[1].borderColor==='#614abc'")
        self.assertFalse(self.page.locator('#sourceShown-peer').is_checked())
        self.assertEqual(self.page.locator('#panelColor-weatherPeer-co2').input_value(), '#345678')
        self.page.evaluate("window.pngColors=[];Chart.register({id:'colorAudit',afterDraw:c=>{if(!c.canvas.isConnected)window.pngColors=c.data.datasets.map(ds=>ds.borderColor)}})")
        with self.page.expect_download():
            self.page.locator('#panelDownloadCurrent').click()
        self.assertEqual(self.page.evaluate('window.pngColors'), expected[:3]+['#345678'])

    def test_direct_chart_navigation_and_current_image_selection(self):
        self.page.locator('#overviewView').select_option('daily')
        self.page.wait_for_function("state.renderMode==='daily'&&!state.dirty")
        self.assertEqual(self.page.evaluate('workspaceStage'), 3)
        self.assertGreater(self.page.locator('#chartPicker option').count(), 1)
        self.page.locator('#nextResultChart').click()
        selected = self.page.evaluate('currentSettingsChart().canvas.id')
        self.assertNotEqual(self.page.locator('#chartPicker').input_value(), '0')
        self.page.evaluate("() => {window.exportedIds=[];const exportOriginal=exportCharts;exportCharts=charts=>{window.exportedIds=charts.map(c=>c.canvas.id);return exportOriginal(charts)}}")
        with self.page.expect_download():
            self.page.locator('#downloadCurrentPng').click()
        self.assertEqual(self.page.evaluate('window.exportedIds'), [selected])
        self.page.locator('#previousResultChart').click()
        self.assertEqual(self.page.locator('#chartPicker').input_value(), '0')
        self.page.locator('#overviewView').select_option('overlay')
        self.page.locator('#resultModeOptions').evaluate('el=>el.open=true')
        self.page.locator('#overlaySource').select_option('peer')
        self.page.wait_for_function("state.charts[0].data.datasets[0].sourceId.startsWith('peer|')")
        self.assertEqual(self.page.evaluate('workspaceStage'), 3)
        self.page.locator('#overviewView').select_option('co2hour')
        self.page.wait_for_function('Boolean(state.co2Chart)&&!state.dirty')
        self.assertEqual(self.page.evaluate('Object.keys(Chart.instances).length'), 1)

    def test_exchange_twice_preserves_data_ranges_identity_and_appearance(self):
        self.fill_color('#panelColor-hive-co2', '#123456')
        self.fill_color('#panelColor-peer-co2', '#abcdef')
        self.page.locator('#sourceShown-weather').uncheck()
        self.page.locator('[data-step="2"]').click()
        self.page.locator('#hivePeriodStart').fill('2026-07-01T03:00')
        self.page.locator('#hivePeriodStart').dispatch_event('change')
        self.page.locator('#peerPeriodEnd').fill('2026-09-01T20:00')
        self.page.locator('#peerPeriodEnd').dispatch_event('change')
        self.page.evaluate("document.querySelector('#hiveOriginConfirmed').checked=true;document.querySelector('#peerOriginConfirmed').checked=true")
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        baseline = self.page.evaluate("JSON.stringify(snapshotSettings())")
        self.page.evaluate('window.beforeData=Object.fromEntries(sourceIds.map(s=>[s,state[s]]))')
        self.page.locator('#swapExperiments').click()
        self.page.wait_for_function("sourceName('hive')==='九月實驗'&&!state.dirty")
        self.assertEqual(self.page.evaluate('workspaceStage'), 3)
        self.assertTrue(self.page.evaluate('sourceIds.every(s=>state[s]===window.beforeData[swappedSources[s]])'))
        self.assertEqual(self.page.locator('#hivePeriodEnd').input_value(), '2026-09-01T20:00')
        self.assertEqual(self.page.locator('#peerPeriodStart').input_value(), '2026-07-01T03:00')
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.slice(0,2).map(ds=>ds.borderColor)'), ['#abcdef', '#123456'])
        self.assertFalse(self.page.locator('#sourceShown-weatherPeer').is_checked())
        self.page.locator('#swapExperiments').click()
        self.page.wait_for_function("sourceName('hive')==='七月實驗'&&!state.dirty")
        self.assertTrue(self.page.evaluate('sourceIds.every(s=>state[s]===window.beforeData[s])'))
        self.assertEqual(self.page.evaluate('JSON.stringify(snapshotSettings())'), baseline)
        self.assertEqual(self.page.evaluate('Object.keys(Chart.instances).length'), 1)
        self.page.locator('[data-step="1"]').click()
        self.page.evaluate("mappingFold.open=true;document.querySelectorAll('#peerFileMappings details').forEach(el=>el.open=true)")
        self.page.locator('#peerFileMappings .source-files-fold > details select').first.select_option(label='不使用')
        self.assertEqual(self.page.evaluate("state.peer.batches[0].mapping.time"), '')
        self.assertNotEqual(self.page.evaluate("state.hive.batches[0].mapping.time"), '')

    def test_exchange_with_one_station_moves_station_and_retains_relative_origins(self):
        self.page.locator('[data-step="1"]').click()
        self.page.locator('#peerUseWeather').uncheck()
        self.page.evaluate('state.weatherPeer=null')
        self.page.locator('#swapExperiments').click()
        self.assertTrue(self.page.evaluate('state.weather===null&&Boolean(state.weatherPeer)'))
        self.assertFalse(self.page.locator('#hiveUseWeather').is_checked())
        self.assertTrue(self.page.locator('#peerUseWeather').is_checked())
        self.page.locator('#sourceNext').click()
        self.page.locator('#overviewView').select_option('continuous')
        self.page.locator('#hiveOriginConfirmed').check()
        self.page.locator('#peerOriginConfirmed').check()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.assertTrue(self.page.evaluate('isRelativeComparison()'))
        self.assertEqual(self.page.evaluate('activePlotSources()'), ['hive', 'peer', 'weatherPeer'])
        self.assertTrue(self.page.evaluate('state.charts.every(c=>c.data.datasets.every(ds=>ds.data[0].x===0))'))

    def test_exchange_reverses_same_time_difference_and_refreshes_query_results(self):
        self.page.locator('[data-step="1"]').click()
        self.page.locator('#experimentPurpose').select_option('parallel')
        self.page.locator('#hiveUseWeather').uncheck()
        self.page.locator('#peerUseWeather').uncheck()
        rows = 'timestamp,temperature,humidity,co2\n' + ''.join(
            f'2026-07-01 {hour:02d}:00:00,{20+hour},{50+hour},{3000+hour*10}\n' for hour in range(24))
        self.page.locator('#peerFile').set_input_files({'name': 'simultaneous.csv', 'mimeType': 'text/csv', 'buffer': rows.encode()})
        self.page.wait_for_function("state.peer?.batches[0].name==='simultaneous.csv'")
        self.page.locator('#sourceNext').click()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.page.locator('#overviewView').select_option('difference')
        self.page.wait_for_function("state.renderMode==='difference'&&!state.dirty")
        values = self.page.evaluate("state.differences.filter(r=>r.source==='peer'&&r.key==='co2').map(r=>r.value)")
        self.assertTrue(values and all(value == -2000 for value in values))
        self.page.locator('#swapExperiments').click()
        self.page.wait_for_function("sourceName('hive')==='九月實驗'&&!state.dirty")
        self.assertEqual(self.page.evaluate("state.differences.filter(r=>r.source==='peer'&&r.key==='co2').map(r=>r.value)"), [-value for value in values])
        self.assertEqual(self.page.evaluate('queryRows.length'), 0)
        self.assertFalse(self.page.locator('#queryResults').is_visible())
        with self.page.expect_download() as downloaded:
            self.page.locator('#downloadCsv').click()
        self.assertIn('2000', Path(downloaded.value.path()).read_text(encoding='utf-8-sig'))

    def test_mobile_sources_navigation_downloads_and_no_overflow(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.fill_color('#panelColor-peer-co2', '#2468ac')
        self.page.locator('#sourceShown-weatherPeer').uncheck()
        self.page.locator('#overviewView').select_option('daily')
        self.page.wait_for_function("state.renderMode==='daily'&&!state.dirty")
        self.page.locator('#nextResultChart').click()
        self.page.locator('#swapExperiments').click()
        self.assertTrue(self.page.locator('#sourceShown-weather').is_checked() is False)
        with self.page.expect_download() as downloaded:
            self.page.locator('#downloadCurrentPng').click()
        self.assertTrue(Path(downloaded.value.path()).stat().st_size > 1000)
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.expose('#imageOptions').click()
        self.assertEqual(self.page.locator('#settingsTab-3').get_attribute('aria-selected'), 'true')
        self.assertTrue(self.page.locator('#exportWidth').is_visible())

    def test_default_metric_colors_and_compact_source_controls(self):
        expected = {'temp': '#d9433f', 'humidity': '#2878b8', 'co2': '#2ca02c'}
        self.assertEqual(self.page.evaluate('Object.fromEntries(keys.map(k=>[k,state.metrics[k].color]))'), expected)
        self.assertEqual(self.page.evaluate('state.co2Chart.data.datasets.map(ds=>ds.borderColor)'), [expected['co2']]*4)
        self.assertEqual(self.page.locator('#resultsTools input[type=color]').count(), 0)
        self.assertFalse(self.page.locator('#workspaceModeBar').is_visible())
        self.assertFalse(self.page.locator('#experimentContext').is_visible())
        self.page.locator('#resultPeriodDetails > summary').click()
        self.assertTrue(self.page.locator('#experimentContext').is_visible())
        self.assertIn('2026-07-01', self.page.locator('#experimentContext').inner_text())
        self.page.locator('#resultPeriodDetails > summary').click()
        self.page.locator('#openStyle').click()
        self.page.locator('#panelColor-peer-co2').fill('#abcdef')
        self.page.locator('#panelColor-peer-co2').dispatch_event('change')
        self.expose('#resetLineColors').click()
        self.page.wait_for_function("state.co2Chart.data.datasets.every(ds=>ds.borderColor==='#2ca02c')")
        self.assertEqual(self.page.locator('#panelColor-peer-co2').input_value(), expected['co2'])
        self.page.locator('#closeStyle').click()
        self.page.locator('#overviewView').select_option('combined')
        self.page.locator('#hiveOriginConfirmed').check()
        self.page.locator('#peerOriginConfirmed').check()
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.assertTrue(self.page.evaluate('state.charts[0].data.datasets.every(ds=>ds.borderColor===defaultMetricColors[ds.metricKey])'))

    def test_all_chart_modes_are_available_in_step_two(self):
        self.page.locator('[data-step="2"]').click()
        options = self.page.locator('#overviewView option').evaluate_all('nodes=>nodes.filter(n=>!n.hidden).map(n=>n.value)')
        self.assertEqual(set(options), {'continuous', 'co2hour', 'combined', 'daily', 'overlay', 'difference', 'rainfall'})
        self.page.wait_for_function("document.querySelector('#overviewView option[value=difference]').disabled")
        for mode in ['combined','daily','overlay','rainfall','co2hour']:
            with self.subTest(mode=mode):
                self.page.locator('#overviewView').select_option(mode)
                self.assertEqual(self.page.evaluate("value('chartMode')"), mode)
                self.assertEqual(self.page.evaluate('workspaceStage'), 2)
                if mode in ['overlay','rainfall']:
                    self.assertTrue(self.page.locator('#resultModeOptions').is_visible())
                    self.assertTrue(self.page.locator('#resultModeOptions').evaluate('el=>el.open'))
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.assertTrue(self.page.evaluate('Boolean(state.co2Chart)'))
