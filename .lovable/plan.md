

## Plano: Gerar relatório de funcionalidades do sistema com prints

### O que será feito

Criar um PDF documentando as funcionalidades do sistema para administradores, incluindo:

1. **Download e geração de escalas** — escalas individuais e completas com trocas, afastamentos, extras
2. **Gestão de Afastamentos** — registro com tipos (atestado, férias, licença, etc.), upload de documentos, visualização no calendário
3. **Gestão de Folgas TRE** — cadastro de cotas, solicitação pelo segurança, aprovação pelo admin
4. **Calendário do segurança** — visualização integrada de plantões, trocas e afastamentos

### Abordagem

1. Navegar pelas telas do sistema e capturar screenshots das funcionalidades
2. Gerar um PDF com `reportlab` contendo texto explicativo + prints das telas
3. Salvar em `/mnt/documents/`

### Telas a capturar
- Página de Seguranças (botão de gerar escala completa)
- Calendário do segurança (mostrando trocas e afastamentos em vermelho)
- Registro de Afastamento (formulário com tipos e upload)
- Lista de Afastamentos Registrados (com botão de download de documento)
- Gestão de Cotas TRE
- Escala PDF gerada (exemplo)

### Formato
PDF em português, linguagem simples e direta, com imagens das telas intercaladas com descrições das funcionalidades.

