"""ResourceGenerator - 学习资源生成服务

根据知识点名称，调用 LLM 生成 Markdown 格式的思维导图内容。
生成的 Markdown 可直接由 markmap-lib 渲染为 SVG 思维导图。
"""

import json
import httpx
import logging
from typing import Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

GENERATOR_SYSTEM_PROMPT = """你是一个学习资源生成助手。根据用户指定的知识点，生成 Mermaid mindmap 思维导图。

格式要求：
1. 第一行必须是 "mindmap"（不要带引号）
2. 第二行开始用缩进（2空格或4空格）表示层级
3. 根节点使用 root((知识点名称)) 格式
4. 子节点使用缩进表示层级关系，不需要括号
5. 确保内容准确、条理清晰、层次分明

示例格式：
mindmap
  root((Python 变量类型))
    数字类型
      int 整数
      float 浮点数
      complex 复数
    字符串
      定义 使用引号包裹
      方法 split join replace
    布尔类型
      True False
      逻辑运算 and or not

注意：
- **只输出 Mermaid mindmap 代码，不要额外解释，不要包裹在 ``` 代码块中**
- 内容要适度，每个知识点3-6个子主题
- 考虑知识点的核心概念、分类、原理、应用场景
- 节点文字尽量简洁（每节点不超过20字）
"""

CODE_CASE_SYSTEM_PROMPT = """你是一个代码案例生成助手。根据用户指定的知识点，生成一个完整的可运行代码案例。

输出格式必须是 Markdown，包含以下部分：

# 案例名称

## 案例描述
简要说明这个代码案例要演示的知识点和学习目标。

## 核心知识点
列出本案例涉及的核心知识点。

## 代码
用代码块（带语言标识）包含完整可运行的代码。代码中必须包含：
1. 必要的 import
2. 完整的函数/类定义
3. 示例调用（main 函数或测试代码）
4. 中文注释

## 代码说明
解释代码的关键部分和设计思路。

要求：
- 代码必须是完整的、可独立运行的
- 使用 Python 语言
- 添加中文注释帮助理解
- 只输出 Markdown 内容，不要额外解释
"""

DOCUMENT_SYSTEM_PROMPT = """你是一个学习文档生成助手。根据用户指定的知识点，生成一篇结构化的学习文档。

输出格式必须是 Markdown，包含以下部分：

# 文档标题

## 概述
简要介绍该知识点的背景和重要性。

## 核心概念
详细解释该知识点的核心概念，使用小标题分节。

## 详细内容
用清晰的层次结构展开讲解，包含：
- 定义和原理
- 分类和类型
- 关键特性
- 实际应用场景

## 示例
提供一个或多个具体的示例。

## 总结
对全文的要点总结。

要求：
- 内容深入浅出，适合学生自学
- 使用中文写作
- 适当的 Markdown 格式（标题、列表、粗体、引用等）
- 每节内容充实，不少于 200 字
- 只输出 Markdown 内容，不要额外解释
"""

IMAGE_TEXT_SYSTEM_PROMPT = """你是一个图文讲解生成助手。根据用户指定的知识点，生成图文并茂的讲解内容。

输出格式必须是 Markdown，包含以下部分：

# 标题

## 概述
简要介绍该知识点的背景和重要性。

## 知识点讲解
用文字+插图的方式展开讲解，每个重要概念都配一张示意图。

在需要插图的位置，使用 [PLOT] 标记插入 matplotlib 代码来生成示意图。
[PLOT] 代码的要求：
1. 必须使用 matplotlib 和 numpy
2. 中文标签使用 plt.rcParams 设置字体，**不要使用 fontfamily 参数**（如在 plt.ylabel()、plt.title()、plt.text() 中）
3. 正确的字体设置方式：
   plt.rcParams['font.sans-serif'] = ['Noto Sans CJK SC']
   plt.rcParams['axes.unicode_minus'] = False
4. 图片不要保存到文件（代码中不加 plt.savefig）
5. 设置 plt.figure(figsize=(8, 4)) 控制图片大小
6. 添加必要的标题、标签、图例
7. 图表类型可以是：柱状图、饼图、折线图、散点图、树形图（使用 matplotlib 的 patches 模块画节点）、概念图等
8. 每个 [PLOT] 前用文字描述要展示的内容

重要：每个 [PLOT] 块必须用 [/PLOT] 闭合！写 matplotlib 代码时不要使用 fontfamily 参数！

示例：

## 核心概念

文字描述核心概念...

[PLOT]
import matplotlib.pyplot as plt
plt.rcParams['font.sans-serif'] = ['Noto Sans CJK SC']
plt.rcParams['axes.unicode_minus'] = False
import numpy as np

# ... chart code ...
[/PLOT]

## 实际应用

...

## 总结
对全文的要点总结。

要求：
- 内容深入浅出，适合学生自学
- 使用中文写作
- 每个重要概念都配示意图
- 包含 3-6 个 [PLOT] 图表，图表类型多样化
- [PLOT] 代码必须完整可执行
- 每个 [PLOT] 块都必须用 [/PLOT] 闭合，不能遗漏
- [PLOT] 代码不要保存文件，不要调用 plt.show()
- [PLOT] 代码中禁止使用 fontfamily 参数
- 只输出 Markdown 内容，不要额外解释
"""


