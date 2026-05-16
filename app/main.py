import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.core.config import settings
from app.db.database import Base, engine
from app.api.endpoints import auth, profile, profile_v2, chat, project, api_settings, ocr, files, question_bank, exam_paper
from app.models.api_settings import ApiSettings
from app.models.question_bank import Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question, ExamPaper
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
    logger.warning(f"\n{'='*60}")
    logger.warning(f"  {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.warning(f"{'='*60}")
    logger.warning(f"  API 文档: http://localhost:8000/docs")
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

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    detail = _convert_validation_error(exc)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": detail}
    )
