'use client';

import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Banner } from '@/components/ui/Banner';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';
import { Spinner } from '@/components/ui/Spinner';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isOffline, isLoading } = useWorkspace();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 animate-pulse">
            <span className="text-white font-bold text-lg">J</span>
          </div>
          <Spinner size="md" />
          <p className="text-sm text-slate-500">Carregando Jornada360...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />

      {/* Main content area — offset by sidebar width */}
      <div className="ml-[260px] transition-all duration-300">
        <TopBar />

        {/* Offline banner */}
        {isOffline && (
          <div className="px-6 pt-4">
            <Banner variant="offline">
              <strong>Modo Local:</strong> Firebase não configurado. Os dados estão sendo armazenados no navegador (IndexedDB).
            </Banner>
          </div>
        )}

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
