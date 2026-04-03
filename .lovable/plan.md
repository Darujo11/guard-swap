

## Plano: Atualizar Super Admin + Relatórios Completos por Admin

### Contexto
O super admin já existe no sistema com funcionalidades de gerenciar planos e administradores. O usuário quer:
1. Atualizar os dados do super admin atual (credenciais/nome)
2. Poder visualizar e gerenciar os seguranças de cada admin
3. Gerar relatórios completos por admin (trocas, extras, afastamentos, seguranças)

### Parte 1: Atualizar dados do Super Admin

| Arquivo | Detalhe |
|---------|---------|
| `src/pages/CreateSuperAdmin.tsx` | Transformar em formulário editável com campos: nome, email/whatsapp, senha. Detectar se super admin já existe e mostrar formulário de atualização em vez de criação |
| `supabase/functions/create-super-admin-phone/index.ts` | Adicionar suporte a modo "update" para atualizar email, senha e nome do super admin existente |

### Parte 2: Ver seguranças de cada admin

| Arquivo | Detalhe |
|---------|---------|
| `src/pages/SuperAdminManagement.tsx` | Adicionar botão "Ver Seguranças" em cada admin na tabela. Ao clicar, abre dialog/seção mostrando todos os seguranças daquele admin com nome, equipe e status |

### Parte 3: Nova página de Relatórios do Super Admin

| Arquivo | Detalhe |
|---------|---------|
| `src/pages/SuperAdminReports.tsx` | **Nova página** com seletor de admin e período, mostrando resumo completo |
| `src/components/layout/AppLayout.tsx` | Adicionar link "Relatórios" na navegação do super admin |
| `src/App.tsx` | Registrar rota `/super-admin/relatorios` |

### Funcionalidades da página de Relatórios

```text
┌─────────────────────────────────────────────┐
│ Relatórios por Administrador                │
├─────────────────────────────────────────────┤
│ [Selecionar Admin ▼]  [Período: Abril 2026]│
├─────────────────────────────────────────────┤
│ 📊 Resumo                                   │
│ Seguranças: 12  |  Equipes: 4               │
│ Trocas: 8       |  Extras: 45h              │
│ Afastamentos: 3                             │
├─────────────────────────────────────────────┤
│ 🔄 Trocas (tabela com todas as trocas)      │
│ Solicitante | Alvo | Datas | Status         │
├─────────────────────────────────────────────┤
│ ⏰ Extras (tabela com todos os extras)       │
│ Segurança | Data | Horas | Justificativa    │
├─────────────────────────────────────────────┤
│ 📅 Afastamentos                              │
│ Segurança | Tipo | Período | Status         │
├─────────────────────────────────────────────┤
│ 👥 Seguranças                                │
│ Nome | Equipe | Status | Desde              │
├─────────────────────────────────────────────┤
│        [📄 Gerar Relatório PDF]             │
└─────────────────────────────────────────────┘
```

O PDF consolidado incluirá todas as seções acima com:
- Logo da organização
- Cabeçalho com nome do admin e período selecionado
- Tabelas formatadas para cada categoria
- Totalizadores e resumos

### Dados consultados por admin

Todas as queries filtram por `admin_id` do admin selecionado:
- `profiles` (seguranças do admin)
- `teams` (equipes do admin)
- `swap_requests` (trocas)
- `extras` (horas extras)
- `leaves` (afastamentos)
- `guard_tre_quotas` (cotas TRE)
- `evaluations` (avaliações, se houver)

### Navegação atualizada do Super Admin

```text
Planos | Administradores | Relatórios | Resetar Senha | Meu Perfil
```

### Detalhes técnicos
- RLS já permite super_admin acessar todas as tabelas (políticas existentes)
- PDF gerado client-side usando a mesma abordagem do `pdfGenerator.ts` existente
- Seletor de período com mês/ano ou intervalo de datas
- Dados carregados sob demanda ao selecionar admin

