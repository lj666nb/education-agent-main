import unittest

from app.seed_data.coding_oj_catalog import CATALOG, merge_curated_coding_questions


class CodingOjCatalogTests(unittest.TestCase):
    def setUp(self):
        point_names = {item["primary_knowledge_point_name"] for item in CATALOG}
        self.point_ids = {
            name: f"00000000-0000-0000-0000-{index:012d}"
            for index, name in enumerate(sorted(point_names), start=1)
        }

    def test_full_seed_programming_rows_are_replaced_with_judge_cases(self):
        full_seed_rows = [
            {"id": "objective-1", "type": "single_choice"},
            {"id": "exported-code-1", "type": "programming", "test_cases": []},
        ]

        merged = merge_curated_coding_questions(full_seed_rows, self.point_ids)
        programming = [item for item in merged if item.get("type") == "programming"]

        self.assertEqual(21, len(programming))
        self.assertEqual(["objective-1"], [item["id"] for item in merged if item.get("type") != "programming"])
        for problem in programming:
            public_cases = [case for case in problem["test_cases"] if case["is_public"]]
            hidden_cases = [case for case in problem["test_cases"] if not case["is_public"]]
            self.assertGreaterEqual(len(public_cases), 1, problem["content"]["stem"])
            self.assertGreaterEqual(len(hidden_cases), 1, problem["content"]["stem"])

    def test_catalog_has_unique_problem_and_learning_slots(self):
        merged = merge_curated_coding_questions([], self.point_ids)
        ids = [item["id"] for item in merged]
        slots = [(item["primary_knowledge_point_id"], item["difficulty"]) for item in merged]

        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(slots), len(set(slots)))


if __name__ == "__main__":
    unittest.main()
