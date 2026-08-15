/* Regra de tolerância — o coração do motor de classificação:
 *   Padrão x Registro -> Diferença -> compara com a tolerância CONFIGURADA (workspace.rules.toleranceMin)
 *   Diferença <= tolerância  => Normal / dentro do padrão
 *   Diferença >  tolerância  => Divergência / acima do padrão
 * Nunca hardcoded — todo chamador precisa passar a tolerância vinda da configuração do workspace
 * ativo (ver src/workspace/WorkspaceContext.tsx). Esta é a única função do sistema que decide
 * "isso é divergência ou não" — nenhum componente de tela deveria repetir essa conta sozinho. */
import { reclassificar, type HEItemRaw, type ItemStatus, type PadraoStatus } from '../engine/heEngineCore';

export interface ClassificacaoResultado {
  status: ItemStatus;
  padraoStatus: PadraoStatus;
  excedenteMin: number;
}

export function classificar(item: HEItemRaw, heEfetivoMin: number, toleranceMin: number): ClassificacaoResultado {
  return reclassificar(item, heEfetivoMin, toleranceMin);
}
