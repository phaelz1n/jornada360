/* Gera o dataset fictício do ambiente Demonstração — 5 colaboradores inventados, ~12 dias de
 * ponto/HE/divergências/pendências/justificativas, no MESMO formato (HEDiaSnapshot/HECaseState)
 * que o motor real do Assistente HE Diário produz. Por isso todas as telas existentes (Dashboard,
 * Pendências, Controle de Ponto, Ranking, Score, Análise por Setor, Relatório) funcionam com o
 * Demo sem nenhum código condicional de exibição — o Demo não é "uma versão simplificada", é dado
 * fictício passando pelo mesmo caminho que dado real passaria.
 *
 * Também é o ÚNICO lugar do projeto que aplica valores de EXEMPLO à configuração de um workspace
 * (setores, causas mais variadas, meta diária) — o workspace `real` nunca recebe esse enriquecimento
 * (nasce com os defaults neutros de domain/Rules.ts e domain/WorkspaceConfig.ts).
 *
 * Roda uma vez (na primeira vez que o workspace `demo` não tem nenhum dia processado ainda) e
 * nunca sobrescreve dado já existente — se o usuário editar/resolver casos no Demo, o seed não
 * volta a rodar por cima. Para recomeçar o Demo do zero, use "Limpar histórico" (Dashboard) nesse
 * workspace. */
import { TimeRecordRepository } from '../repositories/TimeRecordRepository';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { DepartmentRepository } from '../repositories/DepartmentRepository';
import type { HEDiaSnapshot, HEItemRaw, ItemStatus, PadraoStatus } from '../engine/heEngineCore';

function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

const COLABORADORES = ['João da Silva', 'Carlos Oliveira', 'Marcos Santos', 'Ana Ferreira', 'Juliana Costa'];
const SETORES = ['Operacional', 'Trânsito', 'Garagem', 'Administrativo', 'Operacional'];
const CAUSAS = [
  'Rastreador com defeito',
  'Hábito de bater ponto errado',
  'Escala desatualizada',
  'Autorizado antecipadamente',
];

