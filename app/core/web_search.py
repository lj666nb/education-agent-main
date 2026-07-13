"""
Web Search Service — 联网搜索 + 结构化引用

架构：
- TavilySearchService（主力）：专为 LLM 设计，返回清洗好的内容
- DashScopeSearchService（fallback）：阿里云 DashScope MCP WebSearch
- 自动选择：Tavily 可用 → Tavily；否则 → DashScope

返回统一格式：
  List[WebSearchResult] — 包含 title, url, snippet
  build_citations_array() → 前端引用渲染用
  build_citation_context() → LLM 系统提示注入用
"""

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# 数据结构
# ═══════════════════════════════════════════

@dataclass
class WebSearchResult:
    """统一的搜索结果格式，不论后端"""
    title: str
    url: str
    snippet: str


# ═══════════════════════════════════════════
# 搜索后端抽象
# ═══════════════════════════════════════════

class BaseSearchService(ABC):
    @abstractmethod
    async def search(self, query: str, max_results: int = 5) -> List[WebSearchResult]:
        ...


# ═══════════════════════════════════════════
# Tavily 搜索（主力）
# ═══════════════════════════════════════════

class TavilySearchService(BaseSearchService):
    """Tavily Search API — 专为 LLM RAG 场景设计

    API: POST https://api.tavily.com/search
    Docs: https://docs.tavily.com/
    """

    BASE_URL = "https://api.tavily.com/search"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def search(self, query: str, max_results: int = 5) -> List[WebSearchResult]:
        """执行 Tavily 搜索"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    self.BASE_URL,
                    json={
                        "query": query,
                        "search_depth": settings.TAVILY_SEARCH_DEPTH,
                        "max_results": min(max_results, settings.TAVILY_MAX_RESULTS),
                        "include_answer": False,
                    },
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )

                if resp.status_code != 200:
                    logger.warning(f"Tavily 搜索失败: HTTP {resp.status_code} — {resp.text[:200]}")
                    return []

                data = resp.json()
                results = data.get("results", [])

                return [
                    WebSearchResult(
                        title=r.get("title", "未知"),
                        url=r.get("url", ""),
                        snippet=r.get("content", "")[:300],
                    )
                    for r in results[:max_results]
                ]

        except httpx.TimeoutException:
            logger.warning("Tavily 搜索超时")
            return []
        except Exception as e:
            logger.warning(f"Tavily 搜索异常: {e}")
            return []


# ═══════════════════════════════════════════
# DashScope MCP WebSearch（fallback）
# ═══════════════════════════════════════════

class DashScopeSearchService(BaseSearchService):
    """阿里云 DashScope MCP WebSearch — 通过 pydantic_ai Agent 调用

    注意：这是 fallback 方案，Tavily 效果更好且更稳定。
    """

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def search(self, query: str, max_results: int = 5) -> List[WebSearchResult]:
        try:
            from pydantic_ai import Agent
            from pydantic_ai.mcp import MCPServerStreamableHTTP

            mcp_server = MCPServerStreamableHTTP(
                url=settings.WEB_SEARCH_URL,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=30.0,
            )

            agent = Agent(
                model=f"deepseek:{settings.WEB_SEARCH_MODEL}",
                mcp_servers=[mcp_server],
                system_prompt=(
                    "你是一个联网搜索助手。当用户提问时，你需要使用 bailian_web_search 工具搜索相关信息，"
                    "并以 JSON 数组格式返回搜索结果，每条结果包含 title、url 和 snippet 字段。"
                ),
            )

            async with agent.run_mcp_servers():
                result = await agent.run(
                    f"请用联网搜索搜索：{query}，并以 JSON 数组格式返回结果，每项包含 title、url 和 snippet"
                )
                return self._parse_search_result(result.output, max_results)

        except Exception as e:
            logger.warning(f"DashScope 搜索失败: {e}")
            return []

    def _parse_search_result(self, output: str, max_results: int) -> List[WebSearchResult]:
        """解析 pydantic_ai Agent 的输出（可能是 JSON 或 markdown 包裹的 JSON）"""
        try:
            # 尝试提取 JSON
            json_str = output
            if "```json" in output:
                start = output.find("```json") + 7
                end = output.find("```", start)
                json_str = output[start:end].strip()
            elif "[" in output:
                start = output.find("[")
                end = output.rfind("]") + 1
                json_str = output[start:end]

            results = json.loads(json_str)
            if isinstance(results, list):
                return [
                    WebSearchResult(
                        title=r.get("title", "未知"),
                        url=r.get("url", ""),
                        snippet=r.get("snippet", r.get("content", ""))[:300],
                    )
                    for r in results[:max_results]
                ]
            return []
        except Exception:
            return []


# ═══════════════════════════════════════════
# 工厂函数
# ═══════════════════════════════════════════

def get_search_service(db_api_key: Optional[str] = None) -> Optional[BaseSearchService]:
    """获取最佳可用的搜索服务

    优先级：
    1. 用户配置的 Tavily API Key（来自 API Settings）
    2. 全局 Tavily API Key（来自 .env / docker-compose）
    3. QWEN_API_KEY → DashScope MCP WebSearch
    """
    tavily_key = db_api_key or settings.TAVILY_API_KEY
    if tavily_key:
        return TavilySearchService(tavily_key)

    qwen_key = db_api_key or settings.QWEN_API_KEY
    if qwen_key:
        return DashScopeSearchService(qwen_key)

    return None


# ═══════════════════════════════════════════
# 引用处理工具
# ═══════════════════════════════════════════

def build_citations_array(results: List[WebSearchResult]) -> List[Dict[str, Any]]:
    """构建前端引用渲染所需的数据数组"""
    return [
        {
            "index": i + 1,
            "title": r.title,
            "url": r.url,
            "snippet": r.snippet,
        }
        for i, r in enumerate(results)
    ]


def build_citation_context(results: List[WebSearchResult], query: str) -> str:
    """构建注入 LLM 系统提示的引用材料文本

    返回格式：
    [联网搜索结果 - 共 N 条]
    [citation:1] 标题: xxx
    URL: https://...
    摘要: xxx...
    """
    if not results:
        return ""

    lines = [f"[联网搜索结果 - 共 {len(results)} 条]\n"]
    for i, r in enumerate(results, 1):
        lines.append(f"[citation:{i}] 标题: {r.title}")
        lines.append(f"URL: {r.url}")
        lines.append(f"摘要: {r.snippet}")
        lines.append("")  # 空行分隔

    return "\n".join(lines)


CITATION_SYSTEM_PROMPT = """
**联网搜索已开启。请严格遵守以下规则：**

