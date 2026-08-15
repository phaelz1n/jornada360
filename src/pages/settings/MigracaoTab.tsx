import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudUpload, Info, Loader2, Trash2 } from 'lucide-react';
import { TimeRecordRepository } from '../../repositories/TimeRecordRepository';
import { PendingRepository } from '../../repositories/PendingRepository';
import { useSessao } from '../../workspace/WorkspaceContext';
import { api, ErroApi } from '../../api/client';
import type { DiaBruto } from '../../data/tipos';
import type { Pendencia } from '../../domain';

/* Migração dos dados que ficaram neste navegador.
 *
 * REGRA QUE GOVERNA ESTA TELA INTEIRA: nada acontece em silêncio.
 *
 * Antes da Fase 4 o sistema inteiro rodava no `localStorage`. Quem já usava tem dias processados,
 * pendências e justificativas guardados no navegador — trabalho real, que não pode ser perdido nem
 * duplicado. Enviar isso automaticamente ao criar a conta seria pior: a pessoa não saberia o que
 * subiu, para onde, nem poderia conferir.
 *
 * Por isso o fluxo é: DETECTAR → MOSTRAR O QUE EXISTE → PESSOA CONFIRMA → ENVIAR → CONFERIR A
 * CONTAGEM NO SERVIDOR → só então oferecer a limpeza local. A limpeza é um passo separado, nunca
 * automático, e só fica disponível depois que o servidor confirmou o que recebeu. */

const TAMANHO_LOTE = 25;

interface Achado {
  dias: DiaBruto[];
  pendencias: Pendencia[];
}

interface Resultado {
  diasGravados: number;
  pendenciasGravadas: number;
  diasNoServidor: number;
  pendenciasNoServidor: number;
}

