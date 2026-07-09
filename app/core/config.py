from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    PROJECT_NAME: str = "Education Agent"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    USE_SQLITE: bool = False

    # ── PostgreSQL ──
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "change-me-postgres"
    POSTGRES_DB: str = "education_agent"
    POSTGRES_PORT: str = "5432"

    # ── Redis ──
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # ── Neo4j ──
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "change-me-neo4j"

    # ── MongoDB ──
    MONGODB_HOST: str = "localhost"
    MONGODB_PORT: int = 27017
    MONGODB_USER: str = "root"
    MONGODB_PASSWORD: str = "change-me-mongo"
    MONGODB_DB: str = "education_agent"

    # ── 安全 ──
    SECRET_KEY: str = "education-agent-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    BCRYPT_COST_FACTOR: int = 12

    LOGIN_MAX_FAILURES: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # ── DeepSeek ──
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_TEMPERATURE: float = 0.7
    DEEPSEEK_MAX_TOKENS: int = 2048
    DEEPSEEK_TIMEOUT: float = 60.0

    # ── Qwen / 通义千问 ──
    QWEN_API_KEY: str = ""
    QWEN_MODEL: str = "qwen-plus"
    QWEN_LIGHT_MODEL: str = "qwen-plus"
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_TEMPERATURE: float = 0.7
    QWEN_MAX_TOKENS: int = 2048
    QWEN_TIMEOUT: float = 60.0

    # ── 意图检测 ──
    INTENT_MODEL: str = "qwen-plus"
    INTENT_TEMPERATURE: float = 0.1
    INTENT_MAX_TOKENS: int = 500
    INTENT_TIMEOUT: float = 15.0

    DATA_DIR: str = "./data"

    # Code execution is dangerous without a real sandbox. Keep it off unless an
    # operator explicitly enables it in a controlled environment.
    ENABLE_CODE_EXECUTION: bool = False
    ENABLE_PLOT_CODE_EXECUTION: bool = False

    # ── CORS ──
    CORS_ORIGINS: str = "http://localhost:3000"

    # ── OCR (Baidu) ──
    OCR_BAIDU_TOKEN_URL: str = "https://aip.baidubce.com/oauth/2.0/token"
    OCR_BAIDU_API_URL: str = "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic"

    # ── Web Search (DashScope MCP) ──
    WEB_SEARCH_URL: str = "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp"
    WEB_SEARCH_MODEL: str = "deepseek-chat"

    # ── Embedding (DashScope) ──
    EMBEDDING_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"
    EMBEDDING_MAX_RETRIES: int = 3
    EMBEDDING_TIMEOUT: int = 120

    # ── Unsplash ──
    UNSPLASH_API_BASE: str = "https://api.unsplash.com"

    # ── Default LLM fallbacks (used when no user API settings) ──
    DEFAULT_LLM_BASE_URL: str = "https://api.deepseek.com/v1"
    DEFAULT_LLM_MODEL: str = "deepseek-chat"

    # ── Valid model sets (comma-separated) ──
    VALID_DEEPSEEK_MODELS: str = "deepseek-v4-pro,deepseek-v4-flash,deepseek-chat,deepseek-reasoner"
    VALID_QWEN_MODELS: str = "qwen-plus,qwen-turbo,qwen-max,qwen3.5-plus,qwen3.6-plus"

    # ── Execution / Timeouts ──
    CODE_EXECUTION_TIMEOUT: int = 30
    API_VALIDATION_TIMEOUT: int = 10
    DEFAULT_LLM_TIMEOUT: int = 120

    # ── Feature toggles ──
    ENABLE_OCR: bool = True
    ENABLE_WEB_SEARCH: bool = True
    ENABLE_UNSPLASH: bool = True
    ENABLE_TTS: bool = True

    # ── CDN / External ──
    ECHARTS_CDN_URL: str = "https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"
    PLACEHOLD_IMAGE_URL: str = "https://placehold.co"
    DRAWIO_VIEWER_URL: str = "https://viewer.diagrams.net"

    # ── Uploads ──
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB

    # ── Pagination defaults ──
    DEFAULT_PAGE_SIZE: int = 20
    DEFAULT_LARGE_PAGE_SIZE: int = 100

    # Unsplash 图片搜索
    UNSPLASH_ACCESS_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