1. 根据上面提供的搜索材料回答用户问题
2. 在引用某个材料的观点或数据时，必须在句末标注 [citation:X]（X 为材料编号），例如：
   - "湖北工业大学成立于1952年[citation:1]，是一所以工科为主的省属重点大学[citation:2]"
3. 只能引用实际存在的编号，**绝对不要编造不存在的 citation 编号**
4. 如果不同材料的信息有冲突，请如实说明不同来源的说法
5. 回答要自然流畅，不要使用"根据搜索结果"、"搜索材料显示"等字样——像正常回答一样自然地引用
6. 如果搜索结果不包含用户问题的答案，直接说明"搜索结果中没有找到相关信息"，然后基于你的知识回答
"""


async def perform_search_and_build_context(
    query: str,
    api_key: Optional[str] = None,
) -> tuple[List[Dict[str, Any]], str | None]:
    """执行搜索并构建 LLM 上下文

    Returns:
        (citations_array, citation_context_or_none)
        如果搜索失败或无结果，返回 ([], None)
    """
    service = get_search_service(api_key)
    if not service:
        return [], None

    try:
        results = await service.search(query)
        if not results:
            return [], None

        citations = build_citations_array(results)
        context = build_citation_context(results, query)
        return citations, context

    except Exception as e:
        logger.warning(f"搜索执行失败: {e}")
        return [], None
