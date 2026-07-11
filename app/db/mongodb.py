from pymongo import MongoClient, ASCENDING, DESCENDING
from app.core.config import settings
from typing import Optional, Dict, List, Any
from datetime import datetime
from urllib.parse import quote_plus
import uuid


class MongoDBConnection:
    def __init__(self):
        self.client: Optional[MongoClient] = None
        self.db = None
        self._connect()

    def _connect(self):
        if self.client is None:
            connection_string = (
                f"mongodb://{quote_plus(settings.MONGODB_USER)}:{quote_plus(settings.MONGODB_PASSWORD)}@"
                f"{settings.MONGODB_HOST}:{settings.MONGODB_PORT}/"
                f"?authSource=admin"
            )
            self.client = MongoClient(connection_string)
            self.db = self.client[settings.MONGODB_DB]
            self._ensure_indexes()

    def connect(self) -> MongoClient:
        self._connect()
        return self.client

    def _ensure_indexes(self):
        self.db.student_profiles.create_index([("student_id", ASCENDING)], unique=True)
        self.db.behavior_events.create_index([("student_id", ASCENDING), ("timestamp", DESCENDING)])
        self.db.behavior_events.create_index([("student_id", ASCENDING), ("event_type", ASCENDING)])

    def close(self):
        if self.client:
            self.client.close()
            self.client = None
            self.db = None

    def verify_connectivity(self) -> bool:
        try:
            client = self.connect()
            client.admin.command("ping")
            return True
        except Exception:
            return False

    def create_student_profile(
        self,
        student_id: str,
        active_hours: Optional[Dict[str, float]] = None,
        learning_rhythm_scalar: float = 0.5,
        learning_rhythm_trend: float = 0.0,
        metacognitive_calibration: float = 0.0,
        attention_feature: float = 0.5
    ) -> bool:
        profile = {
            "student_id": student_id,
            "dimensions": {
                "active_hours": active_hours or {
                    "morning": 0.25,
                    "afternoon": 0.25,
                    "evening": 0.25,
                    "night": 0.25
                },
                "learning_rhythm": {
                    "scalar": learning_rhythm_scalar,
                    "trend": learning_rhythm_trend
                },
                "metacognitive_calibration": metacognitive_calibration,
                "attention_feature": attention_feature
            },
            "timeline": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = self.db.student_profiles.insert_one(profile)
        return result.inserted_id is not None

    def get_student_profile(self, student_id: str) -> Optional[Dict[str, Any]]:
        return self.db.student_profiles.find_one({"student_id": student_id})

    def update_student_profile(
        self,
        student_id: str,
        active_hours: Optional[Dict[str, float]] = None,
        learning_rhythm_scalar: Optional[float] = None,
        learning_rhythm_trend: Optional[float] = None,
        metacognitive_calibration: Optional[float] = None,
        attention_feature: Optional[float] = None
    ) -> bool:
        update_fields = {"updated_at": datetime.utcnow()}

        if active_hours is not None:
            update_fields["dimensions.active_hours"] = active_hours
        if learning_rhythm_scalar is not None:
            update_fields["dimensions.learning_rhythm.scalar"] = learning_rhythm_scalar
        if learning_rhythm_trend is not None:
            update_fields["dimensions.learning_rhythm.trend"] = learning_rhythm_trend
        if metacognitive_calibration is not None:
            update_fields["dimensions.metacognitive_calibration"] = metacognitive_calibration
        if attention_feature is not None:
            update_fields["dimensions.attention_feature"] = attention_feature

        result = self.db.student_profiles.update_one(
            {"student_id": student_id},
            {"$set": update_fields}
        )
        return result.modified_count > 0

    def add_timeline_event(
        self,
        student_id: str,
        event_type: str,
        event_data: Dict[str, Any]
    ) -> bool:
        timeline_event = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "event_data": event_data,
            "timestamp": datetime.utcnow()
        }
        result = self.db.student_profiles.update_one(
            {"student_id": student_id},
            {
                "$push": {"timeline": timeline_event},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def get_timeline(
        self,
        student_id: str,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        profile = self.db.student_profiles.find_one(
            {"student_id": student_id},
            {"timeline": {"$slice": [skip, limit]}}
        )
        return profile.get("timeline", []) if profile else []

    def record_behavior_event(
        self,
        student_id: str,
        event_type: str,
        event_data: Dict[str, Any]
    ) -> bool:
        event = {
            "student_id": student_id,
            "event_type": event_type,
            "event_data": event_data,
            "timestamp": datetime.utcnow()
        }
        result = self.db.behavior_events.insert_one(event)
        return result.inserted_id is not None

    def _convert_datetime(self, dt):
        if dt is None:
            return None
        if hasattr(dt, 'isoformat'):
            return dt.isoformat()
        return str(dt)

    def get_behavior_events(
        self,
        student_id: str,
        event_type: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        query = {"student_id": student_id}
        if event_type:
            query["event_type"] = event_type

        cursor = self.db.behavior_events.find(query).sort(
            "timestamp", DESCENDING
        ).skip(skip).limit(limit)

        events = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "timestamp" in doc:
                doc["timestamp"] = self._convert_datetime(doc["timestamp"])
            events.append(doc)
        return events

    def delete_student_profile(self, student_id: str) -> bool:
        result = self.db.student_profiles.delete_one({"student_id": student_id})
        self.db.behavior_events.delete_many({"student_id": student_id})
        return result.deleted_count > 0


mongodb_conn = MongoDBConnection()


def get_mongodb() -> MongoDBConnection:
    return mongodb_conn
