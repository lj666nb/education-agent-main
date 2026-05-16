import os
import json
import asyncio
from typing import List, Dict, Optional, Any
from app.core.config import settings

DASHSCOPE_WEBSEARCH_URL = "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp"


class WebSearchService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = DASHSCOPE_WEBSEARCH_URL

    async def search(self, query: str, count: int = 5) -> List[Dict[str, Any]]:
        try:
            from pydantic_ai import Agent
            from pydantic_ai.mcp import MCPServerStreamableHTTP

            mcp_server = MCPServerStreamableHTTP(
                url=self.base_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=30.0,
            )

            agent = Agent(
                model="deepseek:deepseek-chat",
                mcp_servers=[mcp_server],
                system_prompt="你是一个联网搜索助手。当用户提问时，你需要使用bailian_web_search工具搜索相关信息，并简洁地总结搜索结果，返回JSON格式的搜索结果列表，每条结果包含title、url和snippet字段。"
            )

            async with agent.run_mcp_servers():
                result = await agent.run(f"请用联网搜索搜索：{query}，并以JSON数组格式返回结果，每项包含title、url和snippet")
                return self._parse_search_result(result.output)
        except Exception as e:
            raise Exception(f"联网搜索失败: {str(e)}")

    def _parse_search_result(self, output: str) -> List[Dict[str, Any]]:
        try:
            if "```json" in output:
                start = output.find("```json") + 7
                end = output.find("```", start)
                json_str = output[start:end].strip()
            elif "[" in output:
                start = output.find("[")
                end = output.rfind("]") + 1
                json_str = output[start:end]
            else:
                json_str = output.strip()

            results = json.loads(json_str)
            if isinstance(results, list):
                return results[:5]
            return []
        except Exception:
            return []

    def build_search_context(self, query: str, results: List[Dict[str, Any]]) -> str:
        if not results:
            return ""
        context_lines = ["[联网搜索结果]"]
        for i, r in enumerate(results, 1):
            title = r.get("title", "未知")
            url = r.get("url", "")
            snippet = r.get("snippet", r.get("content", ""))
            context_lines.append(f"- [{title}]({url}): {snippet[:150]}...")
        return "\n".join(context_lines)


web_search_service: Optional[WebSearchService] = None


def get_web_search_service() -> Optional[WebSearchService]:
    global web_search_service
    if web_search_service is None:
        api_key = settings.QWEN_API_KEY
        if api_key:
            web_search_service = WebSearchService(api_key)
    return web_search_service


async def enhance_query_with_websearch(
    query: str,
    enable_websearch: bool,
    api_key: Optional[str] = None
) -> str:
    if not enable_websearch:
        return query

    service = get_web_search_service()
    if not service:
        return query

    try:
        results = await service.search(query)
        if results:
            context = service.build_search_context(query, results)
            return f"{query}\n\n请结合以下联网搜索结果回答用户问题：\n{context}"
    except Exception:
        pass

    return query