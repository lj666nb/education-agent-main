-- 练习会话表 practice_sessions
-- 记录一次完整的练习活动，包含模式、进度、统计

CREATE TABLE IF NOT EXISTS practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL DEFAULT 'random',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    question_order JSONB NOT NULL DEFAULT '[]',
    current_index INTEGER NOT NULL DEFAULT 0,
    stats JSONB NOT NULL DEFAULT '{}',
    answer_mode VARCHAR(20) NOT NULL DEFAULT 'during',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_bank_id ON practice_sessions(bank_id);
