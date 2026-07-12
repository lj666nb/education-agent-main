"""Small idempotent runner for SQL migrations required during Docker upgrades."""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy.engine import Engine


logger = logging.getLogger("uvicorn")


def apply_required_migrations(engine: Engine) -> None:
    """Apply versioned migrations that are safe and required before seeding.

    The project historically relied on ``metadata.create_all``. That creates
    tables for a fresh install but cannot add columns to an existing database,
    so upgraded Docker deployments need a tiny tracked migration step.
    """

    migration_root = Path("/app/migrations")
    if not migration_root.is_dir():
        migration_root = Path(__file__).resolve().parents[2] / "migrations"
    migrations = [
        ("013_add_coding_judge", migration_root / "013_add_coding_judge.sql"),
        ("014_add_knowledge_point_lectures", migration_root / "014_add_knowledge_point_lectures.sql"),
        ("015_add_citations_to_chat_messages", migration_root / "015_add_citations_to_chat_messages.sql"),
    ]
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(120) PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        for version, path in migrations:
            applied = connection.exec_driver_sql(
                "SELECT 1 FROM schema_migrations WHERE version = %s",
                (version,),
            ).first()
            if applied:
                continue
            if not path.is_file():
                raise RuntimeError(f"数据库迁移文件不存在：{path}")
            connection.exec_driver_sql(path.read_text(encoding="utf-8"))
            connection.exec_driver_sql(
                "INSERT INTO schema_migrations(version) VALUES (%s)",
                (version,),
            )
            logger.info("数据库迁移已应用：%s", version)
