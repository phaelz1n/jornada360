'use client';

// ============================================================
// Central de Importação — Processamento de Arquivos e Telemetria
// ============================================================

import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAuditData } from '@/components/providers/AuditDataProvider';
import clsx from 'clsx';

type FileTypeKey = 'espelho' | 'rastreamento' | 'horario' | 'escala' | 'espelhoOntem';

interface FileTypeConfig {
  key: FileTypeKey;
  title: string;
  description: string;
  icon: string;
  badge: string;
  badgeVariant: 'error' | 'warning' | 'info';
  accept: string;
}

const fileTypes: FileTypeConfig[] = [
  {
    key: 'espelho',
    title: 'Espelho de Ponto',
    description: 'Espelho com batidas e horas (.xlsx, .xls, .csv ou .pdf)',
    icon: '📋',
    badge: 'Obrigatório',
    badgeVariant: 'error',
    accept: '.xlsx,.xls,.csv,.pdf',
  },
  {
    key: 'rastreamento',
    title: 'Rastreamento Cobli',
    description: 'Trajetos e paradas do rastreador veicular (.xlsx, .xls, .csv)',
    icon: '🚛',
    badge: 'Recomendado',
    badgeVariant: 'warning',
    accept: '.xlsx,.xls,.csv',
  },
  {
    key: 'horario',
    title: 'Horário Padrão',
    description: 'Horários homologados por motorista (.xlsx, .xls, .csv)',
    icon: '🕐',
    badge: 'Recomendado',
    badgeVariant: 'warning',
    accept: '.xlsx,.xls,.csv',
  },
  {
    key: 'escala',
    title: 'Escala Operacional',
    description: 'Escala diária, sábado e domingo (.xlsx, .xls, .csv)',
    icon: '📅',
    badge: 'Opcional',
    badgeVariant: 'info',
    accept: '.xlsx,.xls,.csv',
  },
  {
    key: 'espelhoOntem',
    title: 'Espelho de Ontem',
    description: 'Para conferência legal de interjornada (PDF ou Excel)',
    icon: '📄',
    badge: 'Opcional',
    badgeVariant: 'info',
    accept: '.pdf,.xlsx,.xls,.csv',
  },
];

interface UploadedFile {
  file: File;
  name: string;
  size: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportacaoPage() {
  const {
    processFiles,
    isProcessing,
    auditItems,
    resetToSampleData,
  } = useAuditData();

  const [files, setFiles] = useState<Record<FileTypeKey, UploadedFile | null>>({
    espelho: null,
    rastreamento: null,
    horario: null,
    escala: null,
    espelhoOntem: null,
  });

  const [draggingOver, setDraggingOver] = useState<FileTypeKey | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const inputRefs = useRef<Record<FileTypeKey, HTMLInputElement | null>>({
    espelho: null,
    rastreamento: null,
    horario: null,
    escala: null,
    espelhoOntem: null,
  });

  const handleFile = useCallback((key: FileTypeKey, file: File) => {
    setFiles(prev => ({
      ...prev,
      [key]: {
        file,
        name: file.name,
        size: formatFileSize(file.size),
      },
    }));
    setFeedback(null);
  }, []);

  const handleInputChange = useCallback(
    (key: FileTypeKey) => (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(key, file);
      e.target.value = '';
    },
    [handleFile]
  );

  const handleDragOver = useCallback(
    (key: FileTypeKey) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingOver(key);
    },
    []
  );

  const handleDragLeave = useCallback(
    (key: FileTypeKey) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingOver(prev => (prev === key ? null : prev));
    },
    []
  );

  const handleDrop = useCallback(
    (key: FileTypeKey) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingOver(null);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(key, file);
    },
    [handleFile]
  );

  const handleClick = useCallback((key: FileTypeKey) => {
    inputRefs.current[key]?.click();
  }, []);

  const handleRemove = useCallback((key: FileTypeKey) => {
    setFiles(prev => ({ ...prev, [key]: null }));
    setFeedback(null);
  }, []);

  const handleProcess = async () => {
    if (!files.espelho) {
      setFeedback({
        type: 'error',
        message: 'Por favor selecione ao menos o Espelho de Ponto (Excel ou PDF) para iniciar a conciliação.',
      });
      return;
    }

    setFeedback(null);
    const res = await processFiles({
      espelho: files.espelho?.file,
      rastreamento: files.rastreamento?.file,
      horario: files.horario?.file,
      escala: files.escala?.file,
      espelhoOntem: files.espelhoOntem?.file,
    });

    if (res.success) {
      setFeedback({
        type: 'success',
        message: 'Arquivos processados com sucesso! Conciliação executada e pendências registradas.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: `Falha no processamento: ${res.error}`,
      });
    }
  };

  const loadedCount = Object.values(files).filter(Boolean).length;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Central de Importação</h1>
          <p className="text-sm text-slate-400 mt-1">
            Arraste e solte ou clique para carregar os arquivos de ponto, telemetria Cobli e escalas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToSampleData}
            title="Carregar conjunto realista para demonstração imediata"
          >
            Carregar Dados de Demonstração
          </Button>
          {loadedCount > 0 && (
            <Badge variant="cyan" dot>
              {loadedCount} arquivo{loadedCount > 1 ? 's' : ''} pronto{loadedCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <Banner variant={feedback.type === 'success' ? 'success' : 'error'}>
          <div className="flex items-center justify-between gap-4">
            <span>{feedback.message}</span>
            {feedback.type === 'success' && (
              <Link href="/dashboard">
                <Button variant="primary" size="sm">
                  Ver Checklist no Dashboard →
                </Button>
              </Link>
            )}
          </div>
        </Banner>
      )}

      {/* Action Bar */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
            ⚙️
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Motor de Conciliação Inteligente</h2>
            <p className="text-xs text-slate-400">
              Cruza horários batida a batida, valida interjornada de 11h e aplica tolerâncias da CLT.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <Button
            variant="primary"
            size="lg"
            onClick={handleProcess}
            disabled={isProcessing || loadedCount === 0}
            className="w-full md:w-auto shadow-lg shadow-cyan-500/20"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Processando e Auditando...
              </span>
            ) : (
              '⚡ Processar e Auditar Jornadas'
            )}
          </Button>
        </div>
      </div>

      {/* Upload zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fileTypes.map((ft) => {
          const uploaded = files[ft.key];
          const isDragging = draggingOver === ft.key;

          return (
            <Card key={ft.key} hover className="group flex flex-col justify-between">
              <div>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{ft.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-200">{ft.title}</h3>
                      <Badge variant={ft.badgeVariant}>{ft.badge}</Badge>
                    </div>
                    <p className="text-xs text-slate-400">{ft.description}</p>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={(el) => { inputRefs.current[ft.key] = el; }}
                  type="file"
                  accept={ft.accept}
                  onChange={handleInputChange(ft.key)}
                  className="hidden"
                  id={`file-input-${ft.key}`}
                />
              </div>

              {uploaded ? (
                /* File loaded state */
                <div className="mt-4 border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-3.5 animate-scale-in">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-emerald-300 font-semibold truncate">{uploaded.name}</p>
                      <p className="text-[11px] text-slate-400">{uploaded.size}</p>
                    </div>
                    <button
                      onClick={() => handleRemove(ft.key)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                      title="Remover arquivo"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <button
                    onClick={() => handleClick(ft.key)}
                    className="mt-2 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                  >
                    Trocar arquivo
                  </button>
                </div>
              ) : (
                /* Drop zone */
                <div
                  onClick={() => handleClick(ft.key)}
                  onDragOver={handleDragOver(ft.key)}
                  onDragLeave={handleDragLeave(ft.key)}
                  onDrop={handleDrop(ft.key)}
                  className={clsx(
                    'mt-4 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200',
                    isDragging
                      ? 'border-cyan-500/60 bg-cyan-500/10 scale-[1.02]'
                      : 'border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.02] group-hover:border-cyan-500/30'
                  )}
                >
                  <svg
                    className={clsx(
                      'w-7 h-7 mx-auto transition-colors duration-200',
                      isDragging ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'
                    )}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className={clsx(
                    'text-xs mt-2 transition-colors font-medium',
                    isDragging ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}>
                    {isDragging ? 'Solte o arquivo aqui' : 'Clique ou arraste o arquivo'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">{ft.accept}</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Summary of current state */}
      {auditItems.length > 0 && (
        <Card className="p-5 border-cyan-500/20 bg-slate-900/80">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Status da Base Ativa</h2>
              <p className="text-xs text-slate-400">
                {auditItems.length} colaboradores auditados para conciliação de jornada
              </p>
            </div>
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">
                Acessar Checklist Operacional →
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-xs text-slate-400">Motoristas Auditados</p>
              <p className="text-xl font-bold text-white mt-1">{auditItems.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-xs text-slate-400">Horas Extras Totais</p>
              <p className="text-xl font-bold text-cyan-400 mt-1">
                {(auditItems.reduce((s, i) => s + i.heEfetivaMin, 0) / 60).toFixed(1)}h
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-xs text-slate-400">Excedente Não Previsto</p>
              <p className="text-xl font-bold text-amber-400 mt-1">
                {(auditItems.reduce((s, i) => s + i.excedenteMin, 0) / 60).toFixed(1)}h
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-xs text-slate-400">Déficits Interjornada</p>
              <p className="text-xl font-bold text-red-400 mt-1">
                {auditItems.filter(i => i.interjornadaDeficit && i.interjornadaDeficit > 0).length}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
