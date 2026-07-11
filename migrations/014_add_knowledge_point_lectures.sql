CREATE TABLE IF NOT EXISTS knowledge_point_lectures (
    point_id UUID PRIMARY KEY REFERENCES knowledge_points(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_mode VARCHAR(30) NOT NULL DEFAULT 'site_summary',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
