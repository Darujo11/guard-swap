

## Plano: Upload de documento comprobatório no registro de afastamento

### O que será feito

Permitir que o admin anexe um documento (atestado, comprovante, etc.) ao registrar um afastamento. Na lista de afastamentos registrados, será possível fazer download do documento anexado.

### Alterações

#### 1. Coluna no banco — `document_url`

```sql
ALTER TABLE leaves ADD COLUMN document_url text;
```

#### 2. Bucket de storage — `leave-documents`

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('leave-documents', 'leave-documents', true);

CREATE POLICY "Admins can upload leave documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'leave-documents' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Anyone authenticated can view leave documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'leave-documents');

CREATE POLICY "Admins can delete leave documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'leave-documents' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')));
```

#### 3. `src/pages/AdminLeaves.tsx`

- **Interface `Leave`**: adicionar `document_url: string | null`
- **Novo estado**: `documentFile` (`File | null`)
- **No formulário**: campo de upload de arquivo (`<Input type="file" />`) com label "Documento Comprobatório (opcional)", aceitar PDF/imagem
- **No `handleSubmit`**: se `documentFile` existir, fazer upload para `leave-documents/{leaveId}/{filename}` via `supabase.storage`, depois atualizar o registro com `document_url` (URL pública)
- **Na tabela de afastamentos**: adicionar coluna "Doc" com botão de download (ícone) que abre o `document_url` em nova aba. Mostrar apenas quando `document_url` existir
- **No `fetchLeaves`**: incluir `document_url` na query (já vem automaticamente)

### Fluxo
```text
Admin seleciona arquivo → submit → insert leave → upload arquivo para storage → update leave com document_url
Lista: botão download abre document_url em nova aba
```

### Escopo
| Alteração | Detalhe |
|-----------|---------|
| Migração SQL | Coluna `document_url` + bucket `leave-documents` com policies |
| `src/pages/AdminLeaves.tsx` | Input file, upload no submit, botão download na lista |

