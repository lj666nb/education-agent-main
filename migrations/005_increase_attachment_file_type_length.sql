-- Migration: 增加 file_type 列长度，支持 PPTX/DOCX 等长 MIME 类型

ALTER TABLE chat_attachments ALTER COLUMN file_type TYPE VARCHAR(255);
ALTER TABLE project_documents ALTER COLUMN file_type TYPE VARCHAR(255);
