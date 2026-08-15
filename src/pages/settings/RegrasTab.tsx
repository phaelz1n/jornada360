import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TabProps } from './types';
import { FeedbackGravacao } from '../../components/ui/EstadosAsync';

export function RegrasTab({ workspace, gravar, gravacao, recarregar, podeEditar }: TabProps) {
  const [form, setForm] = useState(workspace.rules);
  const [novaCausa, setNovaCausa] = useState('');

  /* Depois de uma gravacao (ou de uma recarga disparada por outra pessoa) o formulario precisa
   * refletir o que o servidor tem. Sem isto, um conflito recusado deixaria a tela mostrando um
   * valor que nao existe em lugar nenhum. */
  useEffect(() => setForm(workspace.rules), [workspace.rules]);

  /* Regras e causas sao salvas juntas: sao a mesma linha no banco, e separa-las em duas gravacoes
   * criaria uma janela em que uma foi gravada e a outra nao. */
  function salvar() {
    void gravacao.executar(() =>
      gravar((repo, ctx) => repo.salvarRegras(ctx.empresaId, form, workspace.causaOpts, ctx.versao)),
    );
  }

  async function adicionarCausa() {
    const valor = novaCausa.trim();
    if (!valor || workspace.causaOpts.includes(valor)) return;
    const ok = await gravacao.executar(() =>
      gravar((repo, ctx) => repo.salvarRegras(ctx.empresaId, workspace.rules, [...workspace.causaOpts, valor], ctx.versao)),
    );
    if (ok !== null) setNovaCausa('');
  }

  function removerCausa(causa: string) {
    void gravacao.executar(() =>
      gravar((repo, ctx) =>
        repo.salvarRegras(ctx.empresaId, workspace.rules, workspace.causaOpts.filter((c) => c !== causa), ctx.versao),
      ),
    );
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 640 }}>
      <div className="card-title">Regras de jornada e HE</div>
      <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>
        Estas regras alimentam de verdade o motor de classificação (Dashboard, Pendências, Ranking,
        Score, Relatório) — mudar a tolerância aqui reclassifica todos os casos já processados na
        hora, só neste workspace.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Tolerância (minutos)</div>
          <input
            className="input"
            type="number"
            min={0}
            value={form.toleranceMin}
            onChange={(e) => setForm((f) => ({ ...f, toleranceMin: Number(e.target.value) }))}
          />
          <p className="text-faint" style={{ fontSize: 11.5, marginTop: 4 }}>
            Diferença até este valor = dentro do padrão. Acima disso = divergência.
          </p>
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Meta diária de HE1 (minutos)</div>
          <input
            className="input"
            type="number"
            min={0}
            value={form.dailyGoalMin}
            onChange={(e) => setForm((f) => ({ ...f, dailyGoalMin: Number(e.target.value) }))}
          />
          <p className="text-faint" style={{ fontSize: 11.5, marginTop: 4 }}>
            {form.dailyGoalMin === 0
              ? 'Ainda não configurada nesta empresa (0 = sem meta definida) — os indicadores "acima da meta" ficam neutros até você definir um valor.'
              : 'Usada nos indicadores "dias acima da meta".'}
          </p>
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Limite de reincidência (nº de dias acima do padrão no período)</div>
          <input
            className="input"
            type="number"
            min={1}
            value={form.recurrenceLimit}
            onChange={(e) => setForm((f) => ({ ...f, recurrenceLimit: Number(e.target.value) }))}
          />
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Intervalo mínimo (minutos)</div>
          <input
            className="input"
            type="number"
            min={0}
            value={form.intervalMinMin}
            onChange={(e) => setForm((f) => ({ ...f, intervalMinMin: Number(e.target.value) }))}
          />
          <p className="text-faint" style={{ fontSize: 11.5, marginTop: 4 }}>
            Preparado para uso futuro (Fase 2) — o Assistente HE Diário ainda não aplica este valor internamente.
          </p>
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Interjornada mínima (horas)</div>
          <input
            className="input"
            type="number"
            min={0}
            value={form.interjourneyMinHours}
            onChange={(e) => setForm((f) => ({ ...f, interjourneyMinHours: Number(e.target.value) }))}
          />
          <p className="text-faint" style={{ fontSize: 11.5, marginTop: 4 }}>
            Preparado para uso futuro (Fase 2) — o Assistente HE Diário hoje usa 11h fixas internamente (mínimo legal CLT) para detectar interjornada crítica.
          </p>
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Prazo padrão para tratar uma pendência (dias)</div>
          <input
            className="input"
            type="number"
            min={1}
            value={form.prazoPadraoDias}
            onChange={(e) => setForm((f) => ({ ...f, prazoPadraoDias: Number(e.target.value) }))}
          />
          <p className="text-faint" style={{ fontSize: 11.5, marginTop: 4 }}>
            Usado só como sugestão de prazo (botão "Sugerir prazo padrão" na ficha da pendência) — nunca aplicado sozinho, sem uma ação explícita de quem estiver tratando o caso.
          </p>
        </div>
        <div>
          <div className="kpi-label" style={{ marginBottom: 6 }}>Alerta de prazo próximo (dias de antecedência)</div>
          <input
            className="input"
            type="number"
            min={0}
            value={form.alertaAntecedenciaDias}
            onChange={(e) => setForm((f) => ({ ...f, alertaAntecedenciaDias: Number(e.target.value) }))}
          />
          <p className="text-faint" style={{ fontSize: 11.5, marginTop: 4 }}>
            Quantos dias antes do prazo uma pendência já aberta passa a aparecer como "Prazo próximo" no Centro de Ações.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-primary" onClick={salvar} disabled={!podeEditar || gravacao.estado === 'salvando'}>Salvar regras</button>
          <FeedbackGravacao estado={gravacao.estado} erro={gravacao.erro} aoRecarregar={() => void recarregar()} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
          <div className="kpi-label" style={{ marginBottom: 8 }}>Causas prováveis de divergência</div>
          <div className="chip-row" style={{ marginBottom: 10 }}>
            {workspace.causaOpts.map((c) => (
              <span key={c} className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {c}
                <button
                  onClick={() => removerCausa(c)}
                  disabled={!podeEditar}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                  aria-label={`Remover ${c}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Nova causa..."
              value={novaCausa}
              onChange={(e) => setNovaCausa(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void adicionarCausa()}
            />
            <button className="btn" onClick={() => void adicionarCausa()} disabled={!podeEditar}>Adicionar</button>
          </div>
          <p className="text-faint" style={{ fontSize: 11.5, marginTop: 6 }}>
            Estas opções aparecem ao classificar uma pendência, aqui e dentro do Assistente HE Diário.
          </p>
        </div>
      </div>
    </div>
  );
}
