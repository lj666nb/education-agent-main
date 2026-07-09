"""LLM 调用助手

封装对 DeepSeek API 的调用，供各 Agent 使用。
支持系统级 API Key 和用户级 API Key（从数据库读取）。
"""

import json
import httpx
import logging
from typing import Optional, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMHelper:
    """LLM 调用助手，支持运行时指定 API Key"""

    def __init__(self):
        self._default_api_key = settings.DEEPSEEK_API_KEY
        self._default_base_url = settings.DEEPSEEK_BASE_URL or settings.DEFAULT_LLM_BASE_URL
        self._default_model = settings.DEEPSEEK_MODEL or settings.DEFAULT_LLM_MODEL
        self.timeout = 60.0

    async def chat(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Optional[str]:
        """调用 LLM API 进行对话

        Args:
            api_key: 可覆盖系统默认 API Key
            base_url: 可覆盖系统默认 base_url
            model: 可覆盖系统默认 model
        """
        # 使用传入的或默认的配置
        effective_api_key = api_key or self._default_api_key
        effective_base_url = base_url or self._default_base_url
        effective_model = model or self._default_model

        if not effective_api_key:
            logger.error("LLM API Key 未配置（请在 .env 或 docker-compose 中设置 DEEPSEEK_API_KEY）")
            return None

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        payload = {
            "model": effective_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if response_format:
            payload["response_format"] = response_format

        try:
            headers = {
                "Authorization": f"Bearer {effective_api_key}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{effective_base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )

            if response.status_code != 200:
                logger.error(f"LLM 调用失败: {response.status_code} {response.text[:200]}")
                return None

            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return content.strip() if content else None

        except httpx.TimeoutException:
            logger.error(f"LLM 请求超时 (timeout={self.timeout}s)")
            return None
        except Exception as e:
            logger.error(f"LLM 请求异常: {e}", exc_info=True)
            return None

    async def chat_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """调用 LLM API 并解析 JSON 响应"""
        content = await self.chat(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key,
            base_url=base_url,
            model=model,
        )
        if not content:
            return None
        return self._parse_json(content)

    def _parse_json(self, content: str) -> Optional[Dict[str, Any]]:
        """从 LLM 回复中提取 JSON"""
        try:
            if content.strip().startswith("{"):
                return json.loads(content.strip())
            if "```json" in content:
                start = content.find("```json") + 7
                end = content.find("```", start)
                return json.loads(content[start:end].strip())
            if "```" in content:
                start = content.find("```") + 3
                end = content.find("```", start)
                return json.loads(content[start:end].strip())
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"JSON 解析失败: {e}, content[:100]={content[:100]}")
        return None


_llm_helper: Optional[LLMHelper] = None


def get_llm() -> LLMHelper:
    global _llm_helper
    if _llm_helper is None:
        _llm_helper = LLMHelper()
    return _llm_helper
