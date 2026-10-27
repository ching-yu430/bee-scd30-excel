"""Real Excel imports must leave the user at the chosen data card."""
import unittest

import test_chart_editor as editor_tests


class ImportPositionTests(unittest.TestCase):
    setUpClass = classmethod(editor_tests.ChartEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(editor_tests.ChartEditorTests.tearDownClass.__func__)
    setUp = editor_tests.ChartEditorTests.open_home
    tearDown = editor_tests.ChartEditorTests.tearDown

    def excel_data(self):
        return bytes(self.page.evaluate('''() => {
            const sheet=XLSX.utils.aoa_to_sheet([
                ['日期時間','溫度','濕度','CO2','precipitation'],
                [new Date(2026,6,1,8,0),25,60,1000,1],
                [new Date(2026,6,1,9,0),26,62,1400,2],
                [new Date(2026,6,1,10,0),27,64,1800,3]
            ]);
            const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'實驗');
            return Array.from(new Uint8Array(XLSX.write(book,{type:'array',bookType:'xlsx'})));
        }'''))

    def import_without_jump(self, source, data):
        field = self.page.locator('#' + source + 'File')
        label = field.locator('..')
        label.evaluate("el=>el.scrollIntoView({block:'center',behavior:'instant'})")
        self.page.evaluate('() => new Promise(resolve=>requestAnimationFrame(resolve))')
        before = label.bounding_box()['y']
        scroll_before = self.page.evaluate('scrollY')
        self.assertGreater(scroll_before, 50)
        field.set_input_files({'name': source + '.xlsx', 'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'buffer': data})
        self.page.wait_for_function(f'state.{source}?.rows.length===3')
        self.page.evaluate('() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        self.assertEqual(self.page.evaluate('workspaceStage'), 1)
        self.assertTrue(self.page.locator('#sourceStep').is_visible())
        self.assertGreater(self.page.evaluate('scrollY'), 50)
        self.assertAlmostEqual(label.bounding_box()['y'], before, delta=32)

    def test_desktop_excel_imports_stay_at_each_experiment_and_station(self):
        self.page.set_viewport_size({'width': 1440, 'height': 640})
        self.page.locator('#chooseComparisonMode').click()
        self.page.locator('#hiveUseWeather').check()
        self.page.locator('#peerUseWeather').check()
        data = self.excel_data()
        for source in ['hive', 'peer', 'weather', 'weatherPeer']:
            with self.subTest(source=source):
                self.import_without_jump(source, data)

    def test_mobile_excel_imports_stay_at_both_experiment_cards(self):
        self.page.set_viewport_size({'width': 390, 'height': 700})
        self.page.locator('#chooseComparisonMode').click()
        data = self.excel_data()
        for source in ['hive', 'peer']:
            with self.subTest(source=source):
                self.import_without_jump(source, data)

    def test_quick_import_retains_position_and_explicit_navigation_still_moves_to_top(self):
        self.page.set_viewport_size({'width': 390, 'height': 640})
        self.import_without_jump('hive', self.excel_data())
        self.page.locator('#sourceNext').click()
        self.assertEqual(self.page.evaluate('workspaceStage'), 2)
        self.assertEqual(self.page.evaluate('scrollY'), 0)
