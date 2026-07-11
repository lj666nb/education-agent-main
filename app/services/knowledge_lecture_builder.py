"""Read deployment-safe, source-original lectures for learning-path points."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


LECTURE_SEED_PATH = Path(__file__).resolve().parents[1] / "seed_data" / "knowledge_lectures.json"


@dataclass(frozen=True)
class LectureSource:
    mode: str
    chapter: str
    url: str


@lru_cache(maxsize=1)
def _lecture_seed() -> dict[str, dict[str, str]]:
    payload = json.loads(LECTURE_SEED_PATH.read_text(encoding="utf-8"))
    lectures = payload.get("lectures", {})
    if not lectures:
        raise RuntimeError(f"Knowledge lecture seed is empty: {LECTURE_SEED_PATH}")
    return lectures


def get_lecture_source(point_name: str, domain_name: str = "") -> LectureSource:
    entry = _lecture_seed().get(point_name)
    if not entry:
        raise KeyError(f"No source-original lecture mapped for {domain_name}/{point_name}")
    return LectureSource(
        mode=entry.get("source_mode", "reference_original"),
        chapter=entry.get("source_title", domain_name or point_name),
        url=entry["source_url"],
    )


def build_source_based_lecture(
    *,
    subject_name: str,
    domain_name: str,
    point_name: str,
    description: str,
) -> str:
    """Return the prebuilt reference excerpt paired to this exact point.

    Parameters are intentionally kept compatible with the previous generated
    lecture builder so deployment seeding and the no-LLM API path stay stable.
    """
    del subject_name, description
    entry = _lecture_seed().get(point_name)
    if not entry:
        raise KeyError(f"No source-original lecture mapped for {domain_name}/{point_name}")
    return entry["content"]


def build_lecture_prompt(
    *,
    subject_name: str,
    domain_name: str,
    point_name: str,
    description: str,
) -> str:
    """Build an optional personalization prompt anchored to the public seed."""
    source = get_lecture_source(point_name, domain_name)
    original = build_source_based_lecture(
        subject_name=subject_name,
        domain_name=domain_name,
        point_name=point_name,
        description=description,
    )
    return f"""你是数据结构课程助教。请基于下方参考来源原文，为知识点补充个性化学习提示。

学科：{subject_name}
章节：{domain_name}
知识点：{point_name}
知识图谱描述：{description or '无'}
参考来源：{source.chapter}（{source.url}）

要求：
- 保留原文的事实、公式、代码和图片链接，不得改写成另一份通用讲义。
- 只在原文后追加“学习提示”和“自测问题”两个小节。
- 明确区分来源原文与新增提示，输出 Markdown。

参考来源原文：

{original}
"""
