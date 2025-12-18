-- Create leaves table for managing guard time off
CREATE TABLE public.leaves (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(id),
  leave_type text NOT NULL,
  custom_type text, -- For when leave_type = 'OUTRO'
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage their organization leaves"
ON public.leaves
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND admin_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND admin_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

CREATE POLICY "Super admins can manage all leaves"
ON public.leaves
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Guards can view their own leaves"
ON public.leaves
FOR SELECT
USING (
  has_role(auth.uid(), 'guard'::app_role) 
  AND guard_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_leaves_updated_at
BEFORE UPDATE ON public.leaves
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();