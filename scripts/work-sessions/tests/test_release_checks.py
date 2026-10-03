import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from run_release_checks import coverage_values, result_for


def summary(covered=100, total=100, percentage='100'):
    return '\n'.join(f'{key} : {percentage}% ( {covered}/{total} )'
                     for key in ('Statements', 'Branches', 'Functions', 'Lines'))


class ReleaseChecksTests(unittest.TestCase):
    def test_requires_real_test_execution_and_successful_commands(self):
        for name in ('rust', 'python', 'extension', 'coverage'):
            output = summary() if name == 'coverage' else '0 tests executed'
            self.assertEqual(result_for(name, [0], [output])[0], 'failed')
        self.assertEqual(result_for('rust', [0], ['test result: ok. 12 passed; 0 failed;'])[0], 'passed')
        self.assertEqual(result_for('extension', [0, 1], ['compiled', 'Tests 12 passed (12)'])[0], 'failed')
        self.assertEqual(result_for('python', [0, 0], ['Ran 12 tests', 'Ran 3 tests'])[0], 'passed')
        self.assertEqual(result_for('python', [0, 0], ['Ran 12 tests', ''])[0], 'failed')

    def test_coverage_requires_all_four_counts_not_a_rounded_display(self):
        self.assertEqual(result_for('coverage', [0], ['Tests 12 passed (12)\n' + summary()])[0], 'passed')
        for output in (summary(99), summary(99999, 100000)):
            self.assertEqual(result_for('coverage', [0], ['Tests 12 passed (12)\n' + output])[0], 'failed')
        for output in ('', summary(0, 0), summary(101, 100), summary() + '\n' + summary()):
            with self.assertRaises(ValueError):
                coverage_values(output)


if __name__ == '__main__':
    unittest.main()
