"""复习中心 + 知识点总览 API

提供以下端点：
- GET  /review/dashboard                   获取复习概览
- POST /review/{point_id}/complete         标记知识点复习完成
- GET  /review/knowledge-points            获取用户所有知识点掌握情况
"""

import logging
from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.api.dependencies import CurrentUser, get_current_user
from app.db.database import get_db
from app.models.question_bank import KnowledgePointRecord, KnowledgePoint, KnowledgeDomain, Subject, WrongAnswerRecord

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/review", tags=["Review Center"])

CHINA_TZ = timezone(timedelta(hours=8))


def _now() -> datetime:
    return datetime.now()


@router.get("/dashboard")
async def get_review_dashboard(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取复习中心概览数据"""
    user_id = str(current_user.student_id)
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. 到期待复习的知识点
    due_points = (
        db.query(KnowledgePointRecord)
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.next_review_at.isnot(None),
            KnowledgePointRecord.next_review_at <= now,
            KnowledgePointRecord.status.in_(["learning", "reviewing"]),
        )
        .order_by(KnowledgePointRecord.next_review_at.asc())
        .all()
    )

    # 2. 错题总数
    wrong_answer_count = (
        db.query(func.count(WrongAnswerRecord.id))
        .filter(WrongAnswerRecord.user_id == user_id)
        .scalar()
        or 0
    )

    # 3. 今日进度：今日已完成复习数
    today_reviewed = (
        db.query(func.count(KnowledgePointRecord.id))
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.last_study_at >= today_start,
            KnowledgePointRecord.last_study_at.isnot(None),
        )
        .scalar()
        or 0
    )

    # 今日到期总数 = 今天之前到期但还没复习的 + 今天到期的
    total_due_today = len(due_points)

    # 格式化返回
    due_points_data = []
    for p in due_points:
        next_review = p.next_review_at
        # 计算还有多久到期（用于显示）
        if next_review:
            # 确保有时区信息
            if next_review.tzinfo is None:
                next_review = next_review.replace(tzinfo=CHINA_TZ)
            diff = next_review - now
            overdue = diff.total_seconds() < 0
            hours_diff = abs(int(diff.total_seconds() / 3600))
            if overdue:
                if hours_diff < 24:
                    review_label = f"已逾期 {hours_diff} 小时"
                else:
                    review_label = f"已逾期 {hours_diff // 24} 天"
            else:
                if hours_diff < 24:
                    review_label = f"还需 {hours_diff} 小时"
                else:
                    review_label = f"还需 {hours_diff // 24} 天"
        else:
            review_label = "待安排"

        lst = p.last_study_at
        if lst and lst.tzinfo is None:
            lst = lst.replace(tzinfo=CHINA_TZ)

        due_points_data.append({
            "point_id": str(p.point_id) if p.point_id else None,
            "point_name": p.point_name or "未知知识点",
            "mastery_score": p.mastery_score or 0,
            "recent_accuracy": p.recent_accuracy or 0,
            "consecutive_errors": p.consecutive_errors or 0,
            "total_practiced": p.total_practiced or 0,
            "study_count": p.study_count or 0,
            "status": p.status or "not_started",
            "last_study_at": lst.isoformat() if lst else None,
            "next_review_at": next_review.isoformat() if next_review else None,
            "review_label": review_label,
        })

    return {
        "due_points": due_points_data,
        "wrong_answer_count": wrong_answer_count,
        "today_progress": {
            "reviewed": today_reviewed,
            "total_due": total_due_today,
        },
    }


@router.post("/{point_id}/complete")
async def mark_review_complete(
    point_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """标记知识点复习完成，自动计算下次复习时间"""
    user_id = str(current_user.student_id)

    record = (
        db.query(KnowledgePointRecord)
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.point_id == point_id,
        )
        .first()
    )

    if not record:
        raise HTTPException(status_code=404, detail="未找到该知识点的学习记录")

    # 艾宾浩斯复习间隔：第1天、第2天、第4天、第7天、第15天
    EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15]

    now = _now()
    record.study_count = (record.study_count or 0) + 1
    record.last_study_at = now
    record.status = "reviewing"

    # 根据复习次数计算下次复习时间
    interval_days = EBBINGHAUS_INTERVALS[min(record.study_count - 1, len(EBBINGHAUS_INTERVALS) - 1)]
    record.next_review_at = now + timedelta(days=interval_days)

    # 如果 mastery_score < 80，复习可增加一定的掌握度
    if record.mastery_score < 80:
        record.mastery_score = min(100, (record.mastery_score or 0) + 5)

    db.commit()

    return {
        "success": True,
        "point_id": str(record.point_id) if record.point_id else None,
        "point_name": record.point_name,
        "study_count": record.study_count,
        "next_review_at": record.next_review_at.isoformat(),
    }


@router.get("/knowledge-points")
async def get_knowledge_points(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    subject_id: Optional[str] = Query(None, description="可选：按学科ID过滤"),
):
    """获取知识点的掌握情况，按学科→章节→知识点层级组织

    **始终显示全部知识点**，如果用户有学习记录则叠加掌握度数据。
    支持 subject_id 参数过滤特定学科。
    """
    user_id = str(current_user.student_id)
    now = _now()

    # 1. 加载用户的全部学习记录（使用字典加速查找）
    user_records_raw = (
        db.query(KnowledgePointRecord)
        .filter(KnowledgePointRecord.user_id == user_id)
        .all()
    )
    user_record_map: dict[str, KnowledgePointRecord] = {}
    for r in user_records_raw:
        if r.point_id:
            user_record_map[str(r.point_id)] = r

    # 2. 查询所有学科 → 章节 → 知识点 的完整层级（与学习路径保持一致）
    subjects_query = db.query(Subject).order_by(Subject.sort_order, Subject.name)
    if subject_id:
        subjects_query = subjects_query.filter(Subject.id == UUID(subject_id))
    all_subjects = subjects_query.all()

    subject_map: dict = {}
    for sub in all_subjects:
        sub_key = str(sub.id)
        subject_map[sub_key] = {
            "id": sub_key,
            "name": sub.name,
            "domains": {},
        }

        # 查询该学科下的所有章节
        domains = (
            db.query(KnowledgeDomain)
            .filter(KnowledgeDomain.subject_id == sub.id)
            .order_by(KnowledgeDomain.sort_order)
            .all()
        )

        for dom in domains:
            dom_key = str(dom.id)
            subject_map[sub_key]["domains"][dom_key] = {
                "id": dom_key,
                "name": dom.name,
                "points": [],
            }

            # 查询该章节下的所有知识点
            points = (
                db.query(KnowledgePoint)
                .filter(KnowledgePoint.domain_id == dom.id)
                .order_by(KnowledgePoint.sort_order)
                .all()
            )

            for pt in points:
                pid = str(pt.id)
                rec = user_record_map.get(pid)

                if rec:
                    last_practice = rec.last_practice_at
                    next_review = rec.next_review_at
                    subject_map[sub_key]["domains"][dom_key]["points"].append({
                        "point_id": pid,
                        "point_name": pt.name,
                        "mastery_score": rec.mastery_score or 0,
                        "recent_accuracy": rec.recent_accuracy or 0,
                        "consecutive_errors": rec.consecutive_errors or 0,
                        "total_practiced": rec.total_practiced or 0,
                        "study_count": rec.study_count or 0,
                        "status": rec.status or "not_started",
                        "last_practice_at": last_practice.isoformat() if last_practice else None,
                        "next_review_at": next_review.isoformat() if next_review else None,
                        "needs_review": bool(next_review and next_review <= now),
                    })
                else:
                    subject_map[sub_key]["domains"][dom_key]["points"].append({
                        "point_id": pid,
                        "point_name": pt.name,
                        "mastery_score": 0,
                        "recent_accuracy": 0,
                        "consecutive_errors": 0,
                        "total_practiced": 0,
                        "study_count": 0,
                        "status": "not_started",
                        "last_practice_at": None,
                        "next_review_at": None,
                        "needs_review": False,
                    })

    # 4. 转为列表，计算平均掌握度
    result = []
    for sub in subject_map.values():
        domains_list = list(sub["domains"].values())
        all_scores = [p["mastery_score"] for d in domains_list for p in d["points"]]
        result.append({
            "id": sub["id"],
            "name": sub["name"],
            "total_points": len(all_scores),
            "avg_mastery": round(sum(all_scores) / len(all_scores), 1) if all_scores else 0,
            "domains": domains_list,
        })

    return {"subjects": result}


@router.get("/trends")
async def get_review_trends(
    days: int = Query(30, description="统计天数，默认30天"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取近N天复习趋势数据"""
    user_id = str(current_user.student_id)
    now = _now()
    start_date = now - timedelta(days=days)

    # 查询复习记录按天分组
    records = (
        db.query(KnowledgePointRecord)
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.last_study_at >= start_date,
            KnowledgePointRecord.last_study_at.isnot(None),
        )
        .order_by(KnowledgePointRecord.last_study_at.asc())
        .all()
    )

    # 按天聚合
    from collections import defaultdict
    daily: dict = defaultdict(lambda: {"review_count": 0, "total_mastery": 0, "count": 0})
    for r in records:
        day_key = r.last_study_at.strftime("%Y-%m-%d") if r.last_study_at else None
        if day_key:
            daily[day_key]["review_count"] += 1
            daily[day_key]["total_mastery"] += (r.mastery_score or 0)
            daily[day_key]["count"] += 1

    trends = []
    for i in range(days):
        d = (start_date + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        info = daily.get(d, {"review_count": 0, "total_mastery": 0, "count": 0})
        trends.append({
            "date": d,
            "review_count": info["review_count"],
            "avg_mastery": round(info["total_mastery"] / info["count"], 1) if info["count"] > 0 else 0,
        })

    total_reviews = sum(t["review_count"] for t in trends)
    avg_mastery = round(sum(t["avg_mastery"] for t in trends if t["review_count"] > 0) / max(1, len([t for t in trends if t["review_count"] > 0])), 1)

    return {
        "total_reviews": total_reviews,
        "avg_mastery": avg_mastery,
        "daily": trends,
    }


@router.get("/weak-points")
async def get_weak_points(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    threshold: int = Query(30, description="掌握度阈值，低于此值视为薄弱"),
):
    """获取用户的薄弱知识点（掌握度低于阈值）"""
    user_id = str(current_user.student_id)

    records = (
        db.query(KnowledgePointRecord)
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.mastery_score <= threshold,
        )
        .order_by(KnowledgePointRecord.mastery_score.asc())
        .all()
    )

    weak_points = []
    for r in records:
        # 尝试获取知识点的领域信息
        domain_name = "未知领域"
        subject_name = "未知学科"
        if r.point_id:
            pt = db.query(KnowledgePoint).filter(KnowledgePoint.id == r.point_id).first()
            if pt:
                domain = db.query(KnowledgeDomain).filter(KnowledgeDomain.id == pt.domain_id).first()
                if domain:
                    domain_name = domain.name
                    subj = db.query(Subject).filter(Subject.id == domain.subject_id).first()
                    if subj:
                        subject_name = subj.name

        weak_points.append({
            "point_id": str(r.point_id) if r.point_id else None,
            "point_name": r.point_name or "未知知识点",
            "mastery_score": r.mastery_score or 0,
            "consecutive_errors": r.consecutive_errors or 0,
            "domain_name": domain_name,
            "subject_name": subject_name,
            "needs_review": bool(r.next_review_at and r.next_review_at <= _now()) if r.next_review_at else False,
        })

    return {"weak_points": weak_points, "total": len(weak_points)}
