-- Inserir profile para o admin Juvenal (typebot@replic.vip)
INSERT INTO profiles (id, user_id, name, email, is_active, is_shift_chief, admin_id)
VALUES (
  '51cb2c2e-57be-4a93-9833-3a2c5abb3119',
  '51cb2c2e-57be-4a93-9833-3a2c5abb3119',
  'Juvenal',
  'typebot@replic.vip',
  true,
  false,
  NULL
)
ON CONFLICT (id) DO NOTHING;