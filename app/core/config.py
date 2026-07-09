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
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "education_agent"
    POSTGRES_PORT: str = "5432"

    # ── Redis ──
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # ── Neo4j ──
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "12345678"

    # ── MongoDB ──
    MONGODB_HOST: str = "localhost"
    MONGODB_PORT: int = 27017
    MONGODB_USER: str = "root"
    MONGODB_PASSWORD: str = "123456"
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

    # Unsplash 图片搜索
    UNSPLASH_ACCESS_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
