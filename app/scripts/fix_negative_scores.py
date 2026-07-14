"""一次性修复数据库中 KnowledgePointRecord 的异常数值

解决问题：
- mastery_score / recent_accuracy 出现负值
- total_correct > total_practiced（逻辑上不可能）
- consecutive_errors 为负数

运行方式：
  docker-compose exec backend python -m app.scripts.fix_negative_scores
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.db.database import SessionLocal
from app.models.question_bank import KnowledgePointRecord
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


def fix_negative_scores():
    db = SessionLocal()
    try:
        # 1. 修复 mastery_score（0-100）
        result = db.execute(text("""
            UPDATE knowledge_point_records
            SET mastery_score = 0
            WHERE mastery_score < 0
        """))
        logger.info(f"修复 mastery_score < 0: {result.rowcount} 条")

        result = db.execute(text("""
            UPDATE knowledge_point_records
            SET mastery_score = 100
            WHERE mastery_score > 100
        """))
        logger.info(f"修复 mastery_score > 100: {result.rowcount} 条")

        # 2. 修复 recent_accuracy（0-100）
        result = db.execute(text("""
            UPDATE knowledge_point_records
            SET recent_accuracy = 0
            WHERE recent_accuracy < 0
        """))
        logger.info(f"修复 recent_accuracy < 0: {result.rowcount} 条")

        result = db.execute(text("""
            UPDATE knowledge_point_records
            SET recent_accuracy = 100
            WHERE recent_accuracy > 100
        """))
        logger.info(f"修复 recent_accuracy > 100: {result.rowcount} 条")

        # 3. 修复 total_correct > total_practiced 的情况（逻辑错误）
        result = db.execute(text("""
            UPDATE knowledge_point_records
            SET total_correct = total_practiced
            WHERE total_correct > total_practiced
              AND total_practiced >= 0
        """))
        logger.info(f"修复 total_correct > total_practiced: {result.rowcount} 条")

        # 4. 修复负值的计数字段
        for col in ['total_practiced', 'total_correct', 'consecutive_errors',
                     'study_count', 'total_time_spent_seconds']:
            result = db.execute(text(f"""
                UPDATE knowledge_point_records
                SET {col} = 0
                WHERE {col} < 0
            """))
            logger.info(f"修复 {col} < 0: {result.rowcount} 条")

        # 5. 修复 negative wrong counts in daily_practice_records
        for col in ['correct_count', 'incorrect_count', 'total_questions',
                     'total_time_spent_seconds', 'session_count']:
            result = db.execute(text(f"""
                UPDATE daily_practice_records
                SET {col} = 0
                WHERE {col} < 0
            """))
            logger.info(f"修复 daily {col} < 0: {result.rowcount} 条")

        db.commit()
        logger.info("✅ 全部异常数值修复完成")

    except Exception as e:
        db.rollback()
        logger.error(f"修复失败: {e}")
        raise
    finally:
        db.close()


if __name__ == '__main__':
    fix_negative_scores()
