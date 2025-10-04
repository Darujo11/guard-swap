-- Update existing teams without admin_id to associate with the first admin
UPDATE teams
SET admin_id = (
  SELECT p.id 
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'admin'
  LIMIT 1
)
WHERE admin_id IS NULL;