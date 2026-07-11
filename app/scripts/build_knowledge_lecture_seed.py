"""Build the deployment-safe knowledge-point lecture seed.

The generated JSON contains excerpts from the project's referenced public notes.
Referenced images are copied/downloaded into the frontend public directory so the
same lecture renders on a fresh workstation or server without hot-linking.

Usage:
    python app/scripts/build_knowledge_lecture_seed.py \
        --core-repo /path/to/Data-Structure-Notes
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "app" / "seed_data" / "knowledge_lectures.json"
IMAGE_OUTPUT = ROOT / "frontend" / "public" / "images" / "lecture-sources"
CORE_SITE = "https://ri-nai-bit-se.github.io/Data-Structure-Notes/数据结构"
OI_RAW = "https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs"
OI_SITE = "https://oi-wiki.org"


@dataclass(frozen=True)
class CoreSpec:
    chapter: str
    headings: tuple[tuple[str, int], ...]
    include_children: bool = True


@dataclass(frozen=True)
class RemoteSpec:
    path: str
    headings: tuple[tuple[str, int], ...] = ()
    include_children: bool = True
    preamble: bool = False


def h(text: str, occurrence: int = 0) -> tuple[str, int]:
    return text, occurrence


CORE_SPECS: dict[str, CoreSpec] = {
    "数据结构基本概念": CoreSpec("绪论", (h("## 主要内容"), h("## 基本术语"))),
    "逻辑结构与存储结构": CoreSpec("绪论", (h("## 数据结构的分类"),)),
    "抽象数据类型": CoreSpec("绪论", (h("### 抽象数据类型（ADT）"),)),
    "线性表定义": CoreSpec("线性表", (h("## 线性表的定义"),)),
    "顺序表": CoreSpec("线性表", (h("## 顺序表"),)),
    "单链表": CoreSpec("线性表", (h("## 单链表"), h("### 单链表的特点"), h("### 单链表的性能")), False),
    "循环链表": CoreSpec("线性表", (h("### 循环链表"),)),
    "双向链表": CoreSpec("线性表", (h("### 双向链表"),)),
    "栈的定义": CoreSpec("栈和队列", (h("## 栈"), h("### 顺序栈"), h("### 链式栈")), False),
    "栈的应用": CoreSpec("栈和队列", (h("### 应用", 0),)),
    "队列定义": CoreSpec("栈和队列", (h("## 队列"), h("### 顺序队列"), h("### 链式队列")), False),
    "循环队列": CoreSpec("栈和队列", (h("#### 循环队列"),)),
    "递归与栈": CoreSpec("栈和队列", (h("### 应用", 0),)),
    "数组顺序存储": CoreSpec("数组和广义表", (h("## 数组"), h("### 一维数组")), False),
    "行优先存储": CoreSpec("数组和广义表", (h("#### 二维数组"),)),
    "对称矩阵压缩": CoreSpec("数组和广义表", (h("#### 对称矩阵行优先压缩存储上三角矩阵"), h("#### 对称矩阵列优先压缩存储下三角矩阵"))),
    "三角矩阵压缩": CoreSpec("数组和广义表", (h("#### 三对角矩阵"),)),
    "稀疏矩阵": CoreSpec("数组和广义表", (h("### 稀疏矩阵"),)),
    "树的基本概念": CoreSpec("树和二叉树", (h("## 树"),)),
    "二叉树定义": CoreSpec("树和二叉树", (h("## 二叉树"),), False),
    "二叉树性质": CoreSpec("树和二叉树", (h("### 二叉树的性质"), h("### 特殊二叉树"))),
    "二叉树遍历": CoreSpec("树和二叉树", (h("### 二叉树的遍历"),)),
    "哈夫曼树": CoreSpec("树和二叉树", (h("### Huffman 树"),)),
    "图的定义": CoreSpec("图", (h("## 图的基本概念"),)),
    "邻接矩阵": CoreSpec("图", (h("### 邻接矩阵"),)),
    "邻接表": CoreSpec("图", (h("### 邻接表"),)),
    "最小生成树": CoreSpec("图", (h("## 最小生成树"),)),
    "最短路径": CoreSpec("图", (h("## 最短路径"),)),
    "拓扑排序": CoreSpec("图", (h("### AOV 网络与拓扑排序"),)),
    "顺序查找": CoreSpec("查找", (h("### 顺序查找"), h("### 有序顺序表的顺序查找"))),
    "折半查找": CoreSpec("查找", (h("### 折半查找"),)),
    "二叉排序树": CoreSpec("查找", (h("## 二叉查找树"),)),
    "AVL 树": CoreSpec("查找", (h("## AVL 树"),)),
    "B 树和 B+ 树": CoreSpec("查找", (h("## B 树"),)),
    "哈希表": CoreSpec("查找", (h("## 散列表"),)),
    "排序基本概念": CoreSpec("排序", (h("## 排序的相关概念"),)),
    "直接插入排序": CoreSpec("排序", (h("### 直接插入排序"),)),
    "快速排序": CoreSpec("排序", (h("### 快速排序"),)),
    "堆排序": CoreSpec("排序", (h("### 堆排序"),)),
    "归并排序": CoreSpec("排序", (h("## 归并排序"),)),
    "排序稳定性": CoreSpec("排序", (h("## 排序的相关概念"),)),
    "排序复杂度比较": CoreSpec("排序", (h("#### 排序方法性能比较"),)),
}


REMOTE_SPECS: dict[str, RemoteSpec] = {
    "时间复杂度分析": RemoteSpec("basic/complexity.md", (h("## 时间复杂度"), h("## 渐近符号的定义"))),
    "空间复杂度分析": RemoteSpec("basic/complexity.md", (h("## 空间复杂度"),)),
    "串的定义": RemoteSpec("string/basic.md", (h("## 定义"),)),
    "子串与模式匹配": RemoteSpec("string/match.md", (h("## 字符串匹配问题"),)),
    "朴素模式匹配": RemoteSpec("string/match.md", (h("## 暴力做法"),)),
    "KMP 算法": RemoteSpec("string/kmp.md", (h("### 在字符串中查找子串：Knuth–Morris–Pratt 算法"),)),
    "next 数组": RemoteSpec("string/kmp.md", (h("## 前缀函数"), h("## 计算前缀函数的高效算法"))),
    "DFS": RemoteSpec("graph/dfs.md", (h("## 引入"), h("## 过程"), h("## 性质"))),
    "BFS": RemoteSpec("graph/bfs.md", (h("## 实现"),), preamble=True),
    "并查集": RemoteSpec("ds/dsu.md", (h("## 引入"), h("## 初始化"), h("## 查询"), h("## 合并"), h("## 复杂度"))),
    "堆与优先队列": RemoteSpec("ds/heap.md", (h("## 堆的分类"),), preamble=True),
    "字典树 Trie": RemoteSpec("string/trie.md", (h("## 定义"), h("## 引入"), h("## 实现"))),
    "线段树": RemoteSpec("ds/seg.md", (h("## 引入"), h("## 线段树的基本结构与建树"), h("## 线段树的区间查询"))),
    "树状数组": RemoteSpec("ds/fenwick.md", (h("## 引入"), h("## 树状数组"))),
    "单调栈与单调队列": RemoteSpec("ds/monotonic-stack.md", (h("## 引入"), h("## 过程"), h("## 应用"))),
}


def strip_frontmatter(text: str) -> str:
    text = text.replace("\r\n", "\n")
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end >= 0:
            text = text[end + 5 :]
    return re.sub(r"^author:.*\n+", "", text).strip()


def extract_section(text: str, heading: str, occurrence: int, include_children: bool) -> str:
    lines = text.splitlines()
    matches = [index for index, line in enumerate(lines) if line.strip() == heading]
    if occurrence >= len(matches):
        raise ValueError(f"Heading not found: {heading!r} occurrence={occurrence}")
    start = matches[occurrence]
    level = len(heading) - len(heading.lstrip("#"))
    end = len(lines)
    for index in range(start + 1, len(lines)):
        match = re.match(r"^(#{1,6})\s+", lines[index])
        if not match:
            continue
        next_level = len(match.group(1))
        if next_level < level or (next_level == level) or (not include_children and next_level > level):
            end = index
            break
    return "\n".join(lines[start:end]).strip()


def extract_preamble(text: str) -> str:
    lines = text.splitlines()
    end = next((i for i, line in enumerate(lines) if re.match(r"^#{1,6}\s+", line)), len(lines))
    return "\n".join(lines[:end]).strip()


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "education-agent-seed-builder"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def safe_image_name(source: str) -> str:
    parsed = urllib.parse.urlparse(source)
    suffix = Path(urllib.parse.unquote(parsed.path)).suffix.lower() or ".bin"
    return f"{hashlib.sha256(source.encode('utf-8')).hexdigest()[:16]}{suffix}"


def localize_images(content: str, *, source_path: str, core_repo: Path | None) -> str:
    IMAGE_OUTPUT.mkdir(parents=True, exist_ok=True)
    pattern = re.compile(r"(!\[[^\]]*\]\()([^\s)]+)([^)]*\))")

    def replace(match: re.Match[str]) -> str:
        original = match.group(2)
        if original.startswith(("data:", "/images/lecture-sources/")):
            return match.group(0)

        if core_repo is not None:
            relative = urllib.parse.unquote(original.split("?", 1)[0]).lstrip("/")
            if relative.startswith("imgs/"):
                source_file = core_repo / "docs" / relative
                if source_file.exists():
                    name = safe_image_name(f"core:{relative}")
                    shutil.copyfile(source_file, IMAGE_OUTPUT / name)
                    return f"{match.group(1)}/images/lecture-sources/{name}{match.group(3)}"

        if source_path:
            base_dir = str(Path(source_path).parent).replace("\\", "/")
            remote_relative = urllib.parse.urljoin(f"{base_dir}/", original.lstrip("./"))
            remote_url = f"{OI_RAW}/{remote_relative}"
            try:
                payload = urllib.request.urlopen(
                    urllib.request.Request(remote_url, headers={"User-Agent": "education-agent-seed-builder"}),
                    timeout=30,
                ).read()
            except Exception as exc:
                raise RuntimeError(f"Failed to vendor lecture image {remote_url}: {exc}") from exc
            name = safe_image_name(remote_url)
            (IMAGE_OUTPUT / name).write_bytes(payload)
            return f"{match.group(1)}/images/lecture-sources/{name}{match.group(3)}"

        return match.group(0)

    return pattern.sub(replace, content)


def compose_lecture(point: str, excerpt: str, source_url: str, source_title: str) -> str:
    return (
        f"# {point}\n\n"
        f"> 以下内容直接收录自参考来源“{source_title}”，仅按知识点截取对应原文章节。\n\n"
        f"{excerpt.strip()}\n\n"
        f"---\n\n[查看参考来源原文]({source_url})\n"
    )


def build(core_repo: Path) -> dict:
    lectures: dict[str, dict[str, str]] = {}
    for point, spec in CORE_SPECS.items():
        file_path = core_repo / "docs" / "数据结构" / spec.chapter / "index.md"
        text = strip_frontmatter(file_path.read_text(encoding="utf-8"))
        excerpt = "\n\n".join(
            extract_section(text, heading, occurrence, spec.include_children)
            for heading, occurrence in spec.headings
        )
        excerpt = localize_images(excerpt, source_path="", core_repo=core_repo)
        source_url = f"{CORE_SITE}/{urllib.parse.quote(spec.chapter)}/"
        lectures[point] = {
            "content": compose_lecture(point, excerpt, source_url, f"Data-Structure-Notes · {spec.chapter}"),
            "source_url": source_url,
            "source_title": f"Data-Structure-Notes · {spec.chapter}",
            "source_mode": "reference_original",
        }

    remote_cache: dict[str, str] = {}
    for point, spec in REMOTE_SPECS.items():
        raw_url = f"{OI_RAW}/{spec.path}"
        text = remote_cache.setdefault(spec.path, strip_frontmatter(fetch_text(raw_url)))
        parts = []
        if spec.preamble:
            parts.append(extract_preamble(text))
        parts.extend(
            extract_section(text, heading, occurrence, spec.include_children)
            for heading, occurrence in spec.headings
        )
        excerpt = localize_images("\n\n".join(filter(None, parts)), source_path=spec.path, core_repo=None)
        page_path = spec.path.removesuffix(".md")
        source_url = f"{OI_SITE}/{page_path}/"
        lectures[point] = {
            "content": compose_lecture(point, excerpt, source_url, f"OI Wiki · {point}"),
            "source_url": source_url,
            "source_title": f"OI Wiki · {point}",
            "source_mode": "reference_original",
        }

    seed_path = ROOT / "app" / "seed_data" / "data_structures_seed.json"
    seed = json.loads(seed_path.read_text(encoding="utf-8"))
    expected = {item["name"] for item in seed["knowledge_points"]}
    missing = sorted(expected - lectures.keys())
    extra = sorted(lectures.keys() - expected)
    if missing or extra:
        raise RuntimeError(f"Lecture mapping mismatch; missing={missing}, extra={extra}")

    return {
        "version": 1,
        "description": "知识点级参考来源原文，随部署注入公共讲义种子。",
        "lectures": lectures,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--core-repo", type=Path, required=True)
    args = parser.parse_args()
    payload = build(args.core_repo.resolve())
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['lectures'])} lectures to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
