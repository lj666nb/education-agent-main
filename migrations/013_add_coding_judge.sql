-- Safe coding judge: one published problem per knowledge-point/difficulty slot
-- and private server-side test cases.

ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS primary_knowledge_point_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_questions_primary_knowledge_point'
    ) THEN
        ALTER TABLE questions
            ADD CONSTRAINT fk_questions_primary_knowledge_point
            FOREIGN KEY (primary_knowledge_point_id)
            REFERENCES knowledge_points(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- Existing generated programming questions have no real cases. Keep history by
-- archiving them rather than deleting their rows.
UPDATE questions
SET status = 'archived'
WHERE type = 'programming'
  AND source IS DISTINCT FROM 'oj_curated';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_published_programming_difficulty'
    ) THEN
        ALTER TABLE questions
            ADD CONSTRAINT ck_published_programming_difficulty
            CHECK (
                type <> 'programming'
                OR status <> 'published'
                OR difficulty IN ('basic', 'intermediate', 'advanced')
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_published_programming_point_difficulty
    ON questions(primary_knowledge_point_id, difficulty)
    WHERE type = 'programming'
      AND status = 'published'
      AND primary_knowledge_point_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS coding_test_cases (
    id UUID PRIMARY KEY,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    case_order INTEGER NOT NULL,
    name VARCHAR(120) NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'hidden',
    input_data TEXT NOT NULL DEFAULT '',
    expected_output TEXT NOT NULL DEFAULT '',
    comparator VARCHAR(30) NOT NULL DEFAULT 'trim_lines',
    time_limit_ms INTEGER NOT NULL DEFAULT 3000,
    memory_limit_mb INTEGER NOT NULL DEFAULT 256,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_coding_case_order UNIQUE(question_id, case_order),
    CONSTRAINT ck_coding_case_visibility CHECK (visibility IN ('sample', 'hidden'))
);

CREATE INDEX IF NOT EXISTS ix_coding_test_cases_question_id
    ON coding_test_cases(question_id);
