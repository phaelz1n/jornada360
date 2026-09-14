'use client';

import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { WorkspaceProvider } from '@/components/providers/WorkspaceProvider';
import { AuditDataProvider } from '@/components/providers/AuditDataProvider';
import { AppShell } from '@/components/layout/AppShell';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <AuditDataProvider>
          <AppShell>{children}</AppShell>
        </AuditDataProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}

