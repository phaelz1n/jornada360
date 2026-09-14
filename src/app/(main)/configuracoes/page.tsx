'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { minutesToHHMM } from '@/lib/utils/time';

export default function ConfiguracoesPage() {
  const { config, workspace } = useWorkspace();

  const configs = [
    { label: 'Tolerância Padrão de HE', value: `${config.toleranciaPadraoMin} min` },
    { label: 'Tolerância Divergência Leve', value: `${config.toleranciaDivLeveMin} min` },
    { label: 'Interjornada Mínima', value: minutesToHHMM(config.toleranciaInterjornadaMin) },
    { label: 'Meta Diária de HE', value: minutesToHHMM(config.metaDiariaHEMin) },
    { label: 'Ciclo de Fechamento', value: `Dia ${config.cicloFechamento.diaInicio} a ${config.cicloFechamento.diaFim}` },
    { label: 'Fuzzy Match Threshold', value: `${Math.round(config.fuzzyMatchThreshold * 100)}%` },
    { label: '1º Intervalo Mínimo', value: `${config.intervalos.primeiroMin} min` },
    { label: '2º Intervalo Mínimo', value: `${config.intervalos.segundoMin} min` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">
          Parâmetros do workspace &quot;{workspace?.nome || 'Padrão'}&quot;
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tolerances */}
        <Card>
          <h2 className="text-base font-semibold text-slate-200 mb-4">Regras e Tolerâncias</h2>
          <div className="space-y-3">
            {configs.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-400">{c.label}</span>
                <span className="text-sm font-mono text-slate-200">{c.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button variant="secondary" size="sm" disabled>
              Editar (em breve)
            </Button>
          </div>
        </Card>

        {/* Aliases */}
        <Card>
          <h2 className="text-base font-semibold text-slate-200 mb-4">Aliases de Setores e Causas</h2>
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">
              Nenhum alias configurado
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Aliases permitirão mesclar setores e causas duplicadas (Fase 5)
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
