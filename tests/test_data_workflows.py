"""Regression checks for filtering, axes, queries and event exports."""
from pathlib import Path
import csv
import io
import unittest

import test_chart_editor as editor_tests


class DataWorkflowTests(unittest.TestCase):
    setUpClass = classmethod(editor_tests.ChartEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(editor_tests.ChartEditorTests.tearDownClass.__func__)
    open_home = editor_tests.ChartEditorTests.open_home
    tearDown = editor_tests.ChartEditorTests.tearDown
    expose = editor_tests.ChartEditorTests.expose

    def setUp(self):
        editor_tests.ChartEditorTests.setUp(self)
        self.page.locator('#closeStyle').click()

    def csv_click(self, selector):
        with self.page.expect_download() as download:
            self.page.locator(selector).click()
        return list(csv.DictReader(io.StringIO(Path(download.value.path()).read_text(encoding='utf-8-sig'))))

    def test_raw_and_aggregate_filters_and_axis_annotations(self):
        self.page.locator('[data-step="2"]').click()
        self.page.locator('#aggregation').select_option('hour')
        self.expose('#filterSource').select_option('hive')
        self.expose('#tempOp').select_option('gt')
        self.expose('#tempMin').fill('26')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.assertEqual(self.page.evaluate("state.output.filter(r=>r.source==='hive'&&r.key==='temp').map(r=>r.value)"), [27, 29])
        self.assertEqual(self.page.evaluate("state.output.filter(r=>r.source==='peer'&&r.key==='temp').map(r=>r.value)"), [27, 30])
        self.page.locator('[data-step="2"]').click()
        self.expose('#filterStage').select_option('aggregate')
        self.page.locator('#sourceNext').click()
        self.page.wait_for_function('workspaceStage===3&&!state.dirty')
        self.assertEqual(self.page.evaluate("state.output.filter(r=>r.source==='hive'&&r.key==='temp').map(r=>r.value)"), [29])
        self.page.locator('#openStyle').click()
        self.expose('#referenceMetric').select_option('temp')
        self.expose('#referenceValue').fill('28')
        self.expose('#showMax').check()
        self.expose('#showMin').check()
        self.expose('#showPoints').check()
        self.expose('#pointStyle').select_option('triangle')
        self.expose('#xTickInterval').select_option('custom')
        self.expose('#xTickUnit').select_option('60000')
        self.expose('#xTickCount').fill('30')
        self.page.locator('#applyFormat').click()
        self.assertFalse(self.page.locator('#styleStatus').evaluate('el=>el.classList.contains("has-error")'))
        self.assertTrue(self.page.evaluate('state.charts[0].$researchOptions.showMax&&state.charts[0].$researchOptions.showMin'))
        self.assertEqual(self.page.evaluate('state.charts[0].$researchOptions.referenceValue'), 28)
        self.assertTrue(self.page.evaluate("state.charts[0].data.datasets.every(ds=>ds.pointStyle==='triangle')"))
        self.assertEqual(self.page.evaluate('state.charts[0].scales.x.ticks.length'), 3)
        with self.page.expect_download() as download:
            self.page.locator('#panelDownloadCurrent').click()
        self.assertTrue(Path(download.value.path()).read_bytes().startswith(b'\x89PNG'))

    def test_query_sort_export_event_statistics_and_subset_plot(self):
        self.page.locator('#queryTab').click()
        self.page.locator('#querySource').select_option('hive')
        self.page.locator('#queryMetric').select_option('co2')
        self.page.locator('#queryOp').select_option('gt')
        self.page.locator('#queryMin').fill('1200')
        self.page.locator('#runQuery').click()
        self.page.wait_for_function('queryRows.length===2')
        self.page.locator('#querySort').select_option('co2')
        self.assertEqual(self.page.locator('#queryRows tr').first.locator('td').last.inner_text(), '1800')
        self.page.locator('#openStyle').click()
        rows = self.csv_click('#exportQuery')
        self.assertEqual([row['CO₂（ppm）'] for row in rows], ['1800', '1400'])
        self.page.locator('#closeStyle').click()
        self.expose('#eventGap').fill('3600')
        self.page.locator('#calculateEvents').click()
        self.page.wait_for_function('currentEvents.length===1')
        self.assertEqual(self.page.evaluate('({n:currentEvents[0].n,span:currentEvents[0].spanSeconds,peak:currentEvents[0].peak})'), {'n': 2, 'span': 1800, 'peak': 1800})
        self.page.locator('#openStyle').click()
        events = self.csv_click('#downloadEvents')
        self.assertEqual(events[0]['觀測跨度（秒）'], '1800')
        self.page.locator('#closeStyle').click()
        self.page.locator('#plotQueryResults').click()
        self.page.wait_for_function('workspaceStage===3&&state.querySubset?.hive.size===2&&!state.dirty')
        self.assertEqual(self.page.evaluate('activePlotSources()'), ['hive'])
        self.assertEqual(self.page.evaluate("state.output.filter(r=>r.key==='co2').map(r=>r.value)"), [1400, 1800])