function mulberry32(seed: number) {
  let s = seed;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function minToStr(totalMin: number): string {
  const m = ((totalMin % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function gerarDia(dateKey: string, rng: () => number): HEDiaSnapshot {
  const items: HEItemRaw[] = COLABORADORES.map((nome, idx) => {
    const padraoMin = 30 + Math.floor(rng() * 30); // HE programada: 30-60min
    const variacao = Math.floor(rng() * 95) - 25; // -25 a +70min sobre o programado
    const he1min = Math.max(0, padraoMin + variacao);
    const excedenteMin = he1min - padraoMin;
    const padraoStatus: PadraoStatus = excedenteMin > 10 ? 'acima' : 'dentro';
    const status: ItemStatus = padraoStatus === 'dentro' ? 'ok' : excedenteMin > 45 ? 'forte' : 'leve';
    const entradaMin = 5 * 60 + 40 + Math.floor(rng() * 10 - 5);
    const saidaMin = entradaMin + 8 * 60 + he1min;
    const setor = SETORES[idx % SETORES.length];
    const causa = padraoStatus === 'acima' ? CAUSAS[idx % CAUSAS.length] : null;

    return {
      motorista: nome,
      he1min,
      he1str: minToStr(he1min),
      status,
      rastreioStatus: status,
      detalhe:
        padraoStatus === 'acima'
          ? `Ponto ${minToStr(saidaMin)} não tem rastreio perto — mais próximo é ${minToStr(saidaMin - 8)} (chegada) (8 min)`
          : '',
      confirmadas: padraoStatus === 'acima' ? '3/4' : '2/2',
      batidas: `${minToStr(entradaMin)}✅ 12:00✅ ${minToStr(saidaMin)}${padraoStatus === 'acima' ? '❌' : '✅'}`,
      contexto: '',
      padraoStatus,
      padraoMin,
      excedenteMin,
      padraoDebug: '',
      padraoHorarios: [`${minToStr(entradaMin)}–${minToStr(entradaMin + 8 * 60)}`],
      setorAtual: setor,
      causaAtual: causa,
      causaFonte: causa ? 'heuristica' : null,
      interjornada: '',
      diaAjustado: 0,
      temLacuna: false,
      precisaVerificar: padraoStatus !== 'dentro',
    };
  });

  const totalHE = items.reduce((s, i) => s + i.he1min, 0);
  const acimaHE = items.filter((i) => i.padraoStatus === 'acima').reduce((s, i) => s + i.he1min, 0);
  const programadoHE = totalHE - acimaHE;
  const [y, m, d] = dateKey.split('-');

  return {
    dateKey,
    dateLabel: `${d}/${m}/${y}`,
    items,
    totalHE,
    acimaHE,
    programadoHE,
    semPadraoCount: 0,
    avisoPadrao: '',
  };
}

/* Enriquece a CONFIGURAÇÃO do workspace demo com valores de exemplo (setores usados pelos dias
 * fictícios acima, causas mais variadas, uma meta diária plausível) — só roda se o workspace ainda
 * não tiver nenhum setor cadastrado, pra não sobrescrever o que o usuário já tiver mexido. */
function enriquecerConfigDemo(workspaceId: string): void {
  const ws = WorkspaceRepository.getById(workspaceId);
  if (!ws || ws.departments.length > 0) return;

  const nomesSetor = [...new Set(SETORES)];
  nomesSetor.forEach((nome) => {
    DepartmentRepository.upsert(workspaceId, { id: novoId('demo-set'), nome, unidadeId: null, responsavel: '' });
  });

  const wsAtualizado = WorkspaceRepository.getById(workspaceId);
  if (!wsAtualizado) return;
  WorkspaceRepository.upsert({
    ...wsAtualizado,
    causaOpts: [...CAUSAS, 'Outro'],
    rules: { ...wsAtualizado.rules, dailyGoalMin: 36 * 60 + 50 }, // valor de EXEMPLO, só neste workspace
  });
}

export function seedDemoWorkspaceIfEmpty(workspaceId = 'demo'): void {
  /* TRAVA DE SEGURANÇA: dado fictício só entra em workspace de ambiente 'demo'. Não basta o id ser
   * 'demo' — o que vale é o `environment`, porque é ele que a interface usa pra estampar o aviso
   * "AMBIENTE DE DEMONSTRAÇÃO". Sem esta checagem, uma chamada errada (ou um id reaproveitado)
   * poderia semear 5 colaboradores inventados dentro de uma empresa real, e essa é exatamente a
   * falha que o produto não pode ter. Empresas criadas pela interface nascem sempre como 'real'
   * (ver WorkspaceRepository.criar), então nenhuma delas passa por aqui. */
  const ws = WorkspaceRepository.getById(workspaceId);
  if (!ws || ws.environment !== 'demo') return;

  if (TimeRecordRepository.listDateKeys(workspaceId).length > 0) return;

  enriquecerConfigDemo(workspaceId);

  const rng = mulberry32(20260813);
  const hoje = new Date(); // dia real do sistema — o Demo sempre mostra os últimos 12 dias a partir de hoje

  for (let i = 12; i >= 1; i--) {
    const dia = new Date(hoje);
    dia.setDate(dia.getDate() - i);
    const dateKey = `${dia.getFullYear()}-${pad(dia.getMonth() + 1)}-${pad(dia.getDate())}`;
    const snapshot = gerarDia(dateKey, rng);
    TimeRecordRepository.saveSnapshot(workspaceId, snapshot);

    // Marca uma parte dos casos acima do padrão como já resolvidos, com justificativa —
    // pra o Demo não parecer uma fila 100% pendente, e sim uma operação em andamento de verdade.
    snapshot.items.forEach((item) => {
      if (item.padraoStatus === 'acima' && rng() < 0.6) {
        TimeRecordRepository.updateCase(workspaceId, dateKey, item.motorista, {
          done: true,
          setor: item.setorAtual,
          causa: item.causaAtual || undefined,
          justificativa: 'Justificativa registrada em ambiente de demonstração (caso fictício).',
        });
      }
    });
  }
}
