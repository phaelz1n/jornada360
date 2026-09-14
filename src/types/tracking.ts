// ============================================================
// Tracking / Telemetry Types (Rastreamento Veicular / Cobli)
// ============================================================

export interface VehicleEvent {
  /** Nome do motorista como veio do Cobli */
  motorista: string;
  /** Nome normalizado */
  motoristaNormalizado: string;
  /** Data/hora de partida */
  partida: Date;
  /** Data/hora de parada */
  parada: Date;
  /** Placa do veículo */
  placa: string;
}

export interface TrackingRecord {
  id: string;
  /** Data no formato YYYY-MM-DD */
  data: string;
  /** Eventos de trajeto do motorista naquele dia */
  eventos: VehicleEvent[];
}