export function MigracaoTab() {
  const { workspaceIdAtivo, modo, recarregar, empresas } = useSessao();

  const [achado, setAchado] = useState<Achado | null>(null);
  const [origem, setOrigem] = useState<string>('');
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [limpou, setLimpou] = useState(false);

  /* Onde procurar: em qualquer namespace local que não seja o da demonstração. Antes da Fase 4 os
   * ambientes se chamavam `real` (o padrão histórico) ou `ws-<timestamp>`; hoje as empresas têm id
   * do servidor. Procurar por conteúdo, e não por um id fixo, é o que faz isto funcionar tanto para
   * quem usava a versão antiga quanto para quem processou algo offline. */
  const procurar = useCallback(() => {
    const idsConhecidos = new Set(empresas.map((e) => e.id));
    const candidatos = new Set<string>();

    for (let i = 0; i < localStorage.length; i += 1) {
      const chave = localStorage.key(i);
      if (!chave) continue;
      const m = /^assistente_he_local_(.+?)_/.exec(chave);
      if (m && m[1] !== 'demo') candidatos.add(m[1]);
    }

    let melhor: { id: string; dias: DiaBruto[]; pendencias: Pendencia[] } | null = null;
    for (const id of candidatos) {
      /* O namespace da própria empresa ativa também conta: é onde o motor grava hoje, antes do
       * envio. O que não entra nunca é `demo`. */
      const dias = TimeRecordRepository.listDateKeys(id)
        .map((dateKey) => {
          const snapshot = TimeRecordRepository.getSnapshot(id, dateKey);
          if (!snapshot) return null;
          return { dateKey, snapshot, caseState: TimeRecordRepository.getCaseState(id, dateKey) };
        })
        .filter((d): d is DiaBruto => d !== null);

      const pendencias = PendingRepository.listarPorWorkspace(id);
      if (dias.length === 0 && pendencias.length === 0) continue;
      if (!melhor || dias.length > melhor.dias.length) melhor = { id, dias, pendencias };
    }

    if (!melhor) {
      setAchado(null);
      setOrigem('');
      return;
    }
    setAchado({ dias: melhor.dias, pendencias: melhor.pendencias });
    setOrigem(idsConhecidos.has(melhor.id) ? 'esta empresa' : `ambiente local "${melhor.id}"`);
  }, [empresas]);

  useEffect(() => {
    procurar();
  }, [procurar]);

  async function enviar() {
    if (!achado || !workspaceIdAtivo || enviando) return;
    setEnviando(true);
    setErro(null);
    setProgresso(0);

    try {
      let ultimo: Resultado | null = null;
      /* Em lotes: um ano de dias processados passa do limite de corpo do servidor numa requisição
       * só. Lotes também dão progresso visível, em vez de uma espera muda. */
      for (let i = 0; i < achado.dias.length; i += TAMANHO_LOTE) {
        const lote = achado.dias.slice(i, i + TAMANHO_LOTE);
        ultimo = await api.post<Resultado>(`/api/tenants/${encodeURIComponent(workspaceIdAtivo)}/importar`, {
          dias: lote,
          pendencias: [],
        });
        setProgresso(Math.min(i + TAMANHO_LOTE, achado.dias.length));
      }

      /* As pendências vão por último, depois que os dias que as originam já estão no servidor. */
      ultimo = await api.post<Resultado>(`/api/tenants/${encodeURIComponent(workspaceIdAtivo)}/importar`, {
        dias: [],
        pendencias: achado.pendencias,
      });

      setResultado(ultimo);
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar os dados.');
    } finally {
      setEnviando(false);
    }
  }

  /* A limpeza é DEPOIS e SEPARADA. Só aparece quando o servidor já confirmou o que tem — apagar
   * antes disso significaria perder o original sem ter a cópia. */
  function limparLocal() {
    if (!achado || !resultado) return;
    const ok = window.confirm(
      `Apagar deste navegador ${achado.dias.length} dia(s) e ${achado.pendencias.length} pendência(s)?\n\n` +
        `O servidor confirmou ${resultado.diasNoServidor} dia(s) e ${resultado.pendenciasNoServidor} pendência(s) guardados. ` +
        'Esta limpeza não pode ser desfeita.',
    );
    if (!ok) return;

    for (const e of empresas) {
      if (e.environment === 'demo') continue;
      TimeRecordRepository.clearAll(e.id);
      PendingRepository.limparPendencias(e.id);
    }
    setLimpou(true);
    procurar();
  }

  if (modo === 'local') {
    return (
      <div className="card card-pad">
        <div className="card-title">Migrar dados deste navegador</div>
        <div className="aviso-config">
          <Info size={14} />
          <span>
            Você está na demonstração, que vive neste navegador por definição — não há para onde migrar. Entre numa
            empresa real para enviar dados locais ao servidor.
          </span>
        </div>
      </div>
    );
  }

  const nada = !achado || (achado.dias.length === 0 && achado.pendencias.length === 0);

  return (
    <div className="card card-pad">
      <div className="card-title">Migrar dados deste navegador</div>
      <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: -8 }}>
        Antes de existir servidor, o Jornada360 guardava tudo no navegador. Se você tem dias processados aqui, esta
        ferramenta os envia para a empresa ativa no servidor — onde ficam acessíveis de outra máquina e para o resto da
        equipe. <b>Nada é enviado sem você confirmar, e nada é apagado daqui antes de o servidor confirmar o que
        recebeu.</b>
      </p>

      {nada ? (
        <div className="aviso-config" style={{ marginTop: 14 }}>
          <CheckCircle2 size={14} />
          <span>
            {limpou
              ? 'Limpeza concluída — não restou nenhum dado local fora da demonstração.'
              : 'Nenhum dado local encontrado fora da demonstração. Não há nada para migrar.'}
          </span>
        </div>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="data-table">
              <thead>
                <tr><th>O que existe neste navegador</th><th>Quantidade</th></tr>
              </thead>
              <tbody>
                <tr><td className="cell-strong">Dias processados</td><td className="mono">{achado.dias.length}</td></tr>
                <tr><td className="cell-strong">Pendências</td><td className="mono">{achado.pendencias.length}</td></tr>
                <tr>
                  <td className="cell-strong">Período</td>
                  <td className="mono">
                    {achado.dias.length > 0
                      ? `${achado.dias[0].dateKey} a ${achado.dias[achado.dias.length - 1].dateKey}`
                      : '—'}
                  </td>
                </tr>
                <tr><td className="cell-strong">Origem</td><td>{origem}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="aviso-config" style={{ marginTop: 14 }}>
            <AlertTriangle size={14} />
            <span>
              Os dados serão gravados na empresa <b>em uso agora</b>. Confira no seletor do topo se é a empresa certa —
              dado enviado para a empresa errada precisa ser removido de lá manualmente.
            </span>
          </div>

          <div className="toolbar" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => void enviar()} disabled={enviando}>
              {enviando ? <Loader2 size={14} className="girando" /> : <CloudUpload size={14} />}
              {enviando ? `Enviando… (${progresso}/${achado.dias.length})` : 'Enviar para o servidor'}
            </button>
            {resultado && (
              <button className="btn btn-danger" onClick={limparLocal}>
                <Trash2 size={14} /> Limpar dados deste navegador
              </button>
            )}
          </div>
        </>
      )}

      {erro && (
        <div className="aviso-config" style={{ marginTop: 12 }}>
          <AlertTriangle size={14} />
          <span>{erro}</span>
        </div>
      )}

      {resultado && (
        <div className="aviso-config aviso-config--ok" style={{ marginTop: 12 }}>
          <CheckCircle2 size={14} />
          <div>
            <b>Envio concluído.</b> O servidor confirmou <b>{resultado.diasNoServidor} dia(s)</b> e{' '}
            <b>{resultado.pendenciasNoServidor} pendência(s)</b> guardados nesta empresa. Essa contagem foi lida do banco
            depois da gravação — não é o que enviamos, é o que ficou lá.
            <div style={{ marginTop: 6 }}>
              Confira no Dashboard antes de limpar o navegador. A limpeza é opcional: manter a cópia local não atrapalha,
              só ocupa espaço.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
