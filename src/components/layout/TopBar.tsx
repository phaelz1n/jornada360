'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { NAV_ROUTES } from '@/lib/constants';

export function TopBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { workspace, isOffline } = useWorkspace();

  // Find current route label
  const currentRoute = NAV_ROUTES.find(
    r => pathname === r.href || pathname.startsWith(r.href + '/')
  );
  const pageTitle = currentRoute?.label || 'Jornada360';

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-6 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Jornada360</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-200 font-medium">{pageTitle}</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Workspace indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-400">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="max-w-[150px] truncate">{workspace?.nome || 'Workspace'}</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        {/* User avatar placeholder */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/20">
          U
        </div>
      </div>
    </header>
  );
}