EXERCISE_SYSTEM_PROMPT = """你是一个练习题生成助手。根据用户指定的知识点，生成一组练习题。

输出格式必须是 Markdown，包含以下部分：

# 标题

简要描述本练习涵盖的知识点。

## 题目1
题目内容（选择题/填空题/判断题等）
A) 选项A
B) 选项B
C) 选项C
D) 选项D
**正确答案: A**
**解析: 对答案的详细解释，说明为什么这个选项正确，其他选项错在哪里**

## 题目2
...

要求：
- 每套练习包含 3-5 道题
- 题型包括选择题、判断题等
- 覆盖基础概念理解、核心原理辨析、实际应用分析
- 正确答案用 **正确答案: X** 标注
- 解析用 **解析: 内容** 标注，要详细说明知识点
- 只输出 Markdown 内容，不要额外解释
"""


class ResourceGenerator:
    """资源生成器：调用 LLM 生成思维导图 Markdown 内容"""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.QWEN_API_KEY or settings.DEEPSEEK_API_KEY
        if api_key and base_url and model:
            # 用户提供了完整的 provider 配置（含 model）
            self.base_url = base_url
            self.model = model
        elif api_key and base_url:
            # 有 key 和 base_url 但无 model，尝试从 base_url 判断
            self.base_url = base_url
            if "deepseek" in base_url.lower():
                self.model = settings.DEEPSEEK_MODEL
            else:
                self.model = settings.QWEN_LIGHT_MODEL
        elif settings.QWEN_API_KEY:
            self.base_url = settings.QWEN_BASE_URL
            self.model = settings.QWEN_LIGHT_MODEL
        else:
            self.base_url = settings.DEEPSEEK_BASE_URL
            self.model = settings.DEEPSEEK_MODEL
        self.timeout = settings.QWEN_TIMEOUT

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        """通用 LLM 调用方法"""
        if not self.api_key:
            logger.warning("未配置 API Key")
            return None
        try:
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": settings.QWEN_TEMPERATURE,
                "max_tokens": settings.QWEN_MAX_TOKENS,
            }
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            if response.status_code != 200:
                logger.error(f"LLM 调用失败: {response.status_code} {response.text}")
                return None
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not content:
                logger.warning("LLM 返回内容为空")
                return None
            content = content.strip()
            if content.startswith("```markdown"): content = content[11:]
            elif content.startswith("```"): content = content[3:]
            if content.endswith("```"): content = content[:-3]
            return content.strip()
        except httpx.TimeoutException:
            logger.error(f"LLM 请求超时 (timeout={self.timeout}s)")
            return None
        except Exception as e:
            logger.error(f"LLM 请求异常: {e}")
            return None

    async def generate_code_case(self, knowledge_points: List[str]) -> Optional[str]:
        """为指定知识点生成代码案例"""
        topic = "、".join(knowledge_points)
        user_prompt = f"请为我生成一个关于「{topic}」的 Python 代码案例，包含完整可运行的代码和中文注释。"
        return await self._call_llm(CODE_CASE_SYSTEM_PROMPT, user_prompt)

    async def generate_document(self, knowledge_points: List[str]) -> Optional[str]:
        """为指定知识点生成学习文档"""
        topic = "、".join(knowledge_points)
        user_prompt = f"请为我生成一篇关于「{topic}」的详细学习文档，适合学生自学使用。"
        return await self._call_llm(DOCUMENT_SYSTEM_PROMPT, user_prompt)

    async def generate_exercise(self, knowledge_points: List[str]) -> Optional[str]:
        """为指定知识点生成练习题"""
        topic = "、".join(knowledge_points)
        user_prompt = f"请为知识点「{topic}」生成一套练习题，包含 3-5 道选择题，覆盖基础概念、原理辨析和应用分析。"
        return await self._call_llm(EXERCISE_SYSTEM_PROMPT, user_prompt)

    async def generate_mindmap(self, knowledge_points: List[str]) -> Optional[str]:
        """为指定知识点生成思维导图 Markdown 内容"""
        topic = "、".join(knowledge_points)
        user_prompt = f"请为我生成关于「{topic}」的思维导图内容，覆盖核心概念、分类、原理和应用场景。"
        return await self._call_llm(GENERATOR_SYSTEM_PROMPT, user_prompt)

    async def generate_image_text(self, knowledge_points: List[str]) -> Optional[str]:
        """为指定知识点生成图文讲解内容（含 [PLOT] 代码块）"""
        topic = "、".join(knowledge_points)
        user_prompt = (
            f"请为知识点「{topic}」生成一篇图文并茂的讲解内容。\n\n"
            f"要求：\n"
            f"1. 内容包含详细的文字讲解\n"
            f"2. 在关键概念处使用 [PLOT]...[/PLOT] 插入 matplotlib 代码生成示意图\n"
            f"3. 包含 3-6 个不同类型的图表（柱状图、饼图、树状图、概念图等）\n"
            f"4. 图表使用中文标签\n"
            f"5. 所有 [PLOT] 代码必须完整可运行\n"
            f"6. [PLOT] 代码不要保存文件到磁盘，不调用 plt.show()\n\n"
            f"知识点：{topic}"
        )
        return await self._call_llm(IMAGE_TEXT_SYSTEM_PROMPT, user_prompt)
