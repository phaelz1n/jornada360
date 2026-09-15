// ============================================================
// Ponto Icarus API Client (Espelho de Ponto Eletrônico)
// ============================================================

import type {
  IcarusConfig,
  IcarusColaborador,
  IcarusBatida,
  IcarusJustificativaPayload,
  IcarusApiResponse,
} from './types';
import type { PointRecordNormalized } from '@/types/sync';
import type { PointRecord, ClockEvent } from '@/types/point';
import { normalizeDriverName } from '@/lib/utils/normalize';

const DEFAULT_BASE_URL = process.env.ICARUS_BASE_URL || 'https://backendicarus.pontoicarus.com.br';
const DEFAULT_REPORTS_URL = process.env.ICARUS_REPORTS_URL || 'https://backendicarusrelatorios.pontoicarus.com.br';

export interface IcarusEspelhoRaw {
  colaborador?: {
    id?: string | number;
    nome?: string;
    cpf?: string;
    matricula?: string;
  };
  colaboradorId?: string | number;
  idMutuario?: string | number;
  colaboradorNome?: string;
  nome?: string;
  cpf?: string;
  documento?: string;
  matricula?: string;
  data?: string;
  marcacoes?: Array<{
    hora?: string;
    timestamp?: string;
    tipo?: string;
  }>;
  batidas?: string[];
  horas_normais_minutos?: number;
  horas_extras_1_minutos?: number;
  horas_extras_2_minutos?: number;
  hn_min?: number;
  he1_min?: number;
  he2_min?: number;
  tempoNormal?: number;
  tempoExtra50?: number;
  tempoExtra100?: number;
  tempoExtra150?: number;
}

export class IcarusClient {
  private apiToken: string;
  private baseUrl: string;
  private reportsUrl: string;
  private empresaId?: string;

  constructor(token?: string, baseUrl?: string, empresaId?: string) {
    this.apiToken = (token || process.env.ICARUS_API_TOKEN || '').trim();
    
    // Auto-correção: se o usuário ou localStorage tiver o domínio antigo "api.pontoicarus.com.br"
    // (que é pixel de marketing Stape.io e retorna 400), redireciona para o backend real
    let url = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '').trim();
    if (url.includes('api.pontoicarus.com.br') || !url) {
      url = 'https://backendicarus.pontoicarus.com.br';
    }
    this.baseUrl = url;
    this.reportsUrl = DEFAULT_REPORTS_URL;
    this.empresaId = (empresaId || process.env.ICARUS_EMPRESA_ID || '').trim();
  }

  private getAuthHeaders(overrideToken?: string): HeadersInit {
    const tok = overrideToken || this.apiToken;
    const bearer = tok.startsWith('Bearer ') ? tok : `Bearer ${tok}`;
    const cleanToken = tok.replace(/^Bearer\s+/i, '');

    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      Authorization: bearer,
      token: cleanToken,
      'x-api-key': cleanToken,
      'User-Agent': 'Jornada360-Icarus-Connector/2.3',
    };
    if (this.empresaId) {
      h['x-empresa-id'] = this.empresaId;
      h['empresa-id'] = this.empresaId;
    }
    return h;
  }

  private get headers(): HeadersInit {
    return this.getAuthHeaders();
  }

  /**
   * Executa requisições HTTP com Exponential Backoff para tolerância a falhas
   */
  private async fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
    let delay = 1000;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

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
    throw new Error('Falha ao comunicar com o Ponto Icarus após múltiplas tentativas.');
  }

  /**
   * Testa a conectividade e autenticação com a API oficial do Ponto Icarus (REST 2.3)
   */
  async testConnection(): Promise<IcarusApiResponse<{ empresa?: string; status: string; endpoint?: string }>> {
    if (!this.apiToken) {
      return {
        success: false,
        message: 'Token de API do Ponto Icarus não informado.',
      };
    }

    try {
      const cleanToken = this.apiToken.replace(/^Bearer\s+/i, '');
      const authVariants = [
        { Authorization: `Bearer ${cleanToken}` },
        { Authorization: cleanToken },
      ];

      // Endpoints oficiais do Swagger 2.3 Ponto Icarus
      const probeEndpoints = [
        { url: `${this.baseUrl}/motivoAbonoPonto/listarTodos`, method: 'GET', body: undefined },
        { url: `${this.baseUrl}/documentoExigido/listar`, method: 'GET', body: undefined },
        { url: `${this.baseUrl}/mutuario/pesquisa/0`, method: 'POST', body: JSON.stringify({}) },
        { url: `${this.baseUrl}/integracaoRep/listarIntegracoes`, method: 'GET', body: undefined },
        { url: `${this.reportsUrl}/turno/relatorioTurno`, method: 'GET', body: undefined },
        { url: `${this.reportsUrl}/ponto/relatorioTotalizadorDeJornada/0`, method: 'POST', body: JSON.stringify({}) },
      ];

      let lastStatus = 0;
      let lastErrorDetail = '';

      for (const authHeader of authVariants) {
        const testHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
          ...authHeader,
          token: cleanToken,
          'x-api-key': cleanToken,
          'User-Agent': 'Jornada360-Icarus-Connector/2.3',
        };
        if (this.empresaId) {
          testHeaders['x-empresa-id'] = this.empresaId;
        }

        for (const probe of probeEndpoints) {
          try {
            const res = await this.fetchWithRetry(probe.url, {
              method: probe.method,
              headers: testHeaders,
              body: probe.body,
            });

            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              return {
                success: true,
                message: 'Conexão com API oficial do Ponto Icarus estabelecida com sucesso!',
                data: {
                  empresa: data?.razaoSocial || data?.nome || this.empresaId || 'Ponto Icarus Integrado',
                  status: 'online',
                  endpoint: probe.url,
                },
              };
            }

            lastStatus = res.status;
            const text = await res.text().catch(() => '');
            if (text) {
              try {
                const j = JSON.parse(text);
                lastErrorDetail = j.message || j.error || j.msg || text;
              } catch {
                lastErrorDetail = text.slice(0, 150);
              }
            }
          } catch {
            // Continua testando próximo endpoint
          }
        }
      }

      if (lastStatus === 401 || lastStatus === 403) {
        return {
          success: false,
          statusCode: lastStatus,
          message: `Token do Ponto Icarus recusado (Status ${lastStatus} - Não Autorizado). Verifique se o token foi gerado em 'Minha Empresa > Token de Integração' no painel Ponto Icarus e se possui permissão de leitura.`,
        };
      }

      return {
        success: false,
        statusCode: lastStatus || 400,
        message: lastErrorDetail
          ? `Servidor Ponto Icarus retornou status ${lastStatus}: ${lastErrorDetail}`
          : `Servidor Ponto Icarus retornou status ${lastStatus || 400}. Verifique a URL do backend (${this.baseUrl}).`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Falha na conexão de rede com Ponto Icarus: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Obtém batidas do Icarus (método legado / compatibilidade)
   */
  async getBatidas(startDate: string, endDate: string): Promise<IcarusApiResponse<IcarusBatida[]>> {
    try {
      const normalized = await this.getEspelhoPontos(startDate, endDate);
      const batidas: IcarusBatida[] = [];
      for (const item of normalized) {
        for (const p of item.punches) {
          batidas.push({
            id: `batida_${item.employeeId}_${item.date}_${p.time}`,
            colaboradorId: item.employeeId,
            colaboradorNome: item.name,
            data: item.date,
            hora: p.time,
            tipo: 'entrada',
          });
        }
      }
      return { success: true, data: batidas };
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message };
    }
  }

  /**
   * Obtém os pontos e espelho eletrônico no formato PointRecordNormalized
   */
  async getEspelhoPontos(startDate: string, endDate: string): Promise<PointRecordNormalized[]> {
    if (!this.apiToken) return [];

    try {
      // 1. Tenta a API oficial de Relatórios 2.3 (Totalizador de Jornada)
      const relatoriosRes = await this.fetchWithRetry(
        `${this.reportsUrl}/ponto/relatorioTotalizadorDeJornada/0`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            dataInicio: startDate,
            dataFim: endDate,
          }),
        }
      ).catch(() => null);

      if (relatoriosRes && relatoriosRes.ok) {
        const data = await relatoriosRes.json().catch(() => ({}));
        const list = Array.isArray(data) ? data : data?.content || data?.itens || [];
        if (list.length > 0) {
          return this.normalizeEspelhoData(list);
        }
      }

      // 2. Tenta o endpoint REST de consulta de registros
      const consultaRes = await this.fetchWithRetry(
        `${this.baseUrl}/ponto/consultarRegistrosPonto`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            dataInicio: `${startDate}T00:00:00.000Z`,
            dataFim: `${endDate}T23:59:59.000Z`,
          }),
        }
      ).catch(() => null);

      if (consultaRes && consultaRes.ok) {
        const data = await consultaRes.json().catch(() => ({}));
        const list = Array.isArray(data) ? data : data?.content || data?.itens || [];
        if (list.length > 0) {
          return this.normalizeEspelhoData(list);
        }
      }

      // 3. Fallback legado para endpoints GET /espelho ou /pontos
      const url = new URL(`${this.baseUrl}/espelho`);
      url.searchParams.append('dataInicio', startDate);
      url.searchParams.append('dataFim', endDate);

      const res = await this.fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: this.headers,
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => []);
        return this.normalizeEspelhoData(Array.isArray(data) ? data : data?.itens || []);
      }

      return [];
    } catch (err) {
      console.error('Falha ao obter espelho de ponto do Icarus:', err);
      return [];
    }
  }

  /**
   * Normaliza dados brutos do Icarus para PointRecordNormalized
   */
  private normalizeEspelhoData(items: IcarusEspelhoRaw[]): PointRecordNormalized[] {
    const results: PointRecordNormalized[] = [];

    for (const item of items) {
      const employeeId = String(
        item.colaboradorId || item.idMutuario || item.colaborador?.id || `emp_${Math.random().toString(36).slice(2, 7)}`
      );
      const name = (item.colaboradorNome || item.nome || item.colaborador?.nome || '').trim();
      if (!name) continue;

      const cpf = item.cpf || item.documento || item.colaborador?.cpf || '';
      const registration = item.matricula || item.colaborador?.matricula || '';
      const date = item.data || new Date().toISOString().slice(0, 10);

      // Processar batidas
      const punches: Array<{ time: string; originalTimestamp: string }> = [];

      if (Array.isArray(item.marcacoes)) {
        for (const m of item.marcacoes) {
          const time = (m.hora || '').slice(0, 5);
          if (time) {
            punches.push({
              time,
              originalTimestamp: m.timestamp || `${date}T${time}:00Z`,
            });
          }
        }
      } else if (Array.isArray(item.batidas)) {
        for (const b of item.batidas) {
          const time = String(b).trim().slice(0, 5);
          if (time) {
            punches.push({
              time,
              originalTimestamp: `${date}T${time}:00Z`,
            });
          }
        }
      }

      const hnMin = item.horas_normais_minutos ?? item.hn_min ?? item.tempoNormal ?? 440;
      const he1Min = item.horas_extras_1_minutos ?? item.he1_min ?? item.tempoExtra50 ?? 0;
      const he2Min = item.horas_extras_2_minutos ?? item.he2_min ?? item.tempoExtra100 ?? 0;

      results.push({
        employeeId,
        name,
        cpf,
        registration,
        date,
        punches,
        he1Min,
        he2Min,
        hnMin,
      });
    }

    return results;
  }

  /**
   * Converte PointRecordNormalized para PointRecord (com ClockEvent e tratamento de turno noturno) para o AuditEngine
   */
  static toPointRecords(normalizedList: PointRecordNormalized[]): PointRecord[] {
    return normalizedList.map(rec => {
      const nomeNormalizado = normalizeDriverName(rec.name);
      const clockEvents: ClockEvent[] = [];

      let previousMinutes = -1;
      let dayOffset = 0;

      // Ordenar batidas cronologicamente
      const sortedPunches = [...rec.punches].sort((a, b) => a.time.localeCompare(b.time));

      for (let i = 0; i < sortedPunches.length; i++) {
        const p = sortedPunches[i];
        const [hStr, mStr] = p.time.split(':');
        const h = parseInt(hStr || '0', 10);
        const m = parseInt(mStr || '0', 10);
        const currentMinutes = h * 60 + m;

        // Normalização de turno noturno: se o horário atual for menor que o anterior, cruzou meia-noite (+1 dia)
        if (previousMinutes !== -1 && currentMinutes < previousMinutes) {
          dayOffset += 1;
        }
        previousMinutes = currentMinutes;

        const baseDate = new Date(`${rec.date}T00:00:00.000Z`);
        baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset);
        baseDate.setUTCHours(h, m, 0, 0);

        clockEvents.push({
          time: baseDate,
          type: i % 2 === 0 ? 'entrada' : 'saida',
          rawString: p.time,
        });
      }

      return {
        id: `point_icarus_${rec.employeeId}_${rec.date}`,
        nome: rec.name,
        nomeNormalizado,
        cpf: rec.cpf,
        matricula: rec.registration,
        data: rec.date,
        batidas: clockEvents,
        hnMin: rec.hnMin,
        he1Min: rec.he1Min,
        he2Min: rec.he2Min,
        rawBatidas: rec.punches.map(p => p.time).join(' '),
      };
    });
  }

  /**
   * Envia uma justificativa ou ajuste de ponto diretamente para o Icarus
   */
  async enviarJustificativa(
    payload: IcarusJustificativaPayload
  ): Promise<IcarusApiResponse<{ protocolo?: string }>> {
    if (!this.apiToken) {
      return {
        success: false,
        message: 'Token do Ponto Icarus não configurado.',
      };
    }

    try {
      const res = await this.fetchWithRetry(`${this.baseUrl}/justificativas`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          colaboradorId: payload.colaboradorId,
          colaboradorNome: payload.colaboradorNome,
          data: payload.data,
          motivo: payload.motivo || 'Horas Extras',
          justificativa: payload.justificativa,
          responsavel: payload.usuarioResponsavel,
          origem: 'Jornada360',
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        return {
          success: false,
          statusCode: res.status,
          message: `Erro no envio da justificativa ao Icarus: ${res.status} - ${errorBody}`,
        };
      }

      const result = await res.json().catch(() => ({}));
      return {
        success: true,
        message: 'Justificativa sincronizada com Ponto Icarus com sucesso!',
        data: { protocolo: result?.id || result?.protocolo },
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Falha ao comunicar com Icarus: ${(err as Error).message}`,
      };
    }
  }
}
