-- Store TOS PDF signatory names (reviewer / approver) per faculty head
CREATE TABLE IF NOT EXISTS tos_signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_head_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
    reviewer_name TEXT NOT NULL DEFAULT '',
    approver_name TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE tos_signatories ENABLE ROW LEVEL SECURITY;

-- Faculty heads can read/write their own row
CREATE POLICY "Faculty heads can view own signatories"
    ON tos_signatories FOR SELECT
    USING (auth.uid() = faculty_head_id);

CREATE POLICY "Faculty heads can insert own signatories"
    ON tos_signatories FOR INSERT
    WITH CHECK (auth.uid() = faculty_head_id);

CREATE POLICY "Faculty heads can update own signatories"
    ON tos_signatories FOR UPDATE
    USING (auth.uid() = faculty_head_id);

-- All authenticated users can read any row (needed for PDF export)
CREATE POLICY "Authenticated users can read signatories"
    ON tos_signatories FOR SELECT
    USING (auth.role() = 'authenticated');
