'use client';

// ── AuthLayoutWrapper ────────────────────────────────────────────────
// Conditionally renders the DashboardShell + overlays based on the
// current route. Login page gets a clean, shell-free layout.

import { usePathname } from 'next/navigation';
import DashboardShell from './DashboardShell';
import CommandPalette from './CommandPalette';
import KeyboardShortcuts from './KeyboardShortcuts';
import AIChat from './AIChat';

const SHELL_FREE_ROUTES = ['/login'];

function isShellFreeRoute(pathname: string): boolean {
  return SHELL_FREE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export default function AuthLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const skipShell = isShellFreeRoute(pathname);

  if (skipShell) {
    return <>{children}</>;
  }

  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      <CommandPalette />
      <KeyboardShortcuts />
      <AIChat />
    </>
  );
}
