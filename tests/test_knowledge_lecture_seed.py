import json
import re
from pathlib import Path

from app.services.knowledge_lecture_builder import (
    build_source_based_lecture,
    get_lecture_source,
)


ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "app" / "seed_data" / "data_structures_seed.json"
LECTURE_PATH = ROOT / "app" / "seed_data" / "knowledge_lectures.json"
PUBLIC_PATH = ROOT / "frontend" / "public"


def _seed():
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


def _lectures():
    return json.loads(LECTURE_PATH.read_text(encoding="utf-8"))["lectures"]


def test_every_data_structure_point_has_a_source_original_lecture():
    point_names = {point["name"] for point in _seed()["knowledge_points"]}
    lectures = _lectures()
    assert point_names == set(lectures)
    assert all(item["source_mode"] == "reference_original" for item in lectures.values())
    assert all(item["source_url"].startswith("https://") for item in lectures.values())


def test_builder_returns_the_versioned_seed_content_for_each_point():
    seed = _seed()
    lectures = _lectures()
    domains = {domain["id"]: domain["name"] for domain in seed["domains"]}
    built = {
        point["name"]: build_source_based_lecture(
            subject_name="数据结构",
            domain_name=domains[point["domain_id"]],
            point_name=point["name"],
            description=point.get("description", ""),
        )
        for point in seed["knowledge_points"]
    }
    assert all(content.strip() for content in built.values())
    assert len(set(built.values())) == len(seed["knowledge_points"])
    assert all(built[name] == lectures[name]["content"] for name in built)


def test_reference_images_are_vendored_into_frontend_public_assets():
    image_urls = set()
    for lecture in _lectures().values():
        image_urls.update(re.findall(r"!\[[^\]]*\]\((/images/lecture-sources/[^)\s]+)", lecture["content"]))
    assert image_urls
    assert all((PUBLIC_PATH / url.lstrip("/")).is_file() for url in image_urls)


def test_previously_uncovered_points_now_use_exact_reference_sources():
    assert get_lecture_source("KMP 算法", "串").mode == "reference_original"
    assert "oi-wiki.org" in get_lecture_source("KMP 算法", "串").url
    assert "oi-wiki.org" in get_lecture_source("并查集", "高级数据结构").url
    assert "Data-Structure-Notes" in get_lecture_source("顺序表", "线性表").chapter
