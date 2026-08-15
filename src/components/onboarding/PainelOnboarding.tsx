/* Painel de configuração inicial. Aparece no Dashboard enquanto a empresa ainda não está pronta
 * para operar, e some sozinho quando os passos essenciais são concluídos — não há botão "concluir
 * onboarding" nem flag salva, porque o progresso é sempre derivado do cadastro real
 * (ver services/onboardingService.ts). */
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Circle } from 'lucide-react';
import type { ProgressoOnboarding } from '../../services/onboardingService';

export function PainelOnboarding({
  progresso,
  compacto = false,
}: {
  progresso: ProgressoOnboarding;
  compacto?: boolean;
}) {
  return (
    <div className="card card-pad section-gap">
      <div className="card-title">
        <span>Configuração da sua empresa</span>
        <span className="text-faint" style={{ fontSize: 12.5, fontWeight: 400 }}>
          {progresso.concluidos} de {progresso.total} passos
        </span>
      </div>

      <div className="onboarding-barra">
        <div className="onboarding-barra-fill" style={{ width: `${progresso.percentual}%` }} />
      </div>
      <div className="onboarding-percentual">{progresso.percentual}% concluído</div>

      {progresso.proximo && (
        <div className="onboarding-proximo">
          <div>
            <div className="onboarding-proximo-label">Próximo passo</div>
            <div className="onboarding-proximo-titulo">{progresso.proximo.titulo}</div>
            <div className="onboarding-proximo-porque">{progresso.proximo.porque}</div>
          </div>
          <Link className="btn btn-primary" to={progresso.proximo.destino}>
            Configurar <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {!compacto && (
        <ol className="onboarding-lista">
          {progresso.passos.map((p) => (
            <li key={p.chave} className={p.concluido ? 'concluido' : ''}>
              <span className="onboarding-marca">
                {p.concluido ? <Check size={13} /> : <Circle size={9} />}
              </span>
              <div className="onboarding-item-texto">
                <div className="onboarding-item-titulo">
                  {p.titulo}
                  {p.essencial && !p.concluido && <span className="onboarding-tag">essencial</span>}
                </div>
                <div className="onboarding-item-desc">{p.descricao}</div>
              </div>
              {!p.concluido && (
                <Link className="btn btn-sm" to={p.destino}>
                  Abrir
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="onboarding-rodape">
        Você não precisa preencher tudo agora. O progresso é recalculado sempre que você volta — pode parar e continuar
        depois de onde parou.
      </p>
    </div>
  );
}
