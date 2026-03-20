-- Create table for storing quiz analysis submissions forwarded to admin
CREATE TABLE IF NOT EXISTS quiz_analysis_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_results JSONB NOT NULL,
    instructor_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revision_requested', 'rejected')),
    admin_feedback TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quiz_analysis_submissions_status') THEN
        CREATE INDEX idx_quiz_analysis_submissions_status ON quiz_analysis_submissions(status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quiz_analysis_submissions_instructor') THEN
        CREATE INDEX idx_quiz_analysis_submissions_instructor ON quiz_analysis_submissions(instructor_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quiz_analysis_submissions_quiz') THEN
        CREATE INDEX idx_quiz_analysis_submissions_quiz ON quiz_analysis_submissions(quiz_id);
    END IF;
END
$$;

-- Enable RLS
ALTER TABLE quiz_analysis_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Instructors can insert own submissions" ON quiz_analysis_submissions;
CREATE POLICY "Instructors can insert own submissions"
ON quiz_analysis_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = instructor_id);

DROP POLICY IF EXISTS "Instructors can view own submissions" ON quiz_analysis_submissions;
CREATE POLICY "Instructors can view own submissions"
ON quiz_analysis_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = instructor_id);

DROP POLICY IF EXISTS "Admins can view all submissions" ON quiz_analysis_submissions;
CREATE POLICY "Admins can view all submissions"
ON quiz_analysis_submissions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
);

DROP POLICY IF EXISTS "Admins can update submissions" ON quiz_analysis_submissions;
CREATE POLICY "Admins can update submissions"
ON quiz_analysis_submissions
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quiz_analysis_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_update_quiz_analysis_submissions_updated_at ON quiz_analysis_submissions;
CREATE TRIGGER trigger_update_quiz_analysis_submissions_updated_at
    BEFORE UPDATE ON quiz_analysis_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_quiz_analysis_submissions_updated_at();
