const LABELS = Object.freeze({ idle: 'Firebase conectado', saving: 'Salvando no Firebase…', saved: 'Sincronizado', error: 'Falha na sincronização' });

export function syncLabel(status = 'idle') { return LABELS[status] || LABELS.idle; }
export function syncTone(status = 'idle') { return status === 'error' ? 'error' : status === 'saving' ? 'saving' : 'ok'; }
