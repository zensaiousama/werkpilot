import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login | Werkpilot Dashboard',
  description: 'Melde dich bei deinem Werkpilot Dashboard an.',
};

/**
 * Login layout — renders children directly without the DashboardShell
 * (sidebar, command palette, etc.) so the login page is a clean, full-screen experience.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
