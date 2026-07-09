"""数据结构笔记 AI 导师 — 苏格拉底式引导教学

POST /api/v1/notes/tutor
  调用 Qwen 大模型，以编程导师身份引导用户理解数据结构概念
  优先使用用户在「API 设置」页面中配置的个人 Qwen API Key
"""

import json
import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from sqlalchemy.orm import Session
from app.api.dependencies import get_current_active_user
from app.core.config import settings
from app.db.database import get_db
from app.crud.api_settings import api_settings_crud

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notes", tags=["Notes Tutor"])

# ── Pydantic Schemas ──

class TutorRequest(BaseModel):
    message: str                          # 用户问题
    chapter_title: Optional[str] = None   # 当前章节标题（如"一、线性表"）
    section_title: Optional[str] = None   # 当前小节标题（如"1.2 链表"）
    section_content: Optional[str] = None # 当前小节内容（截取前 2000 字）
    conversation_history: list[dict] = [] # 对话历史 [{role, content}, ...]

class TutorResponse(BaseModel):
    reply: str
    model: str


# ── 苏格拉底式编程导师系统提示词 ──

TUTOR_SYSTEM_PROMPT = """# 角色设定
你是一位耐心、专业的编程导师，专门帮助初学者通过逐步引导的方式解决编程题目。你的目标是帮助学生理解解题思路，而不是直接提供完整的答案。

# 核心任务
当学生向你提问或提交代码片段时，你需要根据当前题目，进行苏格拉底式的引导式教学。

# 交互规则（必须严格遵守）
1. **禁止直接给完整答案**：绝对不要一次性输出完整的、可直接运行的最终代码。
2. **分步引导**：将解题过程拆解为多个小步骤（如：第一步：理解输入；第二步：设计算法；第三步：写出伪代码；第四步：实现细节）。
3. **检查代码思路**：当学生贴出代码时，先分析其思路是否正确，指出具体位置的问题（如："你在第5行的循环边界条件可能需要再想想"），而不是直接修改代码。
4. **提供示例而非答案**：如果需要展示代码，只能提供类似的代码片段（如"你可以参考这个求和的例子……"）或伪代码。
5. **识别错误类型**：如果学生遇到编译错误或运行错误，先引导学生自己发现（如："运行时提示数组越界，你觉得可能是哪个变量访问了不存在的索引？"）。
6. **鼓励试错**：在学生尝试2-3次仍未通过后，可以逐步给出更明确的提示（如："提示：这里需要使用双指针技巧"）。

# 输出格式要求
- 你的回复应以鼓励和提问为主，语言亲切。
- 每次回复控制在 150-300 字之间，避免长篇大论。
- 适当使用 Emoji（如 💡、🤔、✅）增强互动感。
"""

# 阶段 1：刚看到题目，毫无头绪
STAGE_1_PROMPT = """
当用户首次接触这个概念时，请先引导其理解基本概念，提出以下问题：
- "你能用自己的话解释一下这个数据结构是做什么的吗？"
- "你觉得它和之前学过的数据结构有什么不同？"
- "想一想，这个数据结构最核心的操作是什么？"
"""

# 阶段 2：写了代码但有错误
STAGE_2_PROMPT = """
当用户提交的代码出现问题时，请执行以下流程：
1. 先指出问题的大致类型（如语法错误、逻辑错误、边界问题）。
2. 提示用户关注代码中的具体位置。
3. 提供一个"调试思路"（如："建议你在循环中打印一下这个变量的值，看看是否符合预期"）。
"""

# 阶段 3：代码正确，想优化
STAGE_3_PROMPT = """
当用户理解了基本概念后，可以进一步引导深入：
- "很好！你能分析一下这个操作的时间复杂度吗？"
- "如果数据量增大10倍，你觉得会有什么问题？有没有优化的空间？"
- "你能想到这个数据结构在实际项目中的应用场景吗？"
"""


