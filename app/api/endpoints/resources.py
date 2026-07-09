"""个性化学习资源 API

资源类型：思维导图（mind_map），后续可扩展
触发方式：手动生成、AI Chat 盲区检测自动生成、题库答错自动生成

- GET    /resources                列出当前用户所有资源
- GET    /resources/{id}           获取单个资源
- POST   /resources/generate       手动生成思维导图
- PUT    /resources/{id}           更新资源
- DELETE /resources/{id}           删除资源
- GET    /resources/knowledge-points  获取有资源的知识点列表（按知识点分组）
- POST   /resources/auto-generate  自动生成（由 Chat/题库后台触发）
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import logging
import re
import uuid as uuid_gen
import os

from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.database import get_db
from app.api.dependencies import get_current_active_user
from app.core.config import settings as app_settings
from app.models.resource import KnowledgeResource
from app.services.resource_generator import ResourceGenerator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resources", tags=["Learning Resources"])


# ── Pydantic Schemas ──

class ResourceOut(BaseModel):
    id: str
    title: str
    resource_type: str
    knowledge_points: List[str]
    source: Optional[str] = None
    source_ref: Optional[str] = None
    tags: List[str] = []
    created_at: str
    updated_at: str
    content: Optional[str] = None  # 默认不返回，仅详情接口返回

    class Config:
        from_attributes = True


class ResourceListItem(BaseModel):
    id: str
    title: str
    resource_type: str
    knowledge_points: List[str]
    source: Optional[str] = None
    tags: List[str] = []
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ResourceListResponse(BaseModel):
    resources: List[ResourceListItem]
    total: int


class KnowledgePointGroup(BaseModel):
    name: str
    resource_count: int
    resources: List[ResourceListItem]


class KnowledgePointsResponse(BaseModel):
    knowledge_points: List[KnowledgePointGroup]
    total: int


class GenerateRequest(BaseModel):
    knowledge_points: List[str]
    title: Optional[str] = None
    resource_type: Optional[str] = "mind_map"  # mind_map | code_case | document | exercise
    batch_mode: Optional[bool] = None  # True=公开(所有用户可见), None=按默认规则


class GenerateResponse(BaseModel):
    id: str
    title: str
    content: str
    knowledge_points: List[str]


class UpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    knowledge_points: Optional[List[str]] = None


class AutoGenerateRequest(BaseModel):
    knowledge_points: List[str]
    source: str = "chat_gap"  # chat_gap | wrong_answer
    source_ref: Optional[str] = None


class AutoGenerateResponse(BaseModel):
    generated: List[dict]  # [{knowledge_point, resource_id, title}]
    skipped: List[str]     # 已有资源跳过的知识点


# ── Helpers ──

def _resource_to_list_item(r: KnowledgeResource) -> ResourceListItem:
    return ResourceListItem(
        id=str(r.id),
        title=r.title,
        resource_type=r.resource_type,
        knowledge_points=list(r.knowledge_points or []),
        source=r.source,
        tags=list(r.tags or []),
        created_at=r.created_at.isoformat() if r.created_at else "",
        updated_at=r.updated_at.isoformat() if r.updated_at else "",
    )


def _resource_to_out(r: KnowledgeResource) -> ResourceOut:
    return ResourceOut(
        id=str(r.id),
        title=r.title,
        resource_type=r.resource_type,
        knowledge_points=list(r.knowledge_points or []),
        source=r.source,
        source_ref=r.source_ref,
        tags=list(r.tags or []),
        created_at=r.created_at.isoformat() if r.created_at else "",
        updated_at=r.updated_at.isoformat() if r.updated_at else "",
        content=r.content,
    )


PROVIDER_CONFIG = {
    "qwen": {
        "default_base_url": app_settings.QWEN_BASE_URL,
        "default_model": "qwen-plus",
    },
    "deepseek": {
        "default_base_url": app_settings.DEEPSEEK_BASE_URL,
        "default_model": "deepseek-chat",
    },
}

def _get_user_api(db: Session, student_id: str) -> Optional[dict]:
    """获取用户配置的 LLM API Key（含 provider 和 model 信息）

    用户未设置 base_url 时自动填充系统默认值，
    确保请求始终发到正确的 API 端点。
    """
    from app.crud.api_settings import api_settings_crud
    for provider in ["qwen", "deepseek"]:
        api = api_settings_crud.get_setting_value(db, student_id, provider)
        if api:
            cfg = PROVIDER_CONFIG.get(provider, {})
            return {
                "api_key": api.get("api_key"),
                "base_url": api.get("base_url") or cfg.get("default_base_url"),
                "provider": provider,
                "model": api.get("model_version") or cfg.get("default_model", "qwen-turbo-latest"),
            }
    return None


async def _generate_and_save(
    db: Session, student_id: UUID, kp_name: str,
    source: str, source_ref: Optional[str] = None,
    api_info: Optional[dict] = None,
) -> Optional[KnowledgeResource]:
    """生成思维导图并保存到数据库"""
    generator = ResourceGenerator(
        api_key=api_info.get("api_key") if api_info else None,
        base_url=api_info.get("base_url") if api_info else None,
        model=api_info.get("model") if api_info else None,
    )
    content = await generator.generate_mindmap([kp_name])
    if not content:
        return None

    resource = KnowledgeResource(
        user_id=student_id,
        title=f"{kp_name} 思维导图",
        resource_type="mind_map",
        content=content,
        knowledge_points=[kp_name],
        source=source,
        source_ref=source_ref,
        is_public=True,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


# ── Endpoints ──

@router.get("", response_model=ResourceListResponse)
async def list_resources(
    knowledge_point: Optional[str] = None,
    resource_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """列出当前用户的所有资源 + 公开资源（代码案例等），可按知识点过滤"""
    query = db.query(KnowledgeResource).filter(
        (KnowledgeResource.user_id == current_user.student_id) |
        (KnowledgeResource.is_public == True)
    )
    if knowledge_point:
        query = query.filter(
            KnowledgeResource.knowledge_points.op('?')(knowledge_point)
        )
    if resource_type:
        query = query.filter(KnowledgeResource.resource_type == resource_type)

    total = query.count()
    resources = query.order_by(desc(KnowledgeResource.updated_at)).all()

    return ResourceListResponse(
        resources=[_resource_to_list_item(r) for r in resources],
        total=total,
    )


@router.get("/knowledge-points", response_model=KnowledgePointsResponse)
async def list_knowledge_points(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """按知识点分组列出资源"""
    resources = (
        db.query(KnowledgeResource)
        .filter(
            (KnowledgeResource.user_id == current_user.student_id) |
            (KnowledgeResource.is_public == True)
        )
        .order_by(desc(KnowledgeResource.updated_at))
        .all()
    )

    # 按知识点分组
    groups: dict[str, dict] = {}
    for r in resources:
        kps = list(r.knowledge_points or [])
        if not kps:
            kps = ["未分类"]
        for kp in kps:
            if kp not in groups:
                groups[kp] = {"name": kp, "resources": []}
            groups[kp]["resources"].append(_resource_to_list_item(r))

    result = []
    for name, group in groups.items():
        result.append(KnowledgePointGroup(
            name=name,
            resource_count=len(group["resources"]),
            resources=group["resources"],
        ))

    # 按知识点名称排序
    result.sort(key=lambda x: x.name)

    return KnowledgePointsResponse(knowledge_points=result, total=len(result))


@router.get("/{resource_id}", response_model=ResourceOut)
async def get_resource(
    resource_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取单个资源详情（含 content）—— 自己的资源或公开资源均可访问"""
    resource = db.query(KnowledgeResource).filter(
        KnowledgeResource.id == resource_id,
        (KnowledgeResource.user_id == current_user.student_id) |
        (KnowledgeResource.is_public == True),
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")
    return _resource_to_out(resource)


@router.post("/generate", response_model=GenerateResponse)
async def generate_resource(
    req: GenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """手动生成资源（思维导图 / 代码案例等）"""
    if not req.knowledge_points:
        raise HTTPException(status_code=400, detail="请指定至少一个知识点")

    # 获取用户 API Key（含 provider 和 model）
    api_info = _get_user_api(db, str(current_user.student_id))

    kp_text = "、".join(req.knowledge_points)
    generator = ResourceGenerator(
        api_key=api_info.get("api_key") if api_info else None,
        base_url=api_info.get("base_url") if api_info else None,
        model=api_info.get("model") if api_info else None,
    )

    resource_type = req.resource_type or "mind_map"
    type_label = {
        "mind_map": "思维导图", "code_case": "代码案例",
        "document": "文档", "exercise": "练习题",
        "image_text": "图文讲解",
        "video_script": "视频脚本",
    }.get(resource_type, "资源")

    if resource_type == "code_case":
        content = await generator.generate_code_case(req.knowledge_points)
    elif resource_type == "document":
        content = await generator.generate_document(req.knowledge_points)
    elif resource_type == "exercise":
        content = await generator.generate_exercise(req.knowledge_points)
    elif resource_type == "image_text":
        raw_content = await generator.generate_image_text(req.knowledge_points)
        if raw_content:
            # 处理 [PLOT] 代码块：执行 → 保存 PNG → 替换为图片 URL
            from app.api.endpoints.code_execution import _execute_plot
            PLOTS_DIR = os.path.join("uploads", "plots")
            os.makedirs(PLOTS_DIR, exist_ok=True)

            def _fix_plot_code(code: str) -> str:
                """自动修复常见的 matplotlib 代码问题"""
                # 1. 移除 fontfamily=... 参数
                code = re.sub(r',\s*fontfamily\s*=\s*[^,)]*', '', code)
                code = re.sub(r'fontfamily\s*=\s*[^,)]*,?\s*', '', code)
                # 2. 修复 plt.ylabel/plt.xlabel/plt.title 中的 fontfamily
                code = re.sub(r'(plt\.(?:ylabel|xlabel|title|text)\(.*?),?\s*fontfamily\s*=\s*[^,)]*', r'\1', code)
                # 3. 移除 fontproperties= 参数
                code = re.sub(r',\s*fontproperties\s*=\s*[^,)]*', '', code)
                code = re.sub(r'fontproperties\s*=\s*[^,)]*,?\s*', '', code)
                # 4. 修复 ax.set_y(  -> ax.set_ylabel(
                code = re.sub(r'ax\.set_y\(([^)]*)\)', r'ax.set_ylabel(\1)', code)
                # 5. 修复 ax.set_x(  -> ax.set_xlabel(
                code = re.sub(r'ax\.set_x\(([^)]*)\)', r'ax.set_xlabel(\1)', code)
                # 6. 修复 ax.set_titlefont( -> ax.set_title(
                code = re.sub(r'ax\.set_titlefont\(', r'ax.set_title(', code)
                # 7. 尝试编译检查语法
                try:
                    compile(code, '<plot_code>', 'exec')
                    return code
                except SyntaxError as e:
                    # 8. 尝试修复常见语法错误
                    if e.lineno:
                        lines = code.split('\n')
                        if 1 <= e.lineno <= len(lines):
                            bad_line = lines[e.lineno - 1]
                            # 8a. 修复未闭合的字符串
                            for quote in ['"', "'"]:
                                if bad_line.count(quote) % 2 == 1:
                                    lines[e.lineno - 1] = bad_line + quote
                                    break
                        # 8b. 尝试补齐未闭合的括号/花括号
                        full = '\n'.join(lines)
                        opens = full.count('(') + full.count('[') + full.count('{')
                        closes = full.count(')') + full.count(']') + full.count('}')
                        if opens > closes:
                            full += ')' * (opens - closes)
                        try:
                            compile(full, '<plot_code>', 'exec')
                            return full
                        except SyntaxError:
                            pass
                    return code
                except Exception:
                    return code

            def _generate_fallback_chart(title: str = "示意图") -> Optional[str]:
                """生成一个简单的备用图表"""
                try:
                    fallback_code = (
                        "import matplotlib.pyplot as plt\n"
                        "plt.rcParams['font.sans-serif'] = ['Noto Sans CJK SC', 'DejaVu Sans']\n"
                        "plt.rcParams['axes.unicode_minus'] = False\n"
                        "import numpy as np\n"
                        "plt.figure(figsize=(8, 4))\n"
                        "x = np.arange(1, 6)\n"
                        f"plt.bar(x, x**0.5, color='#4CAF50', alpha=0.7)\n"
                        f"plt.title('{title}')\n"
                        "plt.xlabel('X')\n"
                        "plt.ylabel('Y')\n"
                        "plt.grid(True, alpha=0.3)\n"
                    )
                    result = _execute_plot(fallback_code)
                    if result.success and result.image:
                        b64_data = result.image
                        if b64_data.startswith("data:image/png;base64,"):
                            b64_data = b64_data[len("data:image/png;base64,"):]
                        import base64
                        img_bytes = base64.b64decode(b64_data)
                        filename = f"plot_{uuid_gen.uuid4().hex}.png"
                        filepath = os.path.join(PLOTS_DIR, filename)
                        with open(filepath, "wb") as f:
                            f.write(img_bytes)
                        return f"/api/v1/resources/plots/{filename}"
                except Exception as e:
                    logger.error(f"备用图表生成失败: {e}")
                return None
                # 4. 尝试编译检查语法
                try:
                    compile(code, '<plot_code>', 'exec')
                    return code  # 语法正确，直接返回
                except SyntaxError as e:
                    # 5. 尝试修复常见语法错误：未闭合的字符串
                    lines = code.split('\n')
                    if e.lineno and 1 <= e.lineno <= len(lines):
                        bad_line = lines[e.lineno - 1]
                        # 检查行末是否有未闭合的引号
                        for quote in ['"', "'"]:
                            if bad_line.count(quote) % 2 == 1:
                                # 未闭合的引号，尝试添加闭合
                                lines[e.lineno - 1] = bad_line + quote
                                logger.warning(f"修复未闭合字符串: line {e.lineno}")
                                break
                    fixed_code = '\n'.join(lines)
                    try:
                        compile(fixed_code, '<plot_code>', 'exec')
                        return fixed_code
                    except SyntaxError:
                        return code  # 无法修复，返回原始代码
                except Exception:
                    return code

            def _try_execute_plot_with_retry(code: str, max_retries: int = 2) -> Optional[str]:
                """尝试执行 [PLOT] 代码，失败后自动修复并重试"""
                for attempt in range(max_retries + 1):
                    if attempt > 0:
                        # 第一次重试：自动修复
                        code = _fix_plot_code(code)
                    try:
                        result = _execute_plot(code)
                        if result.success and result.image:
                            b64_data = result.image
                            if b64_data.startswith("data:image/png;base64,"):
                                b64_data = b64_data[len("data:image/png;base64,"):]
                            import base64
                            img_bytes = base64.b64decode(b64_data)
                            filename = f"plot_{uuid_gen.uuid4().hex}.png"
                            filepath = os.path.join(PLOTS_DIR, filename)
                            with open(filepath, "wb") as f:
                                f.write(img_bytes)
                            url = f"/api/v1/resources/plots/{filename}"
                            return url
                        else:
                            if attempt < max_retries:
                                logger.warning(f"[PLOT] 第{attempt+1}次失败，准备重试: {result.stderr[:100]}")
                            else:
                                logger.warning(f"[PLOT] 图文讲解图表执行失败(已重试{max_retries}次): {result.stderr[:200]}")
                    except Exception as e:
                        if attempt < max_retries:
                            logger.warning(f"[PLOT] 第{attempt+1}次异常，准备重试: {e}")
                        else:
                            logger.error(f"[PLOT] 处理异常(已重试{max_retries}次): {e}")
                return None

            def _process_plot_block(match: re.Match) -> str:
                code = match.group(1).strip()
                code = re.sub(r'^```[a-zA-Z]*\n?', '', code)
                code = re.sub(r'\n?```$', '', code)

                if not app_settings.ENABLE_PLOT_CODE_EXECUTION:
                    return "\n\n> 图表代码已生成，但当前环境未启用安全沙箱，已跳过自动执行。\n\n"

                # 尝试执行（含自动修复和重试）
                url = _try_execute_plot_with_retry(code)
                if url:
                    return f"\n\n![图表]({url})\n\n"
                # 所有重试失败，使用备用图表
                logger.warning("[PLOT] 所有重试失败，使用备用图表")
                fallback_url = _generate_fallback_chart("数据可视化")
                if fallback_url:
                    return f"\n\n![图表]({fallback_url})\n\n"
                return f"\n\n> ⚠️ 图表生成失败\n\n"

            # 自动闭合未闭合的 [PLOT] 块
            plot_fixed = raw_content
            if plot_fixed.count('[PLOT]') > plot_fixed.count('[/PLOT]'):
                plot_fixed += '\n[/PLOT]'
                logger.warning("检测到未闭合的 [PLOT] 块，自动添加 [/PLOT]")

            content = re.sub(r'\[PLOT\]([\s\S]*?)\[/PLOT\]', _process_plot_block, plot_fixed)
        else:
            content = None
    else:
        content = await generator.generate_mindmap(req.knowledge_points)

    if not content:
        raise HTTPException(
            status_code=502,
            detail=f"{type_label}生成失败，请检查 API 配置是否可用",
        )

    title = req.title or f"{kp_text} {type_label}"
    # 所有资源公开，不同用户都能看到
    is_public = True
    resource = KnowledgeResource(
        user_id=current_user.student_id,
        title=title,
        resource_type=resource_type,
        content=content,
        knowledge_points=req.knowledge_points,
        source="manual",
        is_public=is_public,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    return GenerateResponse(
        id=str(resource.id),
        title=resource.title,
        content=resource.content,
        knowledge_points=list(resource.knowledge_points or []),
    )


@router.put("/{resource_id}", response_model=ResourceOut)
async def update_resource(
    resource_id: UUID,
    req: UpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """更新资源（标题、内容、知识点标签）"""
    resource = db.query(KnowledgeResource).filter(
        KnowledgeResource.id == resource_id,
        KnowledgeResource.user_id == current_user.student_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    if req.title is not None:
        resource.title = req.title
    if req.content is not None:
        resource.content = req.content
    if req.knowledge_points is not None:
        resource.knowledge_points = req.knowledge_points

    db.commit()
    db.refresh(resource)
    return _resource_to_out(resource)


@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """删除资源"""
    resource = db.query(KnowledgeResource).filter(
        KnowledgeResource.id == resource_id,
        KnowledgeResource.user_id == current_user.student_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    db.delete(resource)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/auto-generate", response_model=AutoGenerateResponse)
async def auto_generate_resources(
    req: AutoGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """自动生成资源（由 Chat 盲区检测或题库答错后台触发）

    不会重复生成已有资源的知识点。
    """
    if not req.knowledge_points:
        raise HTTPException(status_code=400, detail="请指定至少一个知识点")

    student_id = current_user.student_id
    generated = []
    skipped = []

    # 获取用户 API Key
    api_info = _get_user_api(db, str(current_user.student_id))

    for kp in req.knowledge_points:
        # 检查是否已有资源关联该知识点
        existing = (
            db.query(KnowledgeResource)
            .filter(
                KnowledgeResource.user_id == student_id,
                KnowledgeResource.knowledge_points.op('?')(kp),
            )
            .first()
        )
        if existing:
            skipped.append(kp)
            continue

        resource = await _generate_and_save(
            db, student_id, kp, req.source, req.source_ref, api_info,
        )
        if resource:
            generated.append({
                "knowledge_point": kp,
                "resource_id": str(resource.id),
                "title": resource.title,
            })
        else:
            skipped.append(kp)

    return AutoGenerateResponse(generated=generated, skipped=skipped)


# ── Unsplash 图片搜索（供前端使用） ──

class UnsplashSearchRequest(BaseModel):
    query: str
    per_page: int = 10
    orientation: str = "landscape"


class UnsplashImageOut(BaseModel):
    id: str
    description: str
    url_raw: str
    url_regular: str
    url_small: str
    url_thumb: str
    author: str
    width: int
    height: int


class UnsplashSearchResponse(BaseModel):
    images: List[UnsplashImageOut]
    total: int


@router.post("/unsplash-search", response_model=UnsplashSearchResponse)
async def search_unsplash_images(
    req: UnsplashSearchRequest,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """搜索 Unsplash 高清图片

    使用当前用户的 Unsplash API 配置进行图片搜索。
    返回的图片可自由用于视频配图、页面背景等场景。
    """
    from app.crud.api_settings import api_settings_crud

    setting = api_settings_crud.get_setting_value(db, str(current_user.student_id), "unsplash")
    access_key = setting.get("api_key") if setting else None

    if not access_key:
        raise HTTPException(
            status_code=400,
            detail="Unsplash 图片服务未配置，请先在 API 设置中配置 Unsplash Access Key",
        )

    from app.services.unsplash_service import UnsplashService
    service = UnsplashService(access_key=access_key)
    results = await service.search_photos(req.query, req.per_page, req.orientation)

    return UnsplashSearchResponse(
        images=[
            UnsplashImageOut(
                id=img["id"],
                description=img["description"],
                url_raw=img["url_raw"],
                url_regular=img["url_regular"],
                url_small=img["url_small"],
                url_thumb=img["url_thumb"],
                author=img["author"],
                width=img["width"],
                height=img["height"],
            )
            for img in results
        ],
        total=len(results),
    )


# ── AI 智能编排笔记 ──

class ComposeNoteRequest(BaseModel):
    resource_ids: List[str]
    topic_name: str

class ComposeNoteResponse(BaseModel):
    composed_note: str  # Markdown

COMPOSE_NOTE_PROMPT = """你是一位资深技术教育作者，擅长将零散的学习资料编排成高质量、结构清晰的技术学习笔记。

请根据以下多个不同类型的资源内容，为知识点「{topic_name}」撰写一篇完整的学习笔记。

编排要求：
1. **标题**：使用一级标题，简洁有力
2. **导语**：1-2句话说明这个知识点的核心价值和适用场景
3. **核心概念**：清晰解释关键定义和原理，由浅入深
4. **图解/结构**：如果资源中有思维导图内容，转换为文字化的结构梳理（用列表或表格呈现知识框架）
5. **代码实战**：如果资源中有代码案例，选取最核心的代码片段，加上详细注释和逐步讲解
6. **重点总结**：列出 3-5 个核心要点
7. **常见误区/面试要点**：如果资源中有相关提示，整理出来
8. **延伸学习**：建议下一步学什么

风格要求：
- 语言通俗易懂，适合自学
- 代码块使用正确的语言标识（```python 等）
- 关键术语首次出现时用**加粗**标注
- 适当使用 > 引用块强调重点
- 整体长度控制在 800-2000 字

以下是各资源的内容：

{resource_contents}

请输出完整的 Markdown 格式学习笔记。"""


@router.post("/compose-note", response_model=ComposeNoteResponse)
async def compose_note(
    req: ComposeNoteRequest,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """AI 智能编排：将多个资源合并为一份高质量学习笔记"""
    if not req.resource_ids:
        raise HTTPException(status_code=400, detail="资源列表不能为空")

    # 1. 获取资源内容
    resources = (
        db.query(KnowledgeResource)
        .filter(KnowledgeResource.id.in_(req.resource_ids))
        .all()
    )
    if not resources:
        raise HTTPException(status_code=404, detail="未找到指定资源")

    # 2. 按类型组织资源内容
    resource_contents = ""
    type_labels = {
        "image_text": "📖 图文讲解",
        "document": "📄 文档",
        "mind_map": "🧠 思维导图",
        "code_case": "💻 代码案例",
        "exercise": "📝 练习题",
        "video_script": "🎬 视频脚本",
    }

    for r in resources:
        label = type_labels.get(r.resource_type, f"📌 {r.resource_type}")
        content = r.content or ""
        # 截断过长内容（每资源最多 3000 字）
        if len(content) > 3000:
            content = content[:3000] + "\n...（内容过长已截断）"
        resource_contents += f"\n### {label}：{r.title}\n\n{content}\n\n---\n"

    # 3. 调用 LLM
    prompt = COMPOSE_NOTE_PROMPT.format(
        topic_name=req.topic_name,
        resource_contents=resource_contents,
    )

    try:
        composed = await _call_llm_for_compose(prompt)
    except Exception as e:
        logger.error(f"LLM 编排笔记失败: {e}")
        raise HTTPException(status_code=500, detail=f"AI 编排失败：{str(e)}")

    return ComposeNoteResponse(composed_note=composed)


async def _call_llm_for_compose(prompt: str) -> str:
    """调用 LLM 进行笔记编排"""
    import httpx

    api_key = getattr(app_settings, "DEEPSEEK_API_KEY", os.getenv("DEEPSEEK_API_KEY", ""))
    api_url = getattr(app_settings, "DEEPSEEK_BASE_URL", os.getenv("DEEPSEEK_BASE_URL", ""))
    model = getattr(app_settings, "DEEPSEEK_MODEL", os.getenv("DEEPSEEK_MODEL", "deepseek-chat"))

    if not api_key or not api_url:
        raise ValueError("LLM API 未配置，请先在 API 设置中配置 DeepSeek")

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{api_url.rstrip('/')}/v1/chat/completions",
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "你是一位资深技术教育作者，擅长编写高质量学习笔记。请用 Markdown 格式输出，语言为中文。"},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 4096,
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code != 200:
            raise ValueError(f"LLM API 返回错误: {resp.status_code} — {resp.text[:200]}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]


# ── 图文讲解图表静态文件服务 ──

@router.get("/plots/{filename}")
async def serve_plot_image(
    filename: str,
):
    """提供图文讲解中生成的图表图片"""
    import os
    from fastapi.responses import FileResponse
    PLOTS_DIR = os.path.join("uploads", "plots")
    filepath = os.path.join(PLOTS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="图片不存在")
    return FileResponse(filepath, media_type="image/png")
