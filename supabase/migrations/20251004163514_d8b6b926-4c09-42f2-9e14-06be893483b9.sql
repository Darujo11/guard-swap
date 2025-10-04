-- Corrigir admin_id do primeiro admin (Coordenador Moraes)
-- O admin_id deve apontar para o próprio profile.id do admin
UPDATE profiles
SET admin_id = id
WHERE id = 'ea081de3-9d84-46e7-8c45-f790137858ec'
  AND admin_id IS NULL;

-- Atualizar todos os guardas sem admin_id para pertencerem ao primeiro admin
-- (assumindo que foram criados por ele)
UPDATE profiles p
SET admin_id = 'ea081de3-9d84-46e7-8c45-f790137858ec'
WHERE p.admin_id IS NULL
  AND EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = p.user_id 
    AND ur.role = 'guard'
  );

-- Garantir que o segundo admin também tenha admin_id correto
UPDATE profiles
SET admin_id = id
WHERE id = '6a877f07-6d4b-406e-847d-c3b9e94d8c0b'
  AND (admin_id IS NULL OR admin_id != id);