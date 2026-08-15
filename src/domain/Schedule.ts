export interface Schedule {
  id: string;
  nome: string;
  entrada: string; // "HH:MM"
  saida: string; // "HH:MM"
  diasTrabalhados: string[]; // ex: ['seg','ter','qua','qui','sex']
  folgas: string[]; // ex: ['sab','dom']
  heProgramadaMin: number;
}
