export interface CriterionOption {
  label: string;
  points: number;
}

export interface Criterion {
  id: number;
  title: string;
  options: CriterionOption[];
}

export const SCORE_LABELS = [
  { label: "Excepcional", points: 10, color: "score-exceptional" },
  { label: "Ótimo", points: 8, color: "score-great" },
  { label: "Satisfatório", points: 5, color: "score-satisfactory" },
  { label: "Fraco", points: 2.5, color: "score-weak" },
  { label: "Insatisfatório", points: 0, color: "score-unsatisfactory" },
] as const;

export const criteria: Criterion[] = [
  {
    id: 15,
    title: "Conhecimento do Trabalho",
    options: [
      { label: "Demonstra amplo conhecimento do trabalho e possui excelente compreensão das atividades para as quais foi designado.", points: 10 },
      { label: "Demonstra bom conhecimento do trabalho e possui razoável compreensão das atividades executadas.", points: 8 },
      { label: "Demonstra conhecimento suficiente do trabalho.", points: 5 },
      { label: "Apresenta insuficiente entendimento do trabalho, exigindo orientação frequente.", points: 2.5 },
      { label: "Demonstra desconhecimento do trabalho e não executa adequadamente as tarefas.", points: 0 },
    ],
  },
  {
    id: 16,
    title: "Iniciativa e Criatividade",
    options: [
      { label: "Inicia suas atividades com rapidez, apresenta soluções criativas e contribui significativamente para melhorias.", points: 10 },
      { label: "Em geral, inicia suas atividades por conta própria e propõe soluções adequadas.", points: 8 },
      { label: "Inicia suas atividades quando solicitado.", points: 5 },
      { label: "Necessita de orientação constante para iniciar ou desenvolver atividades.", points: 2.5 },
      { label: "Não demonstra iniciativa nem criatividade.", points: 0 },
    ],
  },
  {
    id: 17,
    title: "Resolução de Problemas e Competência",
    options: [
      { label: "Resolve, sozinho, todos os problemas com eficiência.", points: 10 },
      { label: "Resolve sozinho a maioria dos problemas.", points: 8 },
      { label: "Resolve problemas com orientação.", points: 5 },
      { label: "Necessita de ajuda frequente para resolver problemas.", points: 2.5 },
      { label: "Não consegue resolver problemas.", points: 0 },
    ],
  },
  {
    id: 18,
    title: "Adaptação às Novas Tarefas",
    options: [
      { label: "Adapta-se facilmente às novas tarefas, executando-as desde o início com eficiência.", points: 10 },
      { label: "Adapta-se às novas tarefas com pequena orientação.", points: 8 },
      { label: "Adapta-se com algum esforço às novas tarefas.", points: 5 },
      { label: "Apresenta dificuldade em adaptar-se às novas tarefas.", points: 2.5 },
      { label: "Não consegue adaptar-se às novas tarefas.", points: 0 },
    ],
  },
  {
    id: 19,
    title: "Qualidade do Trabalho",
    options: [
      { label: "Seu trabalho tem alto padrão de qualidade, raramente apresentando erros.", points: 10 },
      { label: "Seu trabalho tem boa qualidade, com poucos erros.", points: 8 },
      { label: "A qualidade do trabalho é satisfatória.", points: 5 },
      { label: "Seu trabalho apresenta erros com frequência.", points: 2.5 },
      { label: "Seu trabalho é de baixa qualidade.", points: 0 },
    ],
  },
  {
    id: 20,
    title: "Organização, Higiene e Segurança no Trabalho",
    options: [
      { label: "Mantém elevado cuidado com o material de trabalho, organização e conservação.", points: 10 },
      { label: "Mantém bom cuidado com o material de trabalho, com pequena necessidade de orientação.", points: 8 },
      { label: "Apresenta cuidado razoável com o material e a organização.", points: 5 },
      { label: "Não demonstra cuidado adequado com o material e a organização.", points: 2.5 },
      { label: "Não apresenta cuidado com o material de trabalho nem com a organização.", points: 0 },
    ],
  },
  {
    id: 21,
    title: "Cumprimento dos Prazos",
    options: [
      { label: "Cumpre os prazos exigidos com extrema eficiência.", points: 10 },
      { label: "Cumpre os prazos exigidos na maioria das vezes.", points: 8 },
      { label: "Normalmente cumpre os prazos exigidos.", points: 5 },
      { label: "Nem sempre cumpre os prazos exigidos.", points: 2.5 },
      { label: "Não cumpre os prazos exigidos.", points: 0 },
    ],
  },
  {
    id: 22,
    title: "Relacionamento no Trabalho",
    options: [
      { label: "Tem grande facilidade para se relacionar com as pessoas, atuando de forma ética e cordial.", points: 10 },
      { label: "Relaciona-se bem com as pessoas, mantendo bom clima de trabalho.", points: 8 },
      { label: "Relaciona-se de forma satisfatória com as pessoas.", points: 5 },
      { label: "Apresenta dificuldades no relacionamento interpessoal.", points: 2.5 },
      { label: "Não se relaciona bem com as pessoas, prejudicando o ambiente de trabalho.", points: 0 },
    ],
  },
  {
    id: 23,
    title: "Cooperação e Trabalho em Equipe",
    options: [
      { label: "Demonstra excepcional capacidade de trabalhar em equipe, colaborando constantemente e assumindo responsabilidades.", points: 10 },
      { label: "Demonstra boa capacidade de trabalhar em equipe.", points: 8 },
      { label: "Demonstra capacidade razoável de trabalhar em equipe.", points: 5 },
      { label: "Demonstra pouca disposição para trabalhar em equipe.", points: 2.5 },
      { label: "Não tem capacidade de trabalhar em equipe.", points: 0 },
    ],
  },
  {
    id: 24,
    title: "Disciplina",
    options: [
      { label: "Procede corretamente e por iniciativa própria, conforme normas estabelecidas, sem necessidade de advertências.", points: 10 },
      { label: "Procede conforme normas estabelecidas, com poucas advertências.", points: 8 },
      { label: "Procede conforme normas, porém necessita de advertências ocasionais.", points: 5 },
      { label: "Procede poucas vezes conforme normas, necessitando de advertências frequentes.", points: 2.5 },
      { label: "Não procede conforme normas, mesmo após advertências.", points: 0 },
    ],
  },
];
