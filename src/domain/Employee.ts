export interface Employee {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
  setorId: string | null;
  unidadeId: string | null;
  status: 'ativo' | 'inativo' | 'afastado';
  escalaId: string | null;
}
