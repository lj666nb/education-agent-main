import json
import re
import httpx
import logging
from typing import Optional, AsyncGenerator

from app.core.config import settings

logger = logging.getLogger(__name__)

CODE_ANALYZE_PROMPT = """你是一个代码可视化推演引擎。请分析以下代码，生成逐步执行追踪JSON。

【题目】
{problem_description}

【代码】
```{language}
{code}
```

【要求】
1. 推理代码执行过程，每步包含：行号、执行的代码行、变量状态、数据结构状态
2. 数据结构类型从以下选择：array, stack, queue, linked_list, tree, graph, heap, hash_table
3. 每步都要解释，最终给出运行结果和代码评价
4. 严格输出JSON，不要加代码块标记（不要 ```json）
5. 数据结构状态的elements字段用简化表示（数组用[...]，栈用列表，树用嵌套对象{{"val": ..., "left": ..., "right": ...}}）

输出格式：
{{
  "steps": [
    {{
      "step": 1,
      "line": 3,
      "line_code": "stack = []",
      "action": "创建空栈",
      "variables": {{"stack": []}},
      "data_structure": {{
        "type": "stack",
        "elements": [],
        "top": -1
      }},
      "explanation": "初始化空栈，用于存储中间计算结果"
    }}
  ],
  "result": {{"output": "-47"}},
  "summary": "代码正确实现了后缀表达式求值"
}}"""


class CodeAnalyzer:
    """使用 Qwen/DeepSeek API 分析代码并生成执行追踪（SSE流式）。"""

    def __init__(self, api_key: str, base_url: str, model: str):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    async def analyze_stream(
        self,
        code: str,
        problem_description: str,
        language: str = "python",
    ) -> AsyncGenerator[str, None]:
        """流式返回 SSE 事件字符串（不含 "data: " 前缀和 "\n\n" 后缀）。"""
        prompt = CODE_ANALYZE_PROMPT.format(
            problem_description=problem_description[:2000],
            code=code[:3000],
            language=language,
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "你是代码推演引擎。只输出JSON对象，不要加代码块标记。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 8192,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )

            if response.status_code != 200:
                yield json.dumps({"type": "error", "content": f"AI 调用失败: {response.status_code}"})
                return

            result = response.json()
            content = result["choices"][0]["message"]["content"]
            trace = self._parse_trace(content)

            if not trace or not trace.get("steps"):
                yield json.dumps({"type": "error", "content": "AI 返回数据解析失败，请重试"})
                return

            # 发送状态
            yield json.dumps({"type": "status", "content": "代码结构分析完成，开始推演执行过程..."})

            # 逐步发送
            for step in trace.get("steps", []):
                yield json.dumps({"type": "step", "data": step})

            # 发送完成
            yield json.dumps({
                "type": "complete",
                "result": trace.get("result", {}),
                "summary": trace.get("summary", ""),
            })

    def _parse_trace(self, content: str) -> Optional[dict]:
        """解析 AI 返回的 JSON 追踪数据，处理常见格式问题。"""
        content = content.strip()
        content = re.sub(r'^```(?:json)?\s*', '', content)
        content = re.sub(r'\s*```$', '', content)

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # 提取 JSON 对象
        obj_start = content.find("{")
        obj_end = content.rfind("}")
        if obj_start != -1 and obj_end != -1:
            try:
                return json.loads(content[obj_start:obj_end + 1])
            except json.JSONDecodeError:
                pass

        # 尝试 raw_decode 逐个提取（处理截断）
        if obj_start != -1:
            decoder = json.JSONDecoder()
            try:
                obj, _ = decoder.raw_decode(content, obj_start)
                if isinstance(obj, dict) and "steps" in obj:
                    return obj
            except json.JSONDecodeError:
                pass

        return None
