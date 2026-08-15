import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BotaoFeedback } from '../ui/Feedback';

const FULL_BLEED_ROUTES = ['/motor-he'];

export function AppLayout() {
  const location = useLocation();
  const fullBleed = FULL_BLEED_ROUTES.includes(location.pathname);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar />
        {fullBleed ? (
          <Outlet />
        ) : (
          <div className="page">
            <Outlet />
          </div>
        )}
      </div>
      {/* Programa piloto: canal de relato sempre à mão, em qualquer tela. Não aparece na
          demonstração — lá não há empresa real de quem o relato partiria. */}
      <BotaoFeedback />
    </div>
  );
}
