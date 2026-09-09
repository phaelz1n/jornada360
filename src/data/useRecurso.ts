/* Padrão assíncrono do Jornada360 (Fase 4).
 *
 * `useRecurso` — carregamento assíncrono com proteção contra corrida de dados.
 * `useGravacao` — gravação com trava contra duplo clique e feedback de estado.
 *
 * Duas garantias críticas de `useRecurso`:
 * 1. Resposta atrasada de pedido antigo NUNCA sobrescreve pedido mais novo.
 *    (trocar de empresa dispara dois carregamentos; o resultado do primeiro não pode chegar depois)
 * 2. Nada é gravado depois que o componente saiu da tela (sem memory leak / state update em
 *    componente desmontado).
 *
 * Sem interface otimista de propósito: a tela só mostra o valor novo depois que o servidor
 * confirmou. Antecipar o sucesso exigiria saber desfazer, e um desfazer silencioso num sistema
 * de auditoria é pior do que meio segundo de espera. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ErroApi } from '../api/client';

export type EstadoAsync = 'ocioso' | 'carregando' | 'pronto' | 'erro';

export interface RecursoState<T> {
  dados: T | null;
  estado: EstadoAsync;
  erro: ErroApi | null;
  primeiraCarga: boolean;
  recarregar: () => Promise<void>;
  definir: (v: T) => void;
}

export interface OpcoesRecurso {
  habilitado?: boolean;
}

/** Carrega um recurso assincronamente. A função `buscar` é re-executada quando qualquer
 *  dependência em `deps` muda — igual ao comportamento de `useEffect`. */
export function useRecurso<T>(
  buscar: () => Promise<T>,
  deps: unknown[],
  opcoes: OpcoesRecurso = {},
): RecursoState<T> {
  const { habilitado = true } = opcoes;

  const [dados, setDados] = useState<T | null>(null);
  const [estado, setEstado] = useState<EstadoAsync>('ocioso');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [primeiraCarga, setPrimeiraCarga] = useState(true);

  // Contador de geração: descarta respostas de pedidos antigos.
  const geracaoRef = useRef(0);
  // Indica se o componente ainda está montado.
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const carregar = useCallback(async () => {
    if (!habilitado) return;

    const geracao = ++geracaoRef.current;
    if (montadoRef.current) {
      setEstado('carregando');
      setErro(null);
    }

    try {
      const resultado = await buscar();
      if (!montadoRef.current || geracao !== geracaoRef.current) return;
      setDados(resultado);
      setEstado('pronto');
      setPrimeiraCarga(false);
    } catch (e) {
      if (!montadoRef.current || geracao !== geracaoRef.current) return;
      const erroApi = e instanceof ErroApi ? e : new ErroApi('servidor', 'Erro inesperado ao carregar.');
      setErro(erroApi);
      setEstado('erro');
      setPrimeiraCarga(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitado, ...deps]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const definir = useCallback((v: T) => {
    if (montadoRef.current) setDados(v);
  }, []);

  return {
    dados,
    estado,
    erro,
    primeiraCarga,
    recarregar: carregar,
    definir,
  };
}

export type EstadoGravacao = 'ocioso' | 'salvando' | 'salvo' | 'erro';

export interface Gravacao {
  estado: EstadoGravacao;
  erro: ErroApi | null;
  executar: <T>(acao: () => Promise<T>) => Promise<T | null>;
}

/** Executa uma gravação com trava contra duplo clique. */
export function useGravacao(): Gravacao {
  const [estado, setEstado] = useState<EstadoGravacao>('ocioso');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const travadoRef = useRef(false);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const executar = useCallback(async <T,>(acao: () => Promise<T>): Promise<T | null> => {
    if (travadoRef.current) return null;
    travadoRef.current = true;
    if (montadoRef.current) {
      setEstado('salvando');
      setErro(null);
    }

    try {
      const resultado = await acao();
      if (montadoRef.current) {
        setEstado('salvo');
        setErro(null);
      }
      setTimeout(() => {
        if (montadoRef.current) setEstado('ocioso');
      }, 2000);
      return (resultado !== undefined ? resultado : (true as unknown as T));
    } catch (e) {
      const erroApi = e instanceof ErroApi ? e : new ErroApi('servidor', 'Erro inesperado ao salvar.');
      if (montadoRef.current) {
        setEstado('erro');
        setErro(erroApi);
      }
      return null;
    } finally {
      travadoRef.current = false;
    }
  }, []);

  return { estado, erro, executar };
}

