-- Add percentage_type column to extras table
ALTER TABLE extras 
ADD COLUMN percentage_type integer NOT NULL DEFAULT 100 
CHECK (percentage_type IN (50, 100));