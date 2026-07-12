-- Migration: 015_add_citations_to_chat_messages.sql
-- 为 chat_messages 表添加 citations (JSONB) 列，存储联网搜索引用数据

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT NULL;
