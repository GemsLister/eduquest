-- Add auto_flag column to item_analysis table
ALTER TABLE item_analysis ADD COLUMN IF NOT EXISTS auto_flag VARCHAR(20) DEFAULT 'pending';

-- Update the check constraint for auto_flag values
ALTER TABLE item_analysis DROP CONSTRAINT IF EXISTS item_analysis_auto_flag_check;
ALTER TABLE item_analysis ADD CONSTRAINT item_analysis_auto_flag_check 
CHECK (auto_flag IN ('pending', 'approved', 'needs_revision', 'excellent', 'good', 'acceptable', 'poor'));

-- Add question_id column to item_distractor_analysis for easier upsert
ALTER TABLE item_distractor_analysis ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES questions(id) ON DELETE CASCADE;

-- Create unique constraint for question_id and option_identifier
ALTER TABLE item_distractor_analysis DROP CONSTRAINT IF EXISTS item_distractor_analysis_question_id_option_identifier_key;
ALTER TABLE item_distractor_analysis ADD CONSTRAINT item_distractor_analysis_question_id_option_identifier_key 
UNIQUE (question_id, option_identifier);
