from sqlalchemy import Column, String, DateTime, Uuid, Boolean, Text
from sqlalchemy.sql import func
import uuid
from app.db.database import Base


class ApiSettings(Base):
    __tablename__ = "api_settings"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    api_key = Column(Text, nullable=False)
    secret_key = Column(Text, nullable=True)
    base_url = Column(Text, nullable=True)
    model_version = Column(String(20), nullable=True)
    is_enabled = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        {"schema": None}
    )
