

## Plano: Gerenciar quantidade de folgas TRE por segurança

### O que será feito

Adicionar uma seção na página de Folgas onde o admin pode selecionar um segurança e definir quantas folgas TRE ele tem direito. Também mostrar quantas já foram usadas e o saldo restante.

### Alterações

#### 1. Nova tabela `guard_tre_quotas` (migração)

```sql
CREATE TABLE public.guard_tre_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid NOT NULL,
  admin_id uuid,
  total_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guard_id)
);

ALTER TABLE public.guard_tre_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their org quotas"
  ON public.guard_tre_quotas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can manage all quotas"
  ON public.guard_tre_quotas FOR ALL TO public
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));
```

#### 2. `src/pages/AdminLeaves.tsx` — Nova seção "Folgas TRE"

- Adicionar card "Folgas TRE" com:
  - Select para escolher segurança
  - Input numérico para definir quantas folgas TRE tem
  - Botão salvar (upsert na tabela `guard_tre_quotas`)
- Tabela mostrando todos os seguranças com:
  - Nome | Total TRE | Usadas | Saldo
  - "Usadas" = contagem de leaves com `leave_type = 'TRE'` daquele segurança (soma dos dias)
  - "Saldo" = Total - Usadas
  - Cor verde se saldo > 0, vermelha se saldo <= 0

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Criar tabela `guard_tre_quotas` com RLS |
| `src/pages/AdminLeaves.tsx` | Adicionar seção de gestão de cotas TRE |

