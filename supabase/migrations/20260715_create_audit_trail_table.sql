CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL, -- e.g., 'QUIZ_CREATED', 'QUIZ_UPDATED', 'QUIZ_DELETED', 'ANALYSIS_SAVED', 'USER_LOGIN'
    table_name VARCHAR(50), -- e.g., 'quizzes', 'questions', 'profiles'
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_role VARCHAR(50), -- e.g., 'instructor', 'faculty_head', 'admin'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_table_name ON audit_trail(table_name);

-- Enable Row Level Security
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Policy: Faculty heads and admins can view all audit logs
CREATE POLICY "Faculty heads and admins can view all audit logs"
ON audit_trail
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_faculty_head = true OR profiles.is_admin = true)
    )
);

-- Policy: Users can insert audit logs for their own actions
CREATE POLICY "Users can insert their own audit logs"
ON audit_trail
FOR INSERT
WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
);
