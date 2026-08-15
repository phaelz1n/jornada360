/* Regras de jornada (intervalo intrajornada e interjornada).
 *
 * Divisão de responsabilidade: o motor real (public/motor-he/index.html) é quem tem as batidas
 * brutas do espelho, então é ele quem DETECTA a violação — comparando contra os mínimos que o
 * workspace manda por querystring (`interj`/`intervalo`, ver MotorHE.tsx). Desde essa mudança
 * nenhum dos dois limiares é mais um número fixo no arquivo do motor.
 *
 * Este service é a porta de leitura desse resultado para o lado TypeScript: as telas nunca leem
 * `item.interjornada`/`item.intervalo` na mão, perguntam aqui. Assim, quando existir outra fonte de
 * batidas (uma integração de ponto, por exemplo), só este arquivo muda.
 *
 * As duas funções de predicado continuam existindo porque expressam a regra de forma pura e
 * testável, e são o contrato que o motor implementa do outro lado. */
import type { HEItemComputed } from '../engine/useHEEngineData';

export function interjornadaCritica(gapHoras: number, minimoHoras: number): boolean {
  return gapHoras >= 0 && gapHoras < minimoHoras;
}

export function intervaloIrregular(intervaloMin: number, minimoMin: number): boolean {
  return intervaloMin < minimoMin;
}

export type TipoAlertaJornada = 'interjornada' | 'intervalo';

export interface AlertaJornada {
  tipo: TipoAlertaJornada;
  /** Texto pronto do motor, já com os números reais do caso e o mínimo configurado. */
  descricao: string;
}

export const TIPO_ALERTA_JORNADA_LABEL: Record<TipoAlertaJornada, string> = {
  interjornada: 'Descanso entre jornadas abaixo do mínimo',
  intervalo: 'Pausa dentro da jornada abaixo do mínimo',
};

/* Alertas de jornada de um caso. Lista vazia = nenhuma violação detectada OU o espelho não tinha
 * dado suficiente pra avaliar (menos de 4 batidas para intervalo, sem espelho do dia anterior para
 * interjornada). Os dois casos são deliberadamente indistinguíveis aqui: o motor não marca "não
 * avaliado" separado de "ok", e inventar essa distinção do lado de cá seria adivinhar. */
export function alertasDeJornada(item: HEItemComputed): AlertaJornada[] {
  const out: AlertaJornada[] = [];
  if (item.interjornada) out.push({ tipo: 'interjornada', descricao: item.interjornada });
  if (item.intervalo) out.push({ tipo: 'intervalo', descricao: item.intervalo });
  return out;
}

export function temAlertaDeJornada(item: HEItemComputed): boolean {
  return !!item.interjornada || !!item.intervalo;
}
