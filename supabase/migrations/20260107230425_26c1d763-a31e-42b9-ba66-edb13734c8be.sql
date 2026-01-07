-- Adicionar novos campos na tabela profiles para dados pessoais completos
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Criar tabela guard_notes para observações e ocorrências
CREATE TABLE public.guard_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES profiles(id),
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note_type TEXT NOT NULL CHECK (note_type IN ('positive', 'negative', 'neutral', 'incident')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.guard_notes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para guard_notes
CREATE POLICY "Admins can manage their organization notes" 
ON public.guard_notes
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Super admins can manage all notes" 
ON public.guard_notes
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_guard_notes_updated_at
BEFORE UPDATE ON public.guard_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();