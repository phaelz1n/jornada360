import { useState } from 'react';
import { buildMigrationPayload, migrationStats } from './backup-migration.js';
import { migrateBackupToFirestore } from '../lib/firestore-migration.js';

export function MigrationPanel() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setMessage('Lendo backup local...');
    try {
      const payload = buildMigrationPayload(JSON.parse(await file.text()));
      const stats = migrationStats(payload);
      setMessage(`Backup pronto: ${stats.drivers} motoristas e ${stats.days} dias.`);
      const result = await migrateBackupToFirestore(payload, (done, total) => setMessage(`Migrando dados... ${done}/${total}`));
      setMessage(`Migração concluída: ${result.drivers} motoristas e ${result.days} dias enviados ao Firebase.`);
    } catch (error) { setMessage(`Não foi possível migrar: ${error.message}`); }
    finally { setBusy(false); event.target.value = ''; }
  }
  return <section className="migration-panel"><span className="eyebrow">DADOS LOCAIS</span><h2>Migrar conteúdo do sistema antigo</h2><p>Selecione o arquivo JSON exportado pelo HTML local. Os nomes, setores, dias processados e validações serão copiados para o sistema novo.</p><label className="primary-button migration-upload">{busy ? 'Migrando...' : 'Selecionar backup JSON'}<input type="file" accept="application/json,.json" disabled={busy} onChange={handleFile} /></label>{message && <div className="import-message" role="status">{message}</div>}</section>;
}
