-- Adicionar campos para as duas datas da troca
-- Renomear swap_date para requester_shift_date (data do plantão do solicitante)
ALTER TABLE swap_requests 
RENAME COLUMN swap_date TO requester_shift_date;

-- Adicionar target_shift_date (data do plantão que o solicitante quer assumir)
ALTER TABLE swap_requests 
ADD COLUMN target_shift_date date NOT NULL DEFAULT CURRENT_DATE;

-- Remover o default após adicionar a coluna
ALTER TABLE swap_requests 
ALTER COLUMN target_shift_date DROP DEFAULT;

COMMENT ON COLUMN swap_requests.requester_shift_date IS 'Data do plantão do solicitante que será trocado';
COMMENT ON COLUMN swap_requests.target_shift_date IS 'Data do plantão do alvo que o solicitante quer assumir';