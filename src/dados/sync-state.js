const LABELS = Object.freeze({ idle: 'Firebase conectado', saving: 'Salvando no Firebase…', saved: 'Sincronizado', stale: 'Dados carregados · atualização pendente', error: 'Falha na sincronização' });

export function syncLabel(status = 'idle') { return LABELS[status] || LABELS.idle; }
export function syncTone(status = 'idle') { return status === 'error' ? 'error' : status === 'saving' || status === 'stale' ? 'saving' : 'ok'; }
