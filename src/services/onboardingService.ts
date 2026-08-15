/* Onboarding de uma empresa nova.
 *
 * O progresso NÃO é um campo salvo em lugar nenhum: é DERIVADO do estado real da configuração a
 * cada leitura. Isso importa por dois motivos. Primeiro, um flag "onboarding concluído" mentiria
 * assim que alguém apagasse a última escala — o painel diria "pronto" com a empresa quebrada.
 * Segundo, quem configurou tudo por fora (direto nas abas de Configurações, sem seguir o roteiro)
 * aparece corretamente como concluído, sem ter que refazer nada.
 *
 * Nenhum passo é obrigatório para usar o sistema. O roteiro orienta; não bloqueia. A pessoa pode
 * parar no meio, sair, voltar dias depois — o progresso é recalculado do zero e continua de onde
 * o cadastro dela realmente está. */
import type { WorkspaceConfig } from '../domain';

export type ChavePasso =
  | 'empresa'
  | 'unidades'
  | 'setores'
  | 'escalas'
  | 'colaboradores'
  | 'regras'
  | 'integracoes'
  | 'usuarios'
  | 'dados';

export interface PassoOnboarding {
  chave: ChavePasso;
  titulo: string;
  descricao: string;
  /** Aba de Configurações correspondente, ou rota própria quando o passo não é de cadastro. */
  destino: string;
  concluido: boolean;
  /** Sem isso o sistema não consegue analisar nenhuma jornada. */
  essencial: boolean;
  /** Por que este passo existe — mostrado no painel, para o passo não parecer burocracia. */
  porque: string;
}

export interface ProgressoOnboarding {
  passos: PassoOnboarding[];
  concluidos: number;
  total: number;
  percentual: number;
  /** Passos essenciais que faltam. Enquanto houver, a operação não roda de verdade. */
  essenciaisPendentes: PassoOnboarding[];
  /** Próximo passo sugerido: o primeiro essencial pendente, senão o primeiro pendente. */
  proximo: PassoOnboarding | null;
  /** true quando todos os passos, essenciais ou não, estão concluídos. */
  completo: boolean;
  /** true quando o mínimo para analisar jornada já existe. */
  prontoParaOperar: boolean;
}

/* `temDadosProcessados` vem de fora (TimeRecordRepository) porque este service é puro sobre a
 * configuração — quem chama já tem o dado em mãos e evita um acoplamento desnecessário. */
export function calcularProgresso(ws: WorkspaceConfig, temDadosProcessados: boolean): ProgressoOnboarding {
  const passos: PassoOnboarding[] = [
    {
      chave: 'empresa',
      titulo: 'Empresa',
      descricao: 'Nome, CNPJ e identificação',
      destino: '/configuracoes?aba=empresa',
      concluido: !!ws.company.nome.trim(),
      essencial: true,
      porque: 'É o nome que aparece no sistema inteiro e nos relatórios exportados.',
    },
    {
      chave: 'unidades',
      titulo: 'Unidades',
      descricao: 'Filiais, bases ou centros de custo',
      destino: '/configuracoes?aba=unidades',
      concluido: ws.units.length > 0,
      essencial: false,
      porque: 'Permite comparar filiais entre si no Dashboard. Se a operação for única, pode pular.',
    },
    {
      chave: 'setores',
      titulo: 'Setores',
      descricao: 'Áreas responsáveis pelas ocorrências',
      destino: '/configuracoes?aba=setores',
      concluido: ws.departments.length > 0,
      essencial: true,
      porque: 'São as opções oferecidas ao classificar uma pendência, aqui e dentro do Assistente HE.',
    },
    {
      chave: 'escalas',
      titulo: 'Escalas',
      descricao: 'Horário padrão de trabalho',
      destino: '/configuracoes?aba=escalas',
      concluido: ws.schedules.length > 0,
      essencial: true,
      porque: 'Sem horário padrão o sistema não tem contra o que comparar — nenhuma jornada pode ser julgada.',
    },
    {
      chave: 'colaboradores',
      titulo: 'Colaboradores',
      descricao: 'Quem trabalha na operação',
      destino: '/configuracoes?aba=colaboradores',
      concluido: ws.employees.length > 0,
      essencial: true,
      porque: 'Liga cada registro de ponto a um setor e a uma unidade nos indicadores.',
    },
    {
      chave: 'regras',
      titulo: 'Regras',
      descricao: 'Tolerância, meta, jornada e prazos',
      destino: '/configuracoes?aba=regras',
      concluido: ws.rules.dailyGoalMin > 0,
      essencial: false,
      porque:
        'As regras já nascem com valores padrão razoáveis. Só a meta diária nasce zerada — o sistema não assume a meta de nenhuma empresa.',
    },
    {
      chave: 'integracoes',
      titulo: 'Integrações',
      descricao: 'De onde vêm os dados',
      destino: '/configuracoes?aba=integracoes',
      concluido: ws.integrations.some((i) => i.status === 'configurado'),
      essencial: false,
      porque: 'Hoje a importação por arquivo já funciona. As demais fontes ficam registradas para quando houver servidor.',
    },
    {
      chave: 'usuarios',
      titulo: 'Usuários',
      descricao: 'Quem vai operar o sistema',
      destino: '/configuracoes?aba=usuarios',
      concluido: ws.users.length > 0,
      essencial: false,
      porque: 'Aparecem como opções de responsável ao atribuir uma pendência.',
    },
    {
      chave: 'dados',
      titulo: 'Primeiros dados',
      descricao: 'Processar o primeiro dia',
      destino: '/motor-he',
      concluido: temDadosProcessados,
      essencial: true,
      porque: 'É o que liga o sistema: sem um dia processado, todos os indicadores ficam vazios.',
    },
  ];

  const concluidos = passos.filter((p) => p.concluido).length;
  const essenciaisPendentes = passos.filter((p) => p.essencial && !p.concluido);
  const proximo = essenciaisPendentes[0] ?? passos.find((p) => !p.concluido) ?? null;

  return {
    passos,
    concluidos,
    total: passos.length,
    percentual: Math.round((concluidos / passos.length) * 100),
    essenciaisPendentes,
    proximo,
    completo: concluidos === passos.length,
    prontoParaOperar: essenciaisPendentes.length === 0,
  };
}

/* Um workspace é "recém-criado" quando nada operacional aconteceu nele ainda. Usado pelas telas
 * para distinguir "esta empresa ainda não tem dados" de "esta empresa não tem problemas" — a
 * diferença mais importante da experiência de um cliente novo. */
export function ambienteVazio(ws: WorkspaceConfig, temDadosProcessados: boolean): boolean {
  return !temDadosProcessados && ws.employees.length === 0;
}
