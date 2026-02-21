-- Create sections table
CREATE TABLE
    IF NOT EXISTS public.sections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        instructor_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
        section_name VARCHAR(255) NOT NULL,
        description TEXT,
        exam_code VARCHAR(50) UNIQUE,
        color_scheme VARCHAR(50) DEFAULT 'casual-green', -- casual-green, hornblende-green, etc.
        is_archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP
        WITH
            TIME ZONE DEFAULT NOW (),
            updated_at TIMESTAMP
        WITH
            TIME ZONE DEFAULT NOW (),
            UNIQUE (instructor_id, name)
    );