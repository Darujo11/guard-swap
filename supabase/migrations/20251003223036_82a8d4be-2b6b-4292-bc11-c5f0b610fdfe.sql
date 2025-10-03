-- Add color column to teams table
ALTER TABLE public.teams 
ADD COLUMN color TEXT NOT NULL DEFAULT '#3b82f6';

-- Add some default colors for existing teams
UPDATE public.teams 
SET color = CASE 
  WHEN name = 'Equipe A' THEN '#3b82f6'
  WHEN name = 'Equipe B' THEN '#10b981'
  WHEN name = 'Equipe C' THEN '#f59e0b'
  WHEN name = 'Equipe D' THEN '#ef4444'
  ELSE '#3b82f6'
END;