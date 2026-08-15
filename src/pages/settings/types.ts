import type { WorkspaceConfig } from '../../domain';
import type { ConjuntoRepositorios } from '../../data/tipos';
import type { Gravacao } from '../../data/useRecurso';

export interface TabProps {
  workspace: WorkspaceConfig;

  /* Executa uma gravação contra o conjunto de repositórios ATIVO (local na demonstração, remoto
   * na empresa real) e recarrega o estado depois. As abas não sabem — e não devem saber — qual dos
   * dois está em uso: é o mesmo contrato nos dois casos.
   *
   * `ctx.versao` é o carimbo de concorrência lido junto com o cadastro. Ele viaja em toda gravação
   * para que o servidor possa recusar uma sobrescrita cega. */
  gravar: <T>(acao: (r: ConjuntoRepositorios, ctx: { empresaId: string; versao: string }) => Promise<T>) => Promise<T>;

  /* Estado compartilhado de "salvando / salvo / erro". Compartilhado de propósito: uma aba só tem
   * um formulário ativo por vez, e um estado por aba faria oito cópias do mesmo comportamento. */
  gravacao: Gravacao;

  recarregar: () => Promise<void>;

  /* false quando o papel do usuário não permite escrever no cadastro. É CONVENIÊNCIA de interface —
   * quem recusa de verdade é o servidor, que verifica a permissão em cada rota. Esconder o botão
   * nunca foi, e não é, o controle de acesso. */
  podeEditar: boolean;
}

export function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
