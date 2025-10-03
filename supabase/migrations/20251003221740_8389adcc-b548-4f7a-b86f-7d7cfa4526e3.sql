-- Create team_schedules table to store team shift assignments
CREATE TABLE public.team_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, shift_date)
);

-- Enable RLS
ALTER TABLE public.team_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage all schedules"
ON public.team_schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create policy for guards to view schedules
CREATE POLICY "Guards can view schedules"
ON public.team_schedules
FOR SELECT
USING (has_role(auth.uid(), 'guard') OR has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_team_schedules_updated_at
BEFORE UPDATE ON public.team_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_team_schedules_date ON public.team_schedules(shift_date);
CREATE INDEX idx_team_schedules_team_date ON public.team_schedules(team_id, shift_date);