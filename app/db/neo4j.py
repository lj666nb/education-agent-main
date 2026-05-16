from neo4j import GraphDatabase
from app.core.config import settings
from typing import Optional, Dict, List, Any
from datetime import datetime
import uuid


class Neo4jConnection:
    def __init__(self):
        self.driver = None

    def connect(self):
        if self.driver is None:
            self.driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
        return self.driver

    def close(self):
        if self.driver:
            self.driver.close()
            self.driver = None

    def verify_connectivity(self) -> bool:
        try:
            driver = self.connect()
            driver.verify_connectivity()
            return True
        except Exception:
            return False

    def create_student_node(self, student_id: str) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MERGE (s:Student {student_id: $student_id})
                RETURN s
                """,
                student_id=student_id
            )
            return result.single() is not None

    def add_knowledge_mastery(
        self,
        student_id: str,
        knowledge_point: str,
        score: float = 0.0,
        confidence: float = 0.3
    ) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})
                MERGE (s)-[r:MASTERS]->(k:KnowledgePoint {name: $knowledge_point})
                SET r.score = $score,
                    r.confidence = $confidence,
                    r.last_updated = datetime()
                RETURN r
                """,
                student_id=student_id,
                knowledge_point=knowledge_point,
                score=score,
                confidence=confidence
            )
            return result.single() is not None

    def get_knowledge_mastery(self, student_id: str) -> List[Dict[str, Any]]:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:MASTERS]->(k:KnowledgePoint)
                RETURN k.name as knowledge_point, r.score as score,
                       r.confidence as confidence, r.last_updated as last_updated
                """,
                student_id=student_id
            )
            records = result.data()
            return records if records else []

    def update_knowledge_mastery(
        self,
        student_id: str,
        knowledge_point: str,
        score: Optional[float] = None,
        confidence: Optional[float] = None
    ) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:MASTERS]->(k:KnowledgePoint {name: $knowledge_point})
                SET
                    r.score = COALESCE($score, r.score),
                    r.confidence = COALESCE($confidence, r.confidence),
                    r.last_updated = datetime()
                RETURN r
                """,
                student_id=student_id,
                knowledge_point=knowledge_point,
                score=score,
                confidence=confidence
            )
            return result.single() is not None

    def delete_knowledge_mastery(self, student_id: str, knowledge_point: str) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:MASTERS]->(k:KnowledgePoint {name: $knowledge_point})
                DELETE r
                RETURN count(*) as deleted
                """,
                student_id=student_id,
                knowledge_point=knowledge_point
            )
            record = result.single()
            return record and record["deleted"] > 0

    def set_cognitive_style(
        self,
        student_id: str,
        style_type: str,
        confidence: float = 0.5
    ) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})
                MERGE (s)-[r:HAS_STYLE]->(c:CognitiveStyle {type: $style_type})
                SET r.confidence = $confidence,
                    r.last_updated = datetime()
                RETURN r
                """,
                student_id=student_id,
                style_type=style_type,
                confidence=confidence
            )
            return result.single() is not None

    def get_cognitive_style(self, student_id: str) -> Optional[Dict[str, Any]]:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:HAS_STYLE]->(c:CognitiveStyle)
                RETURN c.type as style_type, r.confidence as confidence,
                       r.last_updated as last_updated
                """,
                student_id=student_id
            )
            record = result.single()
            return dict(record) if record else None

    def add_error_prone_topic(
        self,
        student_id: str,
        topic: str,
        error_count: int = 1
    ) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})
                MERGE (s)-[r:ERROR_PRONE]->(t:Topic {name: $topic})
                SET r.error_count = COALESCE(r.error_count, 0) + $error_count,
                    r.last_updated = datetime()
                RETURN r
                """,
                student_id=student_id,
                topic=topic,
                error_count=error_count
            )
            return result.single() is not None

    def get_error_prone_topics(self, student_id: str) -> List[Dict[str, Any]]:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:ERROR_PRONE]->(t:Topic)
                RETURN t.name as topic, r.error_count as error_count,
                       r.last_updated as last_updated
                ORDER BY r.error_count DESC
                """,
                student_id=student_id
            )
            records = result.data()
            return records if records else []

    def get_student_profile_data(self, student_id: str) -> Dict[str, Any]:
        return {
            "knowledge_mastery": self.get_knowledge_mastery(student_id),
            "cognitive_style": self.get_cognitive_style(student_id),
            "error_prone_topics": self.get_error_prone_topics(student_id)
        }

    def delete_student_data(self, student_id: str) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})
                DETACH DELETE s
                RETURN count(*) as deleted
                """,
                student_id=student_id
            )
            record = result.single()
            return record and record["deleted"] > 0


neo4j_conn = Neo4jConnection()


def get_neo4j() -> Neo4jConnection:
    return neo4j_conn
