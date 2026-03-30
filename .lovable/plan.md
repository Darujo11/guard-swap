

## Plano: Gerar relatório de melhorias para o segurança

### O que será feito

Criar um PDF documentando as melhorias do sistema na perspectiva do **segurança**, com linguagem simples e acessível, cobrindo:

1. **Minha Escala** — calendário pessoal mostrando plantões com trocas aprovadas integradas (gradiente de cores, nome do cedente, ícone de troca)
2. **Solicitação de Trocas** — fluxo completo de solicitação, seleção de datas e segurança, aprovação pelo coordenador
3. **Folgas TRE pelo sistema** — solicitação via calendário, visualização de cotas restantes, protocolo gerado automaticamente
4. **Trocas somente dentro do mês** — restrição ativada pelo admin, dias fora do mês desabilitados no calendário
5. **Plantão trocado passa a ser do segurança** — após aprovação, o dia aparece na escala do segurança e ele pode solicitar nova troca naquele dia

### Abordagem

- Tentar capturar screenshots das telas do preview (login, dashboard do segurança, calendário)
- Gerar PDF com `reportlab` contendo texto explicativo simples + prints quando possível
- Salvar em `/mnt/documents/`

### Formato

PDF em português, ~6-8 páginas, linguagem simples e direta, organizado por funcionalidade com descrições e imagens das telas.

