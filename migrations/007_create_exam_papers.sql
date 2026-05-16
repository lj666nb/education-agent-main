-- 试卷表 exam_papers
-- 使用 JSONB 存储章节配置和题目引用

CREATE TABLE IF NOT EXISTS exam_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    generate_method VARCHAR(20) NOT NULL DEFAULT 'manual',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    total_questions INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 100,
    time_limit_minutes INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_papers_bank_id ON exam_papers(bank_id);
CREATE INDEX IF NOT EXISTS idx_exam_papers_owner_id ON exam_papers(owner_id);
