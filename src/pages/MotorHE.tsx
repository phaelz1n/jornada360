import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudUpload, Loader2 } from 'lucide-react';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { TimeRecordRepository } from '../repositories/TimeRecordRepository';
import { notificarSincronizacao } from '../engine/useHEEngineData';
import { FeedbackGravacao } from '../components/ui/EstadosAsync';
import { useGravacao } from '../data/useRecurso';
import type { DiaBruto } from '../data/tipos';

/* Lista -> um único valor de querystring, itens separados por "|" (nomes de setor/causa não usam
 * esse caractere na prática; URLSearchParams cuida da codificação do valor inteiro de uma vez só —
 * não pré-codificar item a item aqui, senão o "%" vira "%25" quando a querystring é montada). */
function codificarLista(itens: string[]): string {
  return itens.join('|');
}

/* Ponte entre o motor e o servidor.
 *
 * O MOTOR NÃO FOI ALTERADO — e não deve ser. Ele continua fazendo o que sempre fez: processar as
 * planilhas e gravar o resultado no `localStorage` da própria origem. Ensiná-lo a falar com a API
 * significaria mexer na parte do sistema que está validada contra dados reais, pelo motivo errado.
 *
 * Em vez disso, o envio é um ADAPTADOR AO REDOR dele: esta tela lê o que o motor gravou localmente,
 * compara com o que o servidor já tem, e envia a diferença. O envio é explícito — a pessoa vê
 * quantos dias estão para subir e clica. Enviar sozinho, em silêncio, esconderia justamente o
 * momento em que o dado sai do navegador.
 *
 * Na demonstração este painel não aparece: lá o "servidor" é o próprio navegador. */
function EnvioParaServidor({ empresaId, diasNoServidor }: { empresaId: string; diasNoServidor: DiaBruto[] }) {
  const { gravar, recarregar } = useWorkspace();
  const gravacao = useGravacao();
  const [pendentes, setPendentes] = useState<DiaBruto[]>([]);

  /* O que o motor gravou neste navegador para ESTA empresa. O motor usa o mesmo prefixo por
   * empresa que o repositório local (`?ws=` no iframe), então ler daqui é ler o que ele escreveu. */
  const lerLocais = useCallback((): DiaBruto[] => {
    return TimeRecordRepository.listDateKeys(empresaId)
      .map((dateKey) => {
        const snapshot = TimeRecordRepository.getSnapshot(empresaId, dateKey);
        if (!snapshot) return null;
        return { dateKey, snapshot, caseState: TimeRecordRepository.getCaseState(empresaId, dateKey) };
      })
      .filter((d): d is DiaBruto => d !== null);
  }, [empresaId]);

  const chavesNoServidor = useMemo(
    () => new Map(diasNoServidor.map((d) => [d.dateKey, d.snapshot.items.length])),
    [diasNoServidor],
  );

  const recalcular = useCallback(() => {
    const locais = lerLocais();
    /* "Pendente" = existe aqui e não lá, ou o número de registros do dia mudou (reprocessamento).
     * Comparar o JSON inteiro seria mais preciso e mais caro; a contagem já pega o caso real, que é
     * reprocessar um dia com uma planilha corrigida. */
    setPendentes(locais.filter((d) => chavesNoServidor.get(d.dateKey) !== d.snapshot.items.length));
  }, [lerLocais, chavesNoServidor]);

  /* O iframe grava no mesmo documento, e o evento nativo `storage` não dispara para quem escreveu.
   * Reavaliar a cada poucos segundos enquanto esta tela está aberta é simples e suficiente — e não
   * exige nenhuma alteração no motor. */
  useEffect(() => {
    recalcular();
    const t = setInterval(recalcular, 4000);
    return () => clearInterval(t);
  }, [recalcular]);

  async function enviar() {
    const fila = pendentes;
    if (fila.length === 0) return;

    await gravacao.executar(async () => {
      /* Sequencial de propósito: um dia processado é um corpo grande, e disparar dezenas de
       * requisições simultâneas contra o servidor só aumenta a chance de nenhuma terminar. */
      for (const dia of fila) {
        await gravar((repo, ctx) => repo.salvarDia(ctx.empresaId, dia));
      }
      await recarregar();
      notificarSincronizacao();
      recalcular();
    });
  }

  return (
    <div className="barra-motor">
      <div>
        {pendentes.length === 0 ? (
          <span className="text-muted">Tudo que foi processado aqui já está no servidor.</span>
        ) : (
          <span>
            <b>{pendentes.length} dia(s)</b> processado(s) neste navegador ainda não estão no servidor. Enquanto não
            forem enviados, eles não aparecem para o resto da equipe nem em outra máquina.
          </span>
        )}
      </div>
      <div className="barra-motor__acoes">
        <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => void enviar()}
          disabled={pendentes.length === 0 || gravacao.estado === 'salvando'}
        >
          {gravacao.estado === 'salvando' ? <Loader2 size={13} className="girando" /> : <CloudUpload size={13} />}
          Enviar ao servidor
        </button>
      </div>
    </div>
  );
}

export default function MotorHE() {
  const { workspace, workspaceIdAtivo, modo, dias } = useWorkspace();

  /* Os setores vêm do cadastro já carregado — não há uma segunda lista para manter em dia. */
  const setorOpts = useMemo(
    () => Array.from(new Set(workspace.departments.map((d) => d.nome.trim()).filter(Boolean))),
    [workspace.departments],
  );

  /* Todas as regras de jornada da empresa ativa viajam pro motor por querystring — antes cada
   * uma era uma constante fixa dentro do index.html (tolerância 10min, meta 36:50, interjornada
   * 11h, reincidência 5x), o que prendia o arquivo à operação de uma empresa só. O motor aplica o
   * fallback dele só quando aberto fora do Jornada360 (ver numeroDaQuerystring lá). */
  const r = workspace.rules;
  const params = new URLSearchParams({
    ws: workspaceIdAtivo,
    tol: String(r.toleranceMin),
    meta: String(r.dailyGoalMin),
    reinc: String(r.recurrenceLimit),
    interj: String(r.interjourneyMinHours),
    intervalo: String(r.intervalMinMin),
  });
  if (setorOpts.length) params.set('setores', codificarLista(setorOpts));
  if (workspace.causaOpts.length) params.set('causas', codificarLista(workspace.causaOpts));

  /* A key inclui a querystring inteira (não só a empresa) pra o iframe remontar quando qualquer
   * regra mudar em Configurações → Regras — senão o motor seguiria rodando com a tolerância/meta
   * antiga até alguém recarregar a página na mão. */
  const querystring = params.toString();

  return (
    <>
      {modo === 'remoto' && <EnvioParaServidor empresaId={workspaceIdAtivo} diasNoServidor={dias} />}
      <iframe
        key={querystring}
        src={`/motor-he/index.html?${querystring}`}
        title="Assistente de HE diário"
        style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
      />
    </>
  );
}
