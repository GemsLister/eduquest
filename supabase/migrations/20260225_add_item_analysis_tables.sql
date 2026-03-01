-- Create item_analysis table to store difficulty, discrimination, and distractor data
-- This table stores the results of item analysis for each question

CREATE TABLE IF NOT EXISTS item_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    
    -- Difficulty Index (FI - Facility Index)
    difficulty_index DECIMAL(5,4) CHECK (difficulty_index >= 0 AND difficulty_index <= 1),
    difficulty_status VARCHAR(20) CHECK (difficulty_status IN ('Easy', 'Moderate', 'Difficult')),
    
    -- Discrimination Index
    discrimination_index DECIMAL(5,4) CHECK (discrimination_index >= -1 AND discrimination_index <= 1),
    discrimination_status VARCHAR(20) CHECK (discrimination_status IN ('Excellent', 'Good', 'Acceptable', 'Poor')),
    
    -- Number of students who took this question
    total_takers INTEGER DEFAULT 0,
    correct_takers INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one analysis per question per quiz
    UNIQUE(quiz_id, question_id)
);

-- Create table to store distractor analysis for MCQ questions
CREATE TABLE IF NOT EXISTS item_distractor_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_analysis_id UUID NOT NULL REFERENCES item_analysis(id) ON DELETE CASCADE,
    
    -- Distractor/option identifier
    option_identifier VARCHAR(10),
    
    -- Count and percentage of students who chose this option
    taker_count INTEGER DEFAULT 0,
    taker_percentage DECIMAL(5,2) CHECK (taker_percentage >= 0 AND taker_percentage <= 100),
    
    -- Whether this is the correct answer
    is_correct_answer BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE item_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_distractor_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for instructors (they can manage their own data)
CREATE POLICY "Instructors can view item analysis for their quizzes"
ON item_analysis FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM quizzes
        WHERE quizzes.id = item_analysis.quiz_id
        AND quizzes.instructor_id = auth.uid()
    )
);

CREATE POLICY "Instructors can insert item analysis for their quizzes"
ON item_analysis FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM quizzes
        WHERE quizzes.id = item_analysis.quiz_id
        AND quizzes.instructor_id = auth.uid()
    )
);

CREATE POLICY "Instructors can update item analysis for their quizzes"
ON item_analysis FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM quizzes
        WHERE quizzes.id = item_analysis.quiz_id
        AND quizzes.instructor_id = auth.uid()
    )
);

CREATE POLICY "Instructors can delete item analysis for their quizzes"
ON item_analysis FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM quizzes
        WHERE quizzes.id = item_analysis.quiz_id
        AND quizzes.instructor_id = auth.uid()
    )
);

-- RLS policies for distractor analysis
CREATE POLICY "Instructors can view distractor analysis for their quizzes"
ON item_distractor_analysis FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM item_analysis
        JOIN quizzes ON quizzes.id = item_analysis.quiz_id
        WHERE item_analysis.id = item_distractor_analysis.item_analysis_id
        AND quizzes.instructor_id = auth.uid()
    )
);

CREATE POLICY "Instructors can insert distractor analysis for their quizzes"
ON item_distractor_analysis FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM item_analysis
        JOIN quizzes ON quizzes.id = item_analysis.quiz_id
        WHERE item_analysis.id = item_distractor_analysis.item_analysis_id
        AND quizzes.instructor_id = auth.uid()
    )
);

CREATE POLICY "Instructors can update distractor analysis for their quizzes"
ON item_distractor_analysis FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM item_analysis
        JOIN quizzes ON quizzes.id = item_analysis.quiz_id
        WHERE item_analysis.id = item_distractor_analysis.item_analysis_id
        AND quizzes.instructor_id = auth.uid()
    )
);

CREATE POLICY "Instructors can delete distractor analysis for their quizzes"
ON item_distractor_analysis FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM item_analysis
        JOIN quizzes ON quizzes.id = item_analysis.quiz_id
        WHERE item_analysis.id = item_distractor_analysis.item_analysis_id
        AND quizzes.instructor_id = auth.uid()
    )
);

-- Create indexes for better query performance
CREATE INDEX idx_item_analysis_quiz_id ON item_analysis(quiz_id);
CREATE INDEX idx_item_analysis_question_id ON item_analysis(question_id);
CREATE INDEX idx_item_distractor_analysis_item_id ON item_distractor_analysis(item_analysis_id);

-- Add function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update timestamp
CREATE TRIGGER update_item_analysis_updated_at
    BEFORE UPDATE ON item_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to save item analysis results
CREATE OR REPLACE FUNCTION save_item_analysis(
    p_quiz_id UUID,
    p_question_id UUID,
    p_difficulty_index DECIMAL(5,4),
    p_difficulty_status VARCHAR(20),
    p_discrimination_index DECIMAL(5,4),
    p_discrimination_status VARCHAR(20),
    p_total_takers INTEGER,
    p_correct_takers INTEGER,
    p_distractors JSONB
)
RETURNS UUID AS $$
DECLARE
    v_item_analysis_id UUID;
    v_distractor RECORD;
BEGIN
    -- Insert or update item_analysis
    INSERT INTO item_analysis (
        quiz_id,
        question_id,
        difficulty_index,
        difficulty_status,
        discrimination_index,
        discrimination_status,
        total_takers,
        correct_takers
    ) VALUES (
        p_quiz_id,
        p_question_id,
        p_difficulty_index,
        p_difficulty_status,
        p_discrimination_index,
        p_discrimination_status,
        p_total_takers,
        p_correct_takers
    )
    ON CONFLICT (quiz_id, question_id)
    DO UPDATE SET
        difficulty_index = EXCLUDED.difficulty_index,
        difficulty_status = EXCLUDED.difficulty_status,
        discrimination_index = EXCLUDED.discrimination_index,
        discrimination_status = EXCLUDED.discrimination_status,
        total_takers = EXCLUDED.total_takers,
        correct_takers = EXCLUDED.correct_takers,
        updated_at = NOW()
    RETURNING id INTO v_item_analysis_id;

    -- Delete existing distractors for this item analysis
    DELETE FROM item_distractor_analysis WHERE item_analysis_id = v_item_analysis_id;

    -- Insert new distractor analysis
    IF p_distractors IS NOT NULL THEN
        FOR v_distractor IN SELECT * FROM jsonb_array_elements(p_distractors)
        LOOP
            INSERT INTO item_distractor_analysis (
                item_analysis_id,
                option_identifier,
                taker_count,
                taker_percentage,
                is_correct_answer
            ) VALUES (
                v_item_analysis_id,
                v_distractor->>'optionIdentifier',
                (v_distractor->>'takerCount')::INTEGER,
                (v_distractor->>'takerPercentage')::DECIMAL(5,2),
                (v_distractor->>'isCorrectAnswer')::BOOLEAN
            );
        END LOOP;
    END IF;

    RETURN v_item_analysis_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on the tables for documentation
COMMENT ON TABLE item_analysis IS 'Stores item difficulty and discrimination analysis results for quiz questions';
COMMENT ON TABLE item_distractor_analysis IS 'Stores distractor/option analysis for MCQ questions';
COMMENT ON COLUMN item_analysis.difficulty_index IS 'Facility Index (FI) - proportion of students who answered correctly (0-1)';
COMMENT ON COLUMN item_analysis.discrimination_index IS 'Discrimination Index - measures how well the question differentiates between high and low performers (-1 to 1)';
