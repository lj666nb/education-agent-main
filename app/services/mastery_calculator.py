"""掌握度计算服务

基于做题正确率、近期表现、复习次数，综合计算知识点掌握度 (0-100)。
"""

import logging
from typing import Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def sanitize_record_values(
    mastery_score: Optional[int] = None,
    recent_accuracy: Optional[int] = None,
    total_practiced: Optional[int] = None,
    total_correct: Optional[int] = None,
    consecutive_errors: Optional[int] = None,
    study_count: Optional[int] = None,
    total_time_spent_seconds: Optional[int] = None,
) -> dict:
    """清理知识点记录的数值字段，确保全部在合理范围内。

    防止因历史 bug 或数据迁移导致的负值 / 越界值泄露到前端。
    """
    def _clamp(val, lo, hi, default=0):
        if val is None:
            return default
        return max(lo, min(hi, int(val)))

    result = {
        "mastery_score": _clamp(mastery_score, 0, 100),
        "recent_accuracy": _clamp(recent_accuracy, 0, 100),
        "total_practiced": _clamp(total_practiced, 0, 999999),
        "total_correct": _clamp(total_correct, 0, 999999),
        "consecutive_errors": _clamp(consecutive_errors, 0, 999999),
        "study_count": _clamp(study_count, 0, 999999),
        "total_time_spent_seconds": _clamp(total_time_spent_seconds, 0, 99999999),
    }
    # 确保 total_correct 不会超过 total_practiced（逻辑上不可能）
    if result["total_correct"] > result["total_practiced"]:
        result["total_correct"] = result["total_practiced"]
    return result


def calculate_mastery(
    total_practiced: int,
    total_correct: int,
    recent_accuracy: int,
    study_count: int,
    consecutive_errors: int,
    last_practice_at: Optional[datetime] = None,
    last_study_at: Optional[datetime] = None,
) -> int:
    """综合计算知识点掌握度 (0-100)

    权重:
    - 总体正确率: 50%
    - 最近5题正确率: 30%
    - 复习次数加成: 20% (上限10分)
    - 遗忘衰减: 超过7天未练习,每天减2分
    - 连续错误惩罚: >=3次连续错误减15分
    """
    # 输入验证：确保所有值在合理范围内
    total_practiced = max(0, total_practiced)
    total_correct = max(0, min(total_correct, total_practiced))  # 正确数不能超过总数
    recent_accuracy = max(0, min(100, recent_accuracy))
    study_count = max(0, study_count)
    consecutive_errors = max(0, consecutive_errors)

    if total_practiced == 0 and study_count == 0:
        return 0

    # 1. 总体正确率 (0-100)
    overall_acc = (total_correct / max(total_practiced, 1)) * 100

    # 2. 最近正确率
    recent = min(recent_accuracy, 100)

    # 3. 低样本惩罚: 练习不足3题时,最高不超过50
    #    防止 1 对 0 错就算出 80 分的虚高
    low_sample_penalty = 0
    if total_practiced < 3:
        low_sample_penalty = 30  # 扣30分,最高70 → 但公式上限会让它停在50左右

    # 4. 复习次数加成 (最多5分,且仅在正确率>=60%时生效)
    review_bonus = 0
    if overall_acc >= 60:
        review_bonus = min(study_count * 1, 5)

    # 5. 综合计算
    mastery = overall_acc * 0.5 + recent * 0.3 + review_bonus - low_sample_penalty

    # 6. 遗忘衰减（艾宾浩斯曲线）: 超过3天未练习开始衰减
    #   采用指数衰减: 第4天扣5分，第7天扣15分，第14天扣30分
    if last_practice_at:
        days_since_practice = (datetime.utcnow() - last_practice_at).days
        if days_since_practice > 3:
            # 指数衰减: days=4→5, 5→8, 7→15, 10→25, 14→40(max30)
            decay = min(int(1.5 ** (days_since_practice - 2)), 30)
            mastery -= decay

    # 7. 连续错误惩罚
    if consecutive_errors >= 3:
        mastery -= 15

    return max(0, min(100, int(mastery)))


def calculate_review_interval(review_count: int) -> int:
    """艾宾浩斯复习间隔（天）

    第1次复习: 1天后
    第2次复习: 2天后
    第3次复习: 4天后
    第4次复习: 7天后
    第5次复习: 15天后
    """
    intervals = [1, 2, 4, 7, 15]
    if review_count <= 0:
        return 1
    idx = min(review_count - 1, len(intervals) - 1)
    return intervals[idx]


def needs_review(last_practice_at: Optional[datetime], review_count: int) -> bool:
    """判断是否到达复习时间"""
    if not last_practice_at:
        return False
    interval = calculate_review_interval(review_count)
    next_review = last_practice_at + timedelta(days=interval)
    return datetime.utcnow() >= next_review


def detect_fatigue(
    session_start: Optional[datetime],
    total_questions: int,
    recent_correct: int,
    recent_total: int,
) -> bool:
    """检测学习疲劳度

    条件: 连续做题 >= 20分钟 且 当前正确率比初始下降 >= 15%
    返回 True 表示疲劳
    """
    if not session_start:
        return False

    elapsed_minutes = (datetime.utcnow() - session_start).total_seconds() / 60
    if elapsed_minutes < 20:
        return False

    if recent_total < 5:
        return False

    recent_acc = (recent_correct / recent_total) * 100
    # 假设初始预期正确率 70%
    baseline = 70.0

    return (baseline - recent_acc) >= 15
