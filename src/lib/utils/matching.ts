// ============================================================
// Fuzzy Matching Utilities
// ============================================================

/**
 * Calcula o coeficiente de Dice entre dois conjuntos de bigramas.
 * Resultado entre 0 (sem match) e 1 (idêntico).
 */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  const bCopy = new Map(bigramsB);

  for (const [bigram, countA] of bigramsA) {
    const countB = bCopy.get(bigram) || 0;
    if (countB > 0) {
      intersection += Math.min(countA, countB);
      bCopy.set(bigram, countB - Math.min(countA, countB));
    }
  }

  const totalA = Array.from(bigramsA.values()).reduce((s, v) => s + v, 0);
  const totalB = Array.from(bigramsB.values()).reduce((s, v) => s + v, 0);

  return (2 * intersection) / (totalA + totalB);
}

function getBigrams(str: string): Map<string, number> {
  const bigrams = new Map<string, number>();
  for (let i = 0; i < str.length - 1; i++) {
    const bg = str.substring(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }
  return bigrams;
}

/**
 * Distância de Levenshtein entre duas strings.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Similaridade de Levenshtein normalizada (0–1).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Interface de resultado de matching.
 */
export interface MatchResult {
  source: string;
  target: string;
  score: number;
  method: 'exact' | 'cpf' | 'matricula' | 'dice' | 'levenshtein';
}

/**
 * Encontra o melhor match para um nome normalizado em uma lista de candidatos.
 * Prioridade: CPF > Matrícula > Exact > Fuzzy.
 */
export function findBestMatch(
  sourceName: string,
  sourceCpf: string | undefined,
  sourceMatricula: string | undefined,
  candidates: Array<{
    nome: string;
    nomeNormalizado: string;
    cpf?: string;
    matricula?: string;
  }>,
  threshold: number = 0.85
): MatchResult | null {
  // 1. CPF match
  if (sourceCpf) {
    const match = candidates.find(c => c.cpf && c.cpf === sourceCpf);
    if (match) {
      return { source: sourceName, target: match.nome, score: 1, method: 'cpf' };
    }
  }

  // 2. Matrícula match
  if (sourceMatricula) {
    const match = candidates.find(c => c.matricula && c.matricula === sourceMatricula);
    if (match) {
      return { source: sourceName, target: match.nome, score: 1, method: 'matricula' };
    }
  }

  // 3. Exact name match
  const exactMatch = candidates.find(c => c.nomeNormalizado === sourceName);
  if (exactMatch) {
    return { source: sourceName, target: exactMatch.nome, score: 1, method: 'exact' };
  }

  // 4. Fuzzy match (Dice coefficient)
  let bestScore = 0;
  let bestCandidate: typeof candidates[0] | null = null;

  for (const c of candidates) {
    const score = diceCoefficient(sourceName, c.nomeNormalizado);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = c;
    }
  }

  if (bestCandidate && bestScore >= threshold) {
    return {
      source: sourceName,
      target: bestCandidate.nome,
      score: bestScore,
      method: 'dice',
    };
  }

  return null;
}
