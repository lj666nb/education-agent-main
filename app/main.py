import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import ValidationError

from app.core.config import settings
from app.db.database import Base, engine
from app.api.endpoints import auth, profile, profile_v2, chat, project, api_settings, ocr, files, question_bank, exam_paper, path, resources, video_resources, cloud_drive, code_execution, recommend, dashboard, recommendations, agent, review, knowledge_graph, notes_tutor, coding
from app.models.api_settings import ApiSettings
from app.models.question_bank import Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question, ExamPaper
from app.models.path import LearningPath
from app.models.resource import KnowledgeResource, RecommendationFeedback
from app.models.video_gen import VideoGenTask
from app.models.agent_task import AgentTask
from app.models.cloud_file import CloudFile
from app.models.path_state import LearningPathState
from app.services.video_presentation import VIDEO_DIR
from app.scripts.seed import seed_database
from sqlalchemy import text

logger = logging.getLogger("uvicorn")


def _convert_validation_error(exc: ValidationError) -> str:
    errors = exc.errors()
    messages = []
    for error in errors:
        loc = ".".join(str(l) for l in error["loc"] if l != "body")
        msg = error["msg"]
        ctx = error.get("ctx", {})

        if "Field required" in msg:
            field_name = loc.split(".")[-1] if loc else ""
            field_labels = {
                "username": "用户名",
                "password": "密码",
                "confirm_password": "确认密码",
                "email": "邮箱",
                "major": "专业",
                "api_key": "API Key",
                "secret_key": "Secret Key",
                "provider": "服务提供商",
                "base_url": "自定义地址",
                "model": "模型",
                "messages": "消息列表",
                "content": "消息内容",
                "role": "角色",
                "title": "标题",
                "name": "名称",
            }
            label = field_labels.get(field_name, field_name)
            messages.append(f"{label} 不能为空")
        elif "Input should be a valid datetime" in msg.lower() or "input should be a valid datetime" in msg.lower():
            messages.append("日期时间格式不正确")
        elif "Input should be a valid email" in msg.lower():
            messages.append("请输入有效的邮箱地址")
        elif "String should have at least" in msg:
            min_length = ctx.get("min_length", "")
            field_name = loc.split(".")[-1] if loc else ""
            if "username" in loc:
                messages.append("用户名长度至少3位")
            elif "password" in loc:
                messages.append("密码长度至少6位")
            else:
                messages.append(f"{field_name}长度至少{min_length}位")
        elif "String should have at most" in msg:
            max_length = ctx.get("max_length", "")
            field_name = loc.split(".")[-1] if loc else ""
            messages.append(f"{field_name}长度不能超过{max_length}位")
        elif "username" in loc:
            messages.append(msg)
        elif "password" in loc:
            messages.append(msg)
        elif "email" in loc:
            messages.append("请输入有效的邮箱地址")
        elif "major" in loc:
            messages.append("请输入您的专业")
        else:
            messages.append(msg)
    return "；".join(messages)


def _check_database():
    if settings.USE_SQLITE:
        raise RuntimeError(
            "启动失败：当前配置使用了 SQLite，但本项目要求使用 PostgreSQL。\n"
            "请修改配置文件，确保 USE_SQLITE=False，并正确配置 PostgreSQL 连接信息。\n"
            "当前配置: USE_SQLITE=True"
        )
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            if "postgresql" not in version.lower():
                raise RuntimeError(
                    f"启动失败：数据库不是 PostgreSQL。\n"
                    f"当前连接到的数据库: {version}\n"
                    f"请确保数据库连接指向 PostgreSQL 服务。"
                )
            logger.info(f"PostgreSQL 连接正常: {version}")
    except Exception as e:
        if "connection refused" in str(e).lower():
            raise RuntimeError(
                "启动失败：无法连接到 PostgreSQL 数据库。\n"
                f"连接地址: {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}\n"
                f"数据库名: {settings.POSTGRES_DB}\n"
                f"用户名: {settings.POSTGRES_USER}\n\n"
                "请确认 PostgreSQL 服务已启动，且连接信息正确。"
            )
        raise RuntimeError(
            f"启动失败：PostgreSQL 连接异常。\n"
            f"错误信息: {e}\n\n"
            f"请检查 PostgreSQL 服务状态和连接配置。"
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _check_database()
    Base.metadata.create_all(bind=engine)
    # 启动时自动加载种子数据（幂等，已存在则跳过）
    try:
        seed_database()
    except Exception as e:
        logger.warning(f"种子数据加载失败（不影响启动）: {e}")
    logger.warning(f"\n{'='*60}")
    logger.warning(f"  {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.warning(f"{'='*60}")
    logger.warning(f"  API 文档: {settings.API_V1_STR}/docs")
    logger.warning(f"  后台服务已启动")
    logger.warning(f"{'='*60}\n")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(profile.router, prefix=settings.API_V1_STR)
app.include_router(profile_v2.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(project.router, prefix=settings.API_V1_STR)
app.include_router(api_settings.router, prefix=settings.API_V1_STR)
app.include_router(ocr.router, prefix=settings.API_V1_STR)
app.include_router(files.router, prefix=settings.API_V1_STR)
app.include_router(question_bank.router, prefix=settings.API_V1_STR)
app.include_router(exam_paper.router, prefix=settings.API_V1_STR)
app.include_router(path.router, prefix=settings.API_V1_STR)
app.include_router(resources.router, prefix=settings.API_V1_STR)
app.include_router(video_resources.router, prefix=settings.API_V1_STR)
app.include_router(cloud_drive.router, prefix=settings.API_V1_STR)
app.include_router(code_execution.router, prefix=settings.API_V1_STR)
app.include_router(recommend.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(recommendations.router, prefix=settings.API_V1_STR)
app.include_router(agent.router, prefix=settings.API_V1_STR)
app.include_router(review.router, prefix=settings.API_V1_STR)
app.include_router(knowledge_graph.router, prefix=settings.API_V1_STR)
app.include_router(notes_tutor.router, prefix=settings.API_V1_STR)
app.include_router(coding.router, prefix=settings.API_V1_STR)

# 视频文件（音频）静态服务 — 使用路由而非 app.mount（避免 uvicorn HTTP layer 兼容问题）
from fastapi import Path as FPath

@app.get(f"{settings.API_V1_STR}/video-files/{{file_path:path}}")
async def serve_video_file(file_path: str = FPath(...)):
    full_path = os.path.normpath(os.path.join(VIDEO_DIR, file_path))
    if not full_path.startswith(os.path.normpath(VIDEO_DIR)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    if not os.path.isfile(full_path):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    return FileResponse(full_path)

# 用户上传文件（头像等）静态服务 — 无需认证，供 <img> 标签直接引用
UPLOAD_STATIC_DIR = "uploads"
os.makedirs(UPLOAD_STATIC_DIR, exist_ok=True)

@app.get(f"{settings.API_V1_STR}/uploads/{{file_path:path}}")
async def serve_uploaded_file(file_path: str = FPath(...)):
    full_path = os.path.normpath(os.path.join(UPLOAD_STATIC_DIR, file_path))
    if not full_path.startswith(os.path.normpath(UPLOAD_STATIC_DIR)):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    if not os.path.isfile(full_path):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    return FileResponse(full_path)


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    detail = _convert_validation_error(exc)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": detail}
    )
