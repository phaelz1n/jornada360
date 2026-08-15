import { AlertTriangle, Loader2, Lock, PauseCircle, RefreshCw, ServerOff, TimerOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErroApi } from '../../api/client';

/* Estados de rede em forma de componente.
 *
 * O ponto não é estética: é que "carregando", "não deu certo", "sua sessão caiu" e "você não tem
 * permissão" são situações DIFERENTES e precisam ser ditas de forma diferente. Um "erro" genérico
 * faz a pessoa tentar de novo quando deveria entrar de novo, ou pedir acesso quando deveria só
 * esperar. Cada estado aqui diz o que aconteceu e qual é o próximo passo. */

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="estado-async" role="status" aria-live="polite">
      <Loader2 size={20} className="girando" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

function Painel({ icone, titulo, children, acao }: { icone: ReactNode; titulo: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="estado-async estado-async--painel" role="alert">
      <div className="estado-async__icone" aria-hidden>{icone}</div>
      <div>
        <strong>{titulo}</strong>
        <p>{children}</p>
        {acao && <div className="estado-async__acao">{acao}</div>}
      </div>
    </div>
  );
}

export function ApiIndisponivel({ aoTentar }: { aoTentar?: () => void }) {
  return (
    <Painel
      icone={<ServerOff size={20} />}
      titulo="Não foi possível conectar ao servidor"
      acao={aoTentar && <button className="btn btn-sm" onClick={aoTentar}><RefreshCw size={14} /> Tentar de novo</button>}
    >
      Os dados da empresa ficam no servidor e ele não respondeu. Nada foi salvo neste navegador — quando
      a conexão voltar, tudo estará onde estava.
    </Painel>
  );
}

export function SessaoExpirada({ aoEntrar }: { aoEntrar?: () => void }) {
  return (
    <Painel
      icone={<TimerOff size={20} />}
      titulo="Sua sessão expirou"
      acao={aoEntrar && <button className="btn btn-sm btn-primario" onClick={aoEntrar}>Entrar novamente</button>}
    >
      Por segurança, a sessão vale por tempo limitado. Entre de novo para continuar de onde parou.
    </Painel>
  );
}

export function AcessoNegado({ acao }: { acao?: string }) {
  return (
    <Painel icone={<Lock size={20} />} titulo="Acesso não permitido">
      Seu perfil não permite {acao ?? 'esta ação'}. Peça a um administrador da empresa para ajustar seu
      papel se você precisar deste acesso.
    </Painel>
  );
}

/* Empresa com acesso suspenso pelo operador do programa piloto.
 *
 * Distinta de "acesso negado" de propósito. Ali o problema é o PAPEL da pessoa; aqui é a situação
 * da EMPRESA, e a mensagem precisa dizer três coisas que a pessoa vai querer saber na hora: que o
 * bloqueio é da empresa e não dela, que os dados continuam existindo, e com quem falar. Um
 * "acesso negado" genérico deixaria alguém achando que perdeu meses de trabalho. */
export function EmpresaSuspensa({ motivo }: { motivo?: string | null }) {
  return (
    <Painel icone={<PauseCircle size={20} />} titulo="O acesso desta empresa está suspenso">
      <b>Seus dados estão preservados</b> — nada foi apagado. O acesso foi pausado pela equipe do
      Jornada360{motivo ? `: ${motivo}` : '.'}
      {' '}Fale conosco para reativar.
    </Painel>
  );
}

export function ErroAoCarregar({ erro, aoTentar }: { erro: ErroApi | null; aoTentar?: () => void }) {
  if (erro?.tipo === 'rede') return <ApiIndisponivel aoTentar={aoTentar} />;
  if (erro?.tipo === 'sessao') return <SessaoExpirada />;
  /* O servidor devolve 403 com este código quando a empresa está suspensa. Sem este desvio, a
   * pessoa veria "seu perfil não permite" — que é falso e assustador. */
  if (erro?.status === 403 && /suspens/i.test(erro.message)) return <EmpresaSuspensa />;
  if (erro?.tipo === 'permissao') return <AcessoNegado acao="ver esta informação" />;

  return (
    <Painel
      icone={<AlertTriangle size={20} />}
      titulo="Não foi possível carregar"
      acao={aoTentar && <button className="btn btn-sm" onClick={aoTentar}><RefreshCw size={14} /> Tentar de novo</button>}
    >
      {erro?.message ?? 'Algo deu errado ao buscar os dados.'}
    </Painel>
  );
}

/* Feedback de gravação. Discreto de propósito: aparece ao lado do botão que a pessoa acabou de
 * clicar, não como um alerta que rouba o foco. */
export function FeedbackGravacao({
  estado,
  erro,
  aoRecarregar,
}: {
  estado: 'ocioso' | 'salvando' | 'salvo' | 'erro';
  erro?: ErroApi | null;
  aoRecarregar?: () => void;
}) {
  if (estado === 'ocioso') return null;

  if (estado === 'salvando') {
    return <span className="feedback feedback--neutro" role="status"><Loader2 size={13} className="girando" aria-hidden /> Salvando…</span>;
  }

  if (estado === 'salvo') {
    return <span className="feedback feedback--ok" role="status">Salvo</span>;
  }

  /* Conflito não é "erro ao salvar": a gravação foi recusada de propósito, porque outra pessoa
   * alterou o mesmo registro. Tratar os dois igual levaria alguém a insistir no botão e
   * sobrescrever o trabalho do colega. */
  if (erro?.tipo === 'conflito') {
    return (
      <span className="feedback feedback--atencao" role="alert">
        Alguém alterou este registro enquanto você editava.
        {aoRecarregar && <button className="btn-link" onClick={aoRecarregar}>Recarregar</button>}
      </span>
    );
  }

  if (erro?.tipo === 'rede') {
    return <span className="feedback feedback--erro" role="alert">Sem conexão com o servidor — nada foi salvo.</span>;
  }

  if (erro?.tipo === 'permissao') {
    return <span className="feedback feedback--erro" role="alert">Seu perfil não permite esta alteração.</span>;
  }

  return <span className="feedback feedback--erro" role="alert">{erro?.message ?? 'Erro ao salvar.'}</span>;
}
