'use client';

// ============================================================
// Workspace Provider & Context
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Workspace, WorkspaceConfig } from '@/types/workspace';
import { createDefaultConfig } from '@/types/workspace';
import type { IDataAdapter } from '@/lib/db/adapter';
import { getAdapter, isOfflineMode } from '@/lib/db';

interface WorkspaceContextValue {
  workspace: Workspace | null;
  config: WorkspaceConfig;
  adapter: IDataAdapter | null;
  isOffline: boolean;
  isLoading: boolean;
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  updateConfig: (partial: Partial<WorkspaceConfig>) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  config: createDefaultConfig(),
  adapter: null,
  isOffline: true,
  isLoading: true,
  workspaceId: 'default',
  setWorkspaceId: () => {},
  updateConfig: async () => {},
});

const DEFAULT_WORKSPACE_ID = 'default';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState(DEFAULT_WORKSPACE_ID);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [adapter, setAdapter] = useState<IDataAdapter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isOffline = isOfflineMode();

  // Initialize adapter and load workspace
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const adp = await getAdapter();
        if (cancelled) return;
        setAdapter(adp);

        let ws = await adp.getWorkspace(workspaceId);
        if (!ws) {
          // Create default workspace
          ws = {
            id: workspaceId,
            nome: 'Workspace Padrão',
            config: createDefaultConfig(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await adp.saveWorkspace(ws);
        }

        if (!cancelled) {
          setWorkspace(ws);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Erro ao inicializar workspace:', err);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleSetWorkspaceId = useCallback((id: string) => {
    setIsLoading(true);
    setWorkspaceId(id);
  }, []);

  const updateConfig = useCallback(
    async (partial: Partial<WorkspaceConfig>) => {
      if (!workspace || !adapter) return;
      const newConfig = { ...workspace.config, ...partial };
      const updated = { ...workspace, config: newConfig, updatedAt: new Date() };
      await adapter.saveWorkspace(updated);
      setWorkspace(updated);
    },
    [workspace, adapter]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        config: workspace?.config || createDefaultConfig(),
        adapter,
        isOffline,
        isLoading,
        workspaceId,
        setWorkspaceId: handleSetWorkspaceId,
        updateConfig,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
