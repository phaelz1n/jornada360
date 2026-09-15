// ============================================================
// Cobli API Client (Telemetria & Rastreamento)
// ============================================================

import type { TrackingEvent } from '@/types/sync';
import type { TrackingRecord, VehicleEvent } from '@/types/tracking';
import { normalizeDriverName } from '@/lib/utils/normalize';

const DEFAULT_COBLI_BASE_URL = 'https://api.cobli.co';

export interface CobliTripRaw {
  id?: string;
  trip_id?: string;
  driver?: {
    id?: string;
    name?: string;
    rfid_card?: string;
    cpf?: string;
  };
  driver_name?: string;
  vehicle?: {
    id?: string;
    license_plate?: string;
  };
  license_plate?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  distance_meters?: number;
  is_telematics_gap?: boolean;
}

export class CobliClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = (apiKey || process.env.COBLI_API_KEY || '').trim();
    this.baseUrl = (baseUrl || process.env.COBLI_BASE_URL || DEFAULT_COBLI_BASE_URL).replace(/\/$/, '');
  }

  /**
   * Cabeçalhos padronizados da Cobli.
   * Conforme OpenAPI oficial: 'cobli-api-key: <chave>'
   */
  private getHeaders(useBearer = false): HeadersInit {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'cobli-api-key': this.apiKey,
    };
    if (useBearer) {
      h['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  /**
   * Executa requisição HTTP com Exponential Backoff para tolerância a falhas e rate limiting
   */
  private async fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
    let delay = 1000;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        // Se for rate limit (429) ou erro temporário de gateway (502, 503, 504), aguarda com backoff
        if (response.status === 429 || (response.status >= 502 && response.status <= 504)) {
          if (attempt < maxRetries - 1) {
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
            continue;
          }
        }

        return response;
      } catch (err) {
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
    throw new Error('Falha ao comunicar com a API Cobli após múltiplas tentativas.');
  }

  /**
   * Testa a conectividade com a API Cobli nos endpoints públicos oficiais
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'API Key da Cobli não configurada.' };
    }

    const testEndpoints = [
      '/public/v1/drivers?limit=1',
      '/public/v1/vehicles?limit=1',
      '/public/v1/devices?limit=1',
    ];

    let lastError = '';

    // 1. Testar com o cabeçalho oficial da Cobli: 'cobli-api-key'
    for (const ep of testEndpoints) {
      try {
        const url = `${this.baseUrl}${ep}`;
        const res = await this.fetchWithRetry(url, {
          method: 'GET',
          headers: this.getHeaders(false),
        });

        if (res.ok) {
          return { success: true, message: 'Conexão com Cobli estabelecida com sucesso! (Frota autenticada)' };
        }

        if (res.status === 401 || res.status === 403) {
          const body = await res.json().catch(() => null);
          lastError = body?.message || body?.error || `HTTP ${res.status}: Não autorizado`;
        } else {
          lastError = `HTTP ${res.status}: ${res.statusText}`;
        }
      } catch (err) {
        lastError = (err as Error).message;
      }
    }

    // 2. Se falhou, tentar com Authorization: Bearer
    for (const ep of testEndpoints) {
      try {
        const url = `${this.baseUrl}${ep}`;
        const res = await this.fetchWithRetry(url, {
          method: 'GET',
          headers: this.getHeaders(true),
        });

        if (res.ok) {
          return { success: true, message: 'Conectado com sucesso à Cobli (via Bearer)!' };
        }
      } catch {
        // ignora
      }
    }

    return {
      success: false,
      message: `Cobli recusou a chave (${lastError || 'Não autorizado'}). Verifique se a chave em Configurações > Chaves de API foi copiada por completo e tem permissão de leitura.`,
    };
  }

  /**
   * Consulta os trajetos e paradas da Cobli no período especificado
   */
  async getTrips(startDate: string, endDate: string): Promise<TrackingEvent[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const startIso = `${startDate}T00:00:00-03:00`;
      const endIso = `${endDate}T23:59:59-03:00`;

      // 1. Tentar rota oficial de Trajetos e Paradas: POST /public/v1/trips-and-stops
      const urlTripsAndStops = `${this.baseUrl}/public/v1/trips-and-stops`;
      let res = await this.fetchWithRetry(urlTripsAndStops, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({
          start_date: startIso,
          end_date: endIso,
          timezone: 'America/Sao_Paulo',
        }),
      });

      let rawItems: CobliTripRaw[] = [];

      if (res.ok) {
        const rawData = await res.json();
        rawItems = Array.isArray(rawData) ? rawData : rawData?.data || rawData?.trips || rawData?.results || [];
      } else {
        // Fallback para GET /v1/trips
        const fallbackUrl = new URL(`${this.baseUrl}/v1/trips`);
        fallbackUrl.searchParams.append('start_date', new Date(startIso).toISOString());
        fallbackUrl.searchParams.append('end_date', new Date(endIso).toISOString());

        const fallbackRes = await this.fetchWithRetry(fallbackUrl.toString(), {
          method: 'GET',
          headers: this.getHeaders(false),
        });

        if (fallbackRes.ok) {
          const rawData = await fallbackRes.json();
          rawItems = Array.isArray(rawData) ? rawData : rawData?.data || rawData?.trips || [];
        } else {
          console.error(`Cobli trips error: ${res.status} e fallback: ${fallbackRes.status}`);
          return [];
        }
      }

      // Mapeamento e normalização com descarte de registros sem motorista ou com "--"
      const events: TrackingEvent[] = [];

      for (const trip of rawItems) {
        const driverName = (trip.driver?.name || trip.driver_name || '').trim();

        // Regra de descarte de registros vazios ou sem motorista ("--")
        if (!driverName || driverName === '--' || driverName.toLowerCase() === 'sem motorista') {
          continue;
        }

        const departure = trip.start_time || '';
        const stop = trip.end_time || '';
        if (!departure || !stop) continue;

        const durationSec = trip.duration_seconds || 0;
        const durationMin = Math.round(durationSec / 60);
        const distanceKm = Number(((trip.distance_meters || 0) / 1000).toFixed(2));
        const vehiclePlate = (trip.vehicle?.license_plate || trip.license_plate || 'SEM_PLACA').toUpperCase().trim();

        events.push({
          id: trip.id || trip.trip_id || `cobli_${Math.random().toString(36).slice(2, 9)}`,
          driverName,
          driverDoc: trip.driver?.cpf,
          vehiclePlate,
          departureTime: departure,
          stopTime: stop,
          durationMin,
          distanceKm,
          isTelematicsGap: !!trip.is_telematics_gap,
        });
      }

      return events;
    } catch (err) {
      console.error('Falha ao obter trajetos da Cobli:', err);
      return [];
    }
  }

  /**
   * Converte a lista de TrackingEvent no formato TrackingRecord/VehicleEvent consumido pelo AuditEngine
   */
  static toTrackingRecords(events: TrackingEvent[]): TrackingRecord[] {
    const recordsByDate = new Map<string, VehicleEvent[]>();

    for (const ev of events) {
      const depDate = new Date(ev.departureTime);
      const stopDate = new Date(ev.stopTime);
      const dateKey = depDate.toISOString().slice(0, 10);

      const vehicleEvent: VehicleEvent = {
        motorista: ev.driverName,
        motoristaNormalizado: normalizeDriverName(ev.driverName),
        partida: depDate,
        parada: stopDate,
        placa: ev.vehiclePlate,
      };

      if (!recordsByDate.has(dateKey)) {
        recordsByDate.set(dateKey, []);
      }
      recordsByDate.get(dateKey)!.push(vehicleEvent);
    }

    return Array.from(recordsByDate.entries()).map(([data, eventos]) => ({
      id: `tracking_cobli_${data}`,
      data,
      eventos,
    }));
  }
}
