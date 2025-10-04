-- Update existing extras without admin_id to associate with their creator or first admin
UPDATE extras
SET admin_id = COALESCE(
  created_by,
  (
    SELECT p.id 
    FROM profiles p
    INNER JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role = 'admin'
    LIMIT 1
  )
)
WHERE admin_id IS NULL;