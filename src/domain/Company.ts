export interface Company {
  nome: string;
  cnpj: string;
  identificacao: string;
  logoUrl: string;
  status: 'ativo' | 'inativo';
}

export function empresaVazia(): Company {
  return { nome: '', cnpj: '', identificacao: '', logoUrl: '', status: 'ativo' };
}
