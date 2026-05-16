-- Migration: Create admin audit log table
-- Version: 1.0.0
-- Description: Audit log for admin operations

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id),
    target_user_id UUID REFERENCES users(id),
    operation_type VARCHAR(50) NOT NULL,
    operation_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_user ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_log(created_at);

COMMENT ON TABLE admin_audit_log IS 'Audit log for tracking admin operations on user accounts';
