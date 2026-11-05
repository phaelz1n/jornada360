import { useState } from 'react';
import { findSimilarDriverNames } from './motoristas-duplicates.js';
import { mergeDriverDocuments } from '../lib/firestore-writes.js';

export function MergeDriversPanel({ drivers = [] }) {
  const [notice, setNotice] = useState('');
  const pairs = findSimilarDriverNames(drivers);
  async function merge(pair) {
    const keep = drivers.find(driver => driver.nome === pair[0]);
    const remove = drivers.find(driver => driver.nome === pair[1]);
    if (!keep || !remove || !window.confirm(`Manter “${keep.nome}” e excluir “${remove.nome}”? Históricos não serão apagados.`)) return;
    try { await mergeDriverDocuments(keep, remove); setNotice(`“${remove.nome}” foi mesclado em “${keep.nome}”.`); } catch { setNotice('Não foi possível mesclar os cadastros.'); }
  }
  if (!pairs.length && !notice) return null;
  return <section className="module-panel"><span className="eyebrow">REVISÃO DE CADASTRO</span><h3>Possíveis duplicidades</h3>{notice && <p className="register-notice">{notice}</p>}{pairs.map(pair => <div className="register-row" key={pair.join('|')}><span>{pair[0]} / {pair[1]}</span><button type="button" className="secondary-button" onClick={() => merge(pair)}>Manter o primeiro e mesclar</button></div>)}</section>;
}
