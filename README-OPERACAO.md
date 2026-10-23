# Escala Smart - Manual de Operacao

Guia pratico para uso diario do sistema por coordenadores, administradores e segurancas.

## 1) Objetivo do sistema

O Escala Smart organiza a rotina de plantoes de equipes de seguranca:

- cadastro de profissionais;
- organizacao de equipes e escalas;
- solicitacao e aprovacao de trocas;
- controle de extras;
- controle de folgas TRE;
- acompanhamento de historico e avaliacoes.

## 2) Perfis de acesso

### Guard (seguranca)

Pode:

- ver sua agenda de plantoes;
- solicitar troca de plantao;
- acompanhar status de trocas;
- consultar informacoes do proprio perfil.

### Admin (coordenador/gestor da equipe)

Pode:

- cadastrar e editar segurancas;
- montar equipes e escalas;
- aprovar/rejeitar trocas;
- registrar extras;
- analisar e decidir folgas TRE;
- registrar fichas e avaliacoes.

### Super Admin

Pode:

- gerenciar planos e assinaturas;
- gerenciar administradores;
- acessar relatorios gerais;
- resetar senha de usuarios administrativos.

## 3) Como entrar no sistema

1. Abra a pagina de login.
2. Informe login e senha.
3. Clique em entrar.
4. O sistema redireciona automaticamente para o painel correto do seu perfil.

Observacao:

- alguns usuarios (principalmente guardas) entram com telefone, conforme padrao da organizacao.

## 4) Tela por tela (visao operacional)

## 4.1 Painel do Guard

Principais acoes:

- visualizar proximos plantoes;
- abrir solicitacao de troca;
- acompanhar resposta do colega e decisao do admin.

Fluxo de troca (guard):

1. selecionar colega disponivel;
2. escolher data do seu plantao e data do plantao do colega;
3. informar motivo;
4. enviar solicitacao;
5. aguardar confirmacao do colega;
6. aguardar aprovacao do admin.

Status comuns:

- `pendente`: aguardando confirmacao/aprovacao;
- `aprovada`: troca concluida;
- `rejeitada`: troca negada.

## 4.2 Painel do Admin

### Segurancas

Usado para:

- cadastrar novo seguranca;
- editar dados;
- ativar/desativar;
- vincular a equipe.

### Escalas

Usado para:

- criar e ajustar plantoes;
- revisar distribuicao por equipe e data.

### Trocas

Usado para:

- revisar solicitacoes recebidas;
- aprovar ou rejeitar;
- acompanhar historico.

Boa pratica:

- validar se a troca nao compromete cobertura minima antes de aprovar.

### Extras

Usado para:

- lancar horas extras;
- definir percentual/tipo e quantidade;
- manter referencia mensal correta.

### Folgas

Usado para:

- receber solicitacoes;
- aprovar/rejeitar folga TRE;
- controlar saldo de folgas do profissional.

### Fichas / Perfil funcional

Usado para:

- registrar ocorrencias e anotacoes;
- manter historico por profissional.

### Avaliacoes

Usado para:

- simular avaliacao;
- registrar pontuacao;
- consultar historico de avaliacoes.

## 4.3 Painel do Super Admin

### Planos

Usado para:

- criar/editar planos;
- ajustar preco, limite e recursos.

### Administradores

Usado para:

- criar, editar e remover admins;
- acompanhar status de atividade.

### Relatorios

Usado para:

- visualizar consolidado de operacao.

### Reset de senha

Usado para:

- redefinir senha de usuarios com permissao administrativa.

## 5) Fluxos operacionais principais

## 5.1 Cadastro de novo seguranca

1. entrar em `Admin > Segurancas`;
2. clicar em novo cadastro;
3. preencher nome e telefone;
4. definir equipe (se aplicavel);
5. salvar;
6. informar credenciais de acesso ao profissional.

## 5.2 Aprovacao de troca de plantao

1. entrar em `Admin > Trocas`;
2. abrir solicitacao pendente;
3. revisar datas e envolvidos;
4. aprovar ou rejeitar;
5. se aprovado, conferir se a escala foi atualizada.

## 5.3 Registro de hora extra

1. entrar em `Admin > Extras`;
2. selecionar profissional;
3. preencher data, justificativa e quantidade;
4. confirmar tipo/percentual;
5. salvar.

## 5.4 Decisao de folga TRE

1. entrar em `Admin > Folgas`;
2. abrir pedido;
3. conferir saldo do profissional;
4. aprovar ou rejeitar;
5. confirmar recebimento da notificacao pelo solicitante.

## 6) Notificacoes e comunicacoes

O sistema possui automacoes de comunicacao:

- lembrete de troca aprovada para o dia seguinte (WhatsApp);
- alerta de solicitacao de folga TRE para admin;
- retorno de aprovacao/rejeicao de folga para guarda;
- aviso por WhatsApp a cada etapa da troca (solicitada, aceita, aprovada, rejeitada).

Se uma notificacao externa falhar, o registro principal no sistema geralmente continua salvo.

## 7) Rotina recomendada (admin)

Inicio do turno:

- revisar trocas pendentes;
- revisar folgas pendentes;
- conferir escala dos proximos dias.

Durante o turno:

- registrar extras e eventos relevantes;
- manter cadastros atualizados.

Fim do turno:

- validar pendencias do dia;
- confirmar se nao ha solicitacoes criticas sem resposta.

## 8) Boas praticas de uso

- manter telefone dos profissionais atualizado;
- usar justificativas claras em trocas e extras;
- evitar aprovacoes sem revisar impacto da escala;
- registrar decisoes importantes para manter historico confiavel;
- padronizar rotina de analise diaria para reduzir esquecimentos.

## 9) Erros comuns e como agir

### Nao consigo entrar

- verificar login/senha;
- confirmar se usuario esta ativo;
- solicitar reset de senha para responsavel.

### Troca nao concluiu

- conferir se o colega confirmou;
- conferir se admin aprovou;
- revisar datas informadas.

### Notificacao de WhatsApp nao chegou

- confirmar telefone cadastrado;
- confirmar se operacao foi salva no sistema;
- em caso recorrente, acionar suporte tecnico.

### Usuario sem permissao para tela

- verificar perfil atribuido (`guard`, `admin` ou `super_admin`);
- pedir ajuste para administrador responsavel.

## 10) Checklist rapido de treinamento

Para novos admins:

- [ ] entrar no sistema;
- [ ] cadastrar seguranca;
- [ ] criar/editar escala;
- [ ] aprovar uma troca;
- [ ] registrar um extra;
- [ ] decidir uma folga TRE;
- [ ] consultar ficha e avaliacao.

Para novos guards:

- [ ] entrar no sistema;
- [ ] localizar agenda de plantoes;
- [ ] abrir solicitacao de troca;
- [ ] acompanhar status da solicitacao;
- [ ] consultar perfil.

## 11) Quando acionar suporte tecnico

Acione suporte quando houver:

- erro recorrente em tela;
- perda de dados aparentes;
- falha repetida em notificacoes;
- problema de permissao incoerente;
- divergencia entre escala exibida e escala esperada apos aprovacao de troca.

---

Se voce quiser, posso gerar uma versao desse manual em formato "SOP" (procedimento operacional padrao) com passos curtos e pronto para treinamento interno.
