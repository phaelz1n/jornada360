import type { HEDiaComputed, HEItemComputed } from './useHEEngineData';

export interface RegistroReal {
  dateKey: string;
  dateLabel: string;
  item: HEItemComputed;
}

/* Achata todos os dias processados numa lista única de registros (um por motorista/dia) —
 * base do "Controle de Ponto" real. */
export function flattenRegistros(dias: HEDiaComputed[]): RegistroReal[] {
  const out: RegistroReal[] = [];
  for (const dia of dias) {
    for (const item of dia.items) {
      out.push({ dateKey: dia.dateKey, dateLabel: dia.dateLabel, item });
    }
  }
  return out.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export interface MotoristaAgregado {
  motorista: string;
  key: string;
  diasAnalisados: number;
  diasAcimaPadrao: number;
  heTotalMin: number;
  excedenteTotalMin: number;
  setorMaisComum: string;
  ultimaData: string;
}

/* Agrupa os registros reais por motorista — base do HE1 detalhado, ranking de reincidência e
 * score do colaborador. */
export function agregarPorMotorista(dias: HEDiaComputed[]): MotoristaAgregado[] {
  const map = new Map<
    string,
    { motorista: string; diasAnalisados: number; diasAcimaPadrao: number; heTotalMin: number; excedenteTotalMin: number; setores: Record<string, number>; ultimaData: string }
  >();
  for (const dia of dias) {
    for (const item of dia.items) {
      let m = map.get(item._key);
      if (!m) {
        m = { motorista: item.motorista, diasAnalisados: 0, diasAcimaPadrao: 0, heTotalMin: 0, excedenteTotalMin: 0, setores: {}, ultimaData: dia.dateKey };
        map.set(item._key, m);
      }
      m.diasAnalisados++;
      m.heTotalMin += item._heMin;
      if (item._padraoStatus === 'acima') {
        m.diasAcimaPadrao++;
        m.excedenteTotalMin += item._excedenteMin;
      }
      m.setores[item._setor] = (m.setores[item._setor] || 0) + 1;
      if (dia.dateKey > m.ultimaData) m.ultimaData = dia.dateKey;
    }
  }
  return [...map.entries()].map(([key, m]) => ({
    key,
    motorista: m.motorista,
    diasAnalisados: m.diasAnalisados,
    diasAcimaPadrao: m.diasAcimaPadrao,
    heTotalMin: m.heTotalMin,
    excedenteTotalMin: m.excedenteTotalMin,
    setorMaisComum: Object.entries(m.setores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sem setor definido',
    ultimaData: m.ultimaData,
  }));
}

export interface SetorAgregado {
  setor: string;
  heTotalMin: number;
  casos: number;
  registros: RegistroReal[];
}

/* Rótulo do "setor" sintético que representa a parcela de HE que ficou dentro do padrão. NÃO é um
 * setor real da empresa: é a rotina normal, agrupada para o total bater. Quem ranqueia setores por
 * problema precisa excluí-lo — ver analyticsService.calcularPorSetor. */
export const SETOR_DENTRO_DO_PADRAO = 'Dentro do padrão';

/* Agrupa por setor responsável — o excedente (não o HE inteiro) é o que conta pro setor quando o
 * caso passou do padrão, igual à lógica original do Assistente HE (somarNoSetor). */
export function agregarPorSetor(dias: HEDiaComputed[]): SetorAgregado[] {
  const map = new Map<string, SetorAgregado>();
  function add(setor: string, min: number, reg: RegistroReal) {
    if (min <= 0) return;
    let s = map.get(setor);
    if (!s) {
      s = { setor, heTotalMin: 0, casos: 0, registros: [] };
      map.set(setor, s);
    }
    s.heTotalMin += min;
    s.casos++;
    s.registros.push(reg);
  }
  for (const dia of dias) {
    for (const item of dia.items) {
      const reg: RegistroReal = { dateKey: dia.dateKey, dateLabel: dia.dateLabel, item };
      if (item._padraoStatus === 'acima') {
        add(item._setor, item._excedenteMin, reg);
        add('Dentro do padrão', item._heMin - item._excedenteMin, reg);
      } else if (item._padraoStatus === 'dentro') {
        add('Dentro do padrão', item._heMin, reg);
      } else {
        add(item._setor, item._heMin, reg);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.heTotalMin - a.heTotalMin);
}

export interface PeriodoAgregado {
  chave: string;
  label: string;
  dias: HEDiaComputed[];
  heTotalMin: number;
  pendentes: number;
}

export function agregarPorMes(dias: HEDiaComputed[]): Map<string, HEDiaComputed[]> {
  const map = new Map<string, HEDiaComputed[]>();
  for (const dia of dias) {
    const mk = dia.dateKey.slice(0, 7);
    if (!map.has(mk)) map.set(mk, []);
    map.get(mk)!.push(dia);
  }
  return map;
}
