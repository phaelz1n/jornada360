/* Catálogo do portfólio.
 *
 * É deliberadamente um arquivo de DADOS, não um CMS: adicionar um projeto novo é acrescentar um
 * objeto a `PROJETOS`, sem tocar em componente nenhum. A tela (src/pages/Portfolio.tsx) itera sobre
 * esta lista e renderiza qualquer quantidade de projetos.
 *
 * REGRA DE CONTEÚDO: nada aqui pode conter nome real de pessoa, dado real de operação, número real
 * de cliente ou qualquer informação confidencial. O portfólio descreve capacidades e arquitetura —
 * demonstração de dado é responsabilidade exclusiva do ambiente de demonstração, que é fictício. */

export type EstadoProjeto = 'em_evolucao' | 'concluido' | 'conceito';

export const ESTADO_PROJETO_LABEL: Record<EstadoProjeto, string> = {
  em_evolucao: 'Produto em evolução',
  concluido: 'Concluído',
  conceito: 'Conceito',
};

export interface EtapaFluxo {
  titulo: string;
  descricao: string;
}

export interface ModuloProjeto {
  nome: string;
  descricao: string;
}

export interface BlocoArquitetura {
  camada: string;
  itens: string[];
}

export interface Projeto {
  id: string;
  nome: string;
  subtitulo: string;
  estado: EstadoProjeto;
  resumo: string;
  /** Problemas concretos que o projeto resolve — o "por que ele existe". */
  problemas: string[];
  /** O caminho que o dado percorre dentro do produto. */
  fluxo: EtapaFluxo[];
  modulos: ModuloProjeto[];
  arquitetura: BlocoArquitetura[];
  /** Decisões de engenharia que valem ser explicadas numa conversa técnica. */
  decisoes: { titulo: string; texto: string }[];
  /** Rotas internas oferecidas como ação (só existem para projetos rodando nesta aplicação). */
  acoes?: { label: string; destino: string; principal?: boolean }[];
  /** Tecnologias, para leitura rápida. */
  stack: string[];
}

