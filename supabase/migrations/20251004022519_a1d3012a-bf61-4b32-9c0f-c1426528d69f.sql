-- Create extras table for tracking extra shifts
CREATE TABLE public.extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  extra_date DATE NOT NULL,
  month_reference DATE NOT NULL,
  justification TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all extras" 
ON public.extras 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Guards can view their own extras" 
ON public.extras 
FOR SELECT 
USING (
  has_role(auth.uid(), 'guard'::app_role) 
  AND guard_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_extras_updated_at
BEFORE UPDATE ON public.extras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_extras_guard_id ON public.extras(guard_id);
CREATE INDEX idx_extras_month_reference ON public.extras(month_reference);