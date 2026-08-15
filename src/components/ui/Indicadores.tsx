/* Componentes de apresentação de indicador. Nenhuma regra de negócio vive aqui — o cálculo e a
 * explicação vêm prontos do analyticsService/scoreService. Este arquivo só decide como um número
 * (e o "porquê" dele) aparecem na tela, de forma igual em todas as telas que mostram indicador. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, AlertTriangle, Info, Database } from 'lucide-react';
import type { IndicadorExplicado } from '../../services/analyticsService';
import { minToStrSigned } from '../../engine/heEngineCore';

export function formatarValorIndicador(valor: number | null, formato: IndicadorExplicado['formato']): string {
  if (valor === null) return '—';
  if (formato === 'percentual') return `${valor}%`;
  if (formato === 'minutos') return minToStrSigned(valor);
  return String(valor);
}

/* Botão "?" que abre a explicação do indicador logo abaixo dele. Preferido a tooltip nativo porque
 * o texto é longo (duas frases) e precisa ser legível também no celular, onde não há hover. */
export function ExplicacaoIndicador({ comoFoiCalculado, porqueAparece }: { comoFoiCalculado: string; porqueAparece: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn-icon-inline"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        title="Como este número é calculado?"
      >
        <HelpCircle size={13} />
      </button>
      {aberto && (
        <div className="indicador-explicacao">
          <div>
            <strong>Como é calculado:</strong> {comoFoiCalculado}
          </div>
          <div style={{ marginTop: 6 }}>
            <strong>Por que aparece:</strong> {porqueAparece}
          </div>
        </div>
      )}
    </>
  );
}

export function CardIndicador({ indicador }: { indicador: IndicadorExplicado }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {indicador.label}
        <ExplicacaoIndicador comoFoiCalculado={indicador.comoFoiCalculado} porqueAparece={indicador.porqueAparece} />
      </div>
      <div className="kpi-value">{formatarValorIndicador(indicador.valor, indicador.formato)}</div>
      <div className="kpi-foot">
        {indicador.disponivel ? indicador.label : indicador.motivoIndisponivel || 'Sem dado suficiente para calcular.'}
      </div>
    </div>
  );
}

/* Estado vazio padronizado. Toda tela usa este componente em vez de escrever sua própria frase —
 * garante que a mensagem sempre diga o que fazer a seguir, não só que está vazio. */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Info size={22} />
      <div style={{ fontWeight: 600, marginTop: 8 }}>{titulo}</div>
      <div style={{ marginTop: 4, maxWidth: 460 }}>{descricao}</div>
      {acao && <div style={{ marginTop: 12 }}>{acao}</div>}
    </div>
  );
}

/* Aviso inline para quando um recorte da tela não pode ser mostrado por falta de configuração —
 * diferente de "vazio": aqui existe dado, falta cadastro para cruzar. */
export function AvisoConfiguracao({ children }: { children: ReactNode }) {
  return (
    <div className="aviso-config">
      <AlertTriangle size={14} />
      <span>{children}</span>
    </div>
  );
}

/* Estado vazio de "empresa recém-criada": o ambiente ainda não tem dados.
 *
 * DISTINÇÃO QUE ESTE COMPONENTE EXISTE PARA FAZER: "0 pendências" pode significar duas coisas
 * opostas — a operação está impecável, ou nada foi analisado ainda. Mostrar o mesmo zero nos dois
 * casos faz uma empresa vazia parecer uma empresa perfeita, que é a pior leitura possível para
 * quem acabou de criar a conta. Toda tela que exibe contagem usa este componente quando não há
 * nenhum dia processado, e a mensagem de "nada encontrado" só quando há dado analisado. */
export function AmbienteSemDados({
  titulo = 'Seu ambiente ainda não possui dados',
  descricao = 'Comece cadastrando sua operação ou importe seus dados de jornada. Os indicadores aparecem assim que o primeiro dia for analisado.',
}: {
  titulo?: string;
  descricao?: string;
}) {
  return (
    <div className="empty-state">
      <Database size={24} />
      <div style={{ fontWeight: 600, marginTop: 10 }}>{titulo}</div>
      <div style={{ marginTop: 5, maxWidth: 470 }}>{descricao}</div>
      <div className="empty-acoes">
        <Link className="btn btn-primary" to="/motor-he">
          Processar o primeiro dia
        </Link>
        <Link className="btn" to="/configuracoes">
          Configurar empresa
        </Link>
        <Link className="btn" to="/importar">
          Importar dados
        </Link>
      </div>
    </div>
  );
}