export const PROJETOS: Projeto[] = [
  {
    id: 'jornada360',
    nome: 'Jornada360',
    subtitulo: 'Central Inteligente de Gestão e Auditoria de Jornada',
    estado: 'em_evolucao',
    resumo:
      'Plataforma para controle, análise, auditoria e gestão inteligente da jornada de trabalho. Cruza ponto, escala, rastreamento e horário padrão, identifica jornadas fora do esperado e conduz cada ocorrência até a resolução auditada.',
    problemas: [
      'Horas extras sem controle nem justificativa registrada',
      'Intervalos e descanso entre jornadas não conferidos',
      'Divergências entre o ponto batido e o que foi efetivamente trabalhado',
      'Reincidências que passam despercebidas por falta de visão histórica',
      'Ocorrências tratadas sem rastro de quem decidiu o quê e por quê',
      'Pendências esquecidas por não haver responsável nem prazo',
      'Auditoria trabalhista sem documentação de suporte',
    ],
    fluxo: [
      { titulo: 'Dados', descricao: 'Espelho de ponto, escala, rastreamento e horário padrão do dia' },
      { titulo: 'Análise', descricao: 'Cruzamento das quatro fontes e cálculo de jornada e hora extra' },
      { titulo: 'Detecção', descricao: 'Comparação com o padrão cadastrado e a tolerância configurada' },
      { titulo: 'Pendências', descricao: 'Cada ocorrência vira uma unidade de trabalho rastreável' },
      { titulo: 'Priorização', descricao: 'Recomendação determinística por gravidade e reincidência' },
      { titulo: 'Ação', descricao: 'Responsável designado, prazo definido, SLA acompanhado' },
      { titulo: 'Resolução', descricao: 'Causa e justificativa registradas por quem tratou' },
      { titulo: 'Auditoria', descricao: 'Revisão, aprovação ou reprovação, e trilha completa' },
    ],
    modulos: [
      { nome: 'Dashboard Executivo', descricao: 'Indicadores de qualidade, evolução, rankings e pontos de atenção' },
      { nome: 'Controle de Ponto', descricao: 'Todos os registros analisados com situação e alertas de jornada' },
      { nome: 'Horas Extras', descricao: 'Acumulado e excedente por colaborador' },
      { nome: 'Assistente HE Diário', descricao: 'Motor de cruzamento das quatro fontes de dados' },
      { nome: 'Ranking de Reincidência', descricao: 'Quem repete ocorrências acima do limite configurado' },
      { nome: 'Score do Colaborador', descricao: 'Cinco dimensões medidas, com composição explicada' },
      { nome: 'Pendências', descricao: 'Ficha completa com explicação, resolução e revisão' },
      { nome: 'Centro de Ações', descricao: 'Fila operacional priorizada com prazo e ação necessária' },
      { nome: 'Análise por Setor', descricao: 'Origem estrutural das ocorrências' },
      { nome: 'Relatórios', descricao: 'Sete relatórios com exportação em CSV' },
      { nome: 'Auditoria', descricao: 'Quem alterou o quê, quando e por quê' },
      { nome: 'Configurações', descricao: 'Empresa, estrutura, regras, integrações e usuários' },
      { nome: 'Importação de Dados', descricao: 'Entrada por arquivo, com camada de integração extensível' },
    ],
    arquitetura: [
      { camada: 'Interface', itens: ['React 19', 'TypeScript', 'Vite', 'Recharts'] },
      { camada: 'Domínio', itens: ['Entidades puras', 'Taxonomia de status', 'Regras por empresa'] },
      { camada: 'Serviços', itens: ['Análise', 'Priorização', 'SLA', 'Score', 'Relatórios', 'Onboarding'] },
      { camada: 'Repositórios', itens: ['Contrato estável', 'Implementação substituível', 'Namespace por empresa'] },
      { camada: 'Motor de análise', itens: ['Cruzamento de quatro fontes', 'Correspondência difusa de nomes'] },
      { camada: 'Persistência', itens: ['localStorage isolado por empresa', 'Preparado para API'] },
    ],
    decisoes: [
      {
        titulo: 'Nunca inventar um número',
        texto:
          'Quando um indicador não pode ser calculado — falta cadastro, falta um limiar que a empresa ainda não definiu, falta o dado na origem — o sistema mostra "—" e explica o que falta. Preencher com zero ou com uma estimativa daria uma falsa sensação de completude, que num sistema de auditoria é pior do que a lacuna.',
      },
      {
        titulo: 'Recomendar não é decidir',
        texto:
          'A priorização sugere um nível e explica o motivo; o prazo padrão sugere uma data. Nenhuma das duas escreve sozinha. A decisão continua sendo de quem responde por ela, e a sugestão nunca sobrescreve uma escolha manual.',
      },
      {
        titulo: 'Motor legado preservado',
        texto:
          'O cruzamento das planilhas já existia e funcionava, validado contra dados reais. Em vez de reescrevê-lo, ele foi incorporado intacto e teve apenas o que era específico de uma empresa extraído para configuração — todo o parsing e a lógica de correspondência continuam exatamente como estavam.',
      },
      {
        titulo: 'Camada de repositórios desde o primeiro dia',
        texto:
          'A interface nunca fala com o armazenamento diretamente. Isso torna a migração para um servidor uma troca de implementação, não uma reescrita: o contrato e tudo acima dele permanecem.',
      },
      {
        titulo: 'Isolamento por empresa como requisito, não como recurso',
        texto:
          'Cada empresa tem namespace próprio de armazenamento. Uma empresa nova nasce vazia e não herda nada — nem da demonstração, nem de outra empresa. O ambiente fictício é blindado para nunca ser semeado num ambiente real.',
      },
    ],
    acoes: [
      { label: 'Ver demonstração', destino: '/bem-vindo', principal: false },
      { label: 'Conhecer o sistema', destino: '/apresentacao', principal: true },
    ],
    stack: ['React 19', 'TypeScript', 'Vite', 'Recharts', 'Arquitetura em camadas'],
  },
];

export function buscarProjeto(id: string): Projeto | undefined {
  return PROJETOS.find((p) => p.id === id);
}
