"""试卷题目优化选择器 — 章节均衡、去重、随机采样"""
import random
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.question_bank import Question, KnowledgePoint


class ExamOptimizer:
    """试卷题目推荐引擎"""

    def __init__(self, db: Session, bank_id: UUID):
        self.db = db
        self.bank_id = bank_id
        self._used_ids: set = set()

    def get_available(
        self,
        question_type: Optional[str] = None,
        difficulty: Optional[str] = None,
        domain_ids: Optional[List[str]] = None,
        exclude_ids: Optional[List[UUID]] = None,
    ) -> List[Question]:
        """获取符合条件的题目池"""
        query = self.db.query(Question).filter(
            Question.bank_id == self.bank_id,
            Question.status == "published",
        )
        if question_type:
            query = query.filter(Question.type == question_type)
        if difficulty:
            query = query.filter(Question.difficulty == difficulty)
        if exclude_ids:
            query = query.filter(~Question.id.in_(exclude_ids))
        return query.all()

    def select_balanced(
        self,
        questions: List[Question],
        count: int,
        domain_ids: Optional[List[str]] = None,
    ) -> List[str]:
        """
        均衡选择：按章节轮询分配，保证覆盖度。
        如果可用题目不足 count，返回全部可用题目。
        """
        if not questions:
            return []

        if count >= len(questions):
            selected = questions
        elif not domain_ids:
            selected = random.sample(questions, min(count, len(questions)))
        else:
            selected = self._round_robin(questions, count, domain_ids)

        ids = [str(q.id) for q in selected]
        self._used_ids.update(ids)
        return ids

    def _round_robin(
        self, questions: List[Question], count: int, domain_ids: List[str]
    ) -> List[Question]:
        """跨章节轮询分配"""
        grouped = self._group_by_domain(questions, domain_ids)
        result = []
        remaining = count
        while remaining > 0:
            moved = False
            for did in domain_ids:
                pool = [q for q in grouped.get(did, [])
                        if str(q.id) not in self._used_ids]
                if pool and remaining > 0:
                    chosen = random.choice(pool)
                    result.append(chosen)
                    self._used_ids.add(str(chosen.id))
                    remaining -= 1
                    moved = True
            if not moved:
                break
        return result

    def _group_by_domain(
        self, questions: List[Question], domain_ids: List[str]
    ) -> Dict[str, List[Question]]:
        """将题目按知识点所属章节分组"""
        kp_uuids = []
        for q in questions:
            for u in (q.knowledge_point_uuids or []):
                try:
                    kp_uuids.append(UUID(u))
                except ValueError:
                    pass

        domain_map = {did: [] for did in domain_ids}
        kps = self.db.query(KnowledgePoint).filter(
            KnowledgePoint.id.in_(kp_uuids)
        ).all() if kp_uuids else []
        kp_to_domain = {str(kp.id): str(kp.domain_id) for kp in kps}

        for q in questions:
            for kp_uuid in (q.knowledge_point_uuids or []):
                did = kp_to_domain.get(kp_uuid)
                if did and did in domain_map:
                    domain_map[did].append(q)
                    break
        return domain_map
