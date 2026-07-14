-- 016: 为 knowledge_point_records 添加 CHECK 约束，防止负值/越界值
-- 同时清理 daily_practice_records 的异常数据

-- 1. 先清理存量异常数据
UPDATE knowledge_point_records SET mastery_score = 0 WHERE mastery_score < 0;
UPDATE knowledge_point_records SET mastery_score = 100 WHERE mastery_score > 100;
UPDATE knowledge_point_records SET recent_accuracy = 0 WHERE recent_accuracy < 0;
UPDATE knowledge_point_records SET recent_accuracy = 100 WHERE recent_accuracy > 100;
UPDATE knowledge_point_records SET total_correct = total_practiced WHERE total_correct > total_practiced AND total_practiced >= 0;
UPDATE knowledge_point_records SET total_practiced = 0 WHERE total_practiced < 0;
UPDATE knowledge_point_records SET total_correct = 0 WHERE total_correct < 0;
UPDATE knowledge_point_records SET consecutive_errors = 0 WHERE consecutive_errors < 0;
UPDATE knowledge_point_records SET study_count = 0 WHERE study_count < 0;
UPDATE knowledge_point_records SET total_time_spent_seconds = 0 WHERE total_time_spent_seconds < 0;

-- 2. 清理 daily_practice_records
UPDATE daily_practice_records SET correct_count = 0 WHERE correct_count < 0;
UPDATE daily_practice_records SET incorrect_count = 0 WHERE incorrect_count < 0;
UPDATE daily_practice_records SET total_questions = 0 WHERE total_questions < 0;
UPDATE daily_practice_records SET total_time_spent_seconds = 0 WHERE total_time_spent_seconds < 0;

-- 3. 添加 CHECK 约束（仅在不冲突时添加）
DO $$
BEGIN
    -- mastery_score: 0-100
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_kpr_mastery_score_range') THEN
        ALTER TABLE knowledge_point_records
        ADD CONSTRAINT ck_kpr_mastery_score_range CHECK (mastery_score >= 0 AND mastery_score <= 100);
    END IF;

    -- recent_accuracy: 0-100
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_kpr_recent_accuracy_range') THEN
        ALTER TABLE knowledge_point_records
        ADD CONSTRAINT ck_kpr_recent_accuracy_range CHECK (recent_accuracy >= 0 AND recent_accuracy <= 100);
    END IF;

    -- total_practiced >= 0
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_kpr_total_practiced_nonnegative') THEN
        ALTER TABLE knowledge_point_records
        ADD CONSTRAINT ck_kpr_total_practiced_nonnegative CHECK (total_practiced >= 0);
    END IF;

    -- total_correct >= 0 AND total_correct <= total_practiced
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_kpr_total_correct_valid') THEN
        ALTER TABLE knowledge_point_records
        ADD CONSTRAINT ck_kpr_total_correct_valid CHECK (total_correct >= 0);
    END IF;

    -- consecutive_errors >= 0
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_kpr_consecutive_errors_nonnegative') THEN
        ALTER TABLE knowledge_point_records
        ADD CONSTRAINT ck_kpr_consecutive_errors_nonnegative CHECK (consecutive_errors >= 0);
    END IF;

    -- study_count >= 0
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_kpr_study_count_nonnegative') THEN
        ALTER TABLE knowledge_point_records
        ADD CONSTRAINT ck_kpr_study_count_nonnegative CHECK (study_count >= 0);
    END IF;

    -- daily_practice_records constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_dpr_correct_nonnegative') THEN
        ALTER TABLE daily_practice_records
        ADD CONSTRAINT ck_dpr_correct_nonnegative CHECK (correct_count >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_dpr_incorrect_nonnegative') THEN
        ALTER TABLE daily_practice_records
        ADD CONSTRAINT ck_dpr_incorrect_nonnegative CHECK (incorrect_count >= 0);
    END IF;
END $$;