def build_system_prompt(
    chapter_title: Optional[str] = None,
    section_title: Optional[str] = None,
    section_content: Optional[str] = None,
    attempt_count: int = 0,
) -> str:
    """构建带上下文信息的系统提示词"""
    prompt = TUTOR_SYSTEM_PROMPT

    # 当前学习上下文
    if chapter_title or section_title:
        prompt += "\n\n# 当前学习内容\n"
        if chapter_title:
            prompt += f"学生正在学习章节：{chapter_title}\n"
        if section_title:
            prompt += f"当前小节：{section_title}\n"

    if section_content:
        # 截取前 2500 字符
        truncated = section_content[:2500]
        if len(section_content) > 2500:
            truncated += "\n...(内容已截断)"
        prompt += f"\n## 当前小节的笔记内容\n```\n{truncated}\n```\n"

    # 根据尝试次数动态调整教学策略
    if attempt_count <= 1:
        prompt += f"\n{STAGE_1_PROMPT}"
    elif attempt_count <= 3:
        prompt += f"\n{STAGE_2_PROMPT}"
    else:
        prompt += f"\n{STAGE_3_PROMPT}"

    return prompt


async def _call_qwen(
    system_prompt: str,
    user_message: str,
    conversation_history: list[dict] = [],
    *,
    api_key: str = "",
    base_url: str = "",
    model: str = "",
) -> str:
    """调用 Qwen API

    优先使用传入的 api_key/base_url/model（来自用户个人配置），
    未提供时回退到系统级 settings 配置。
    """
    effective_key = api_key or settings.QWEN_API_KEY
    effective_url = base_url or settings.QWEN_BASE_URL
    effective_model = model or settings.QWEN_MODEL

    if not effective_key:
        raise HTTPException(
            status_code=503,
            detail="Qwen API 未配置，请在「API 设置」页面配置 Qwen API Key"
        )

    # 构建消息列表
    messages = [{"role": "system", "content": system_prompt}]

    # 添加最近的对话历史（最多保留最近 10 轮）
    for msg in conversation_history[-20:]:
        if msg.get("role") in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": effective_model,
        "messages": messages,
        "temperature": settings.QWEN_TEMPERATURE,
        "max_tokens": settings.QWEN_MAX_TOKENS,
    }

    try:
        headers = {
            "Authorization": f"Bearer {effective_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=settings.QWEN_TIMEOUT) as client:
            response = await client.post(
                f"{effective_url}/chat/completions",
                headers=headers,
                json=payload,
            )

        if response.status_code != 200:
            logger.error(f"Qwen API 调用失败: {response.status_code} {response.text[:300]}")
            raise HTTPException(
                status_code=502,
                detail=f"AI 服务调用失败：{response.status_code}"
            )

        result = response.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

        if not content:
            raise HTTPException(status_code=502, detail="AI 返回内容为空")

        return content.strip()

    except httpx.TimeoutException:
        logger.error(f"Qwen API 请求超时 (timeout={settings.QWEN_TIMEOUT}s)")
        raise HTTPException(status_code=504, detail=f"AI 响应超时，请稍后重试")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Qwen API 请求异常: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"AI 服务异常：{str(e)}")


@router.post("/tutor", response_model=TutorResponse)
async def ask_tutor(
    req: TutorRequest,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """向 AI 导师提问

    根据当前学习章节的上下文，AI 导师以苏格拉底式引导教学法回答问题。
    不会直接给出完整答案，而是通过分步引导帮助学生独立思考。

    API Key 优先级：用户个人配置（API 设置页面）> 系统全局配置（.env）
    """
    # 估算尝试次数（基于对话历史中 user 消息数）
    user_msg_count = sum(
        1 for m in req.conversation_history if m.get("role") == "user"
    )
    attempt_count = user_msg_count + 1  # +1 for the current message

    system_prompt = build_system_prompt(
        chapter_title=req.chapter_title,
        section_title=req.section_title,
        section_content=req.section_content,
        attempt_count=attempt_count,
    )

    # 优先使用用户在「API 设置」页面配置的个人 Qwen Key
    user_qwen = api_settings_crud.get_setting_value(
        db, str(current_user.student_id), "qwen"
    )
    api_kwargs = {}
    effective_model = settings.QWEN_MODEL
    if user_qwen:
        api_kwargs["api_key"] = user_qwen["api_key"]
        if user_qwen.get("base_url"):
            api_kwargs["base_url"] = user_qwen["base_url"]
        if user_qwen.get("model_version"):
            effective_model = user_qwen["model_version"]
            api_kwargs["model"] = user_qwen["model_version"]
        logger.info(f"使用用户 {current_user.student_id} 的个人 Qwen API Key")
    else:
        logger.info("使用系统全局 Qwen API 配置")

    reply = await _call_qwen(
        system_prompt=system_prompt,
        user_message=req.message,
        conversation_history=req.conversation_history,
        **api_kwargs,
    )

    return TutorResponse(reply=reply, model=effective_model)
