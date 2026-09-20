'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { ToastProvider } from './ui';
import type { SessionPayload } from '@/lib/auth';

export function AppShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('ctms-theme', next ? 'dark' : 'light');
    } catch {
      /* private browsing — the class still applies for this session */
    }
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar
          role={session.role}
          name={session.name}
          open={navOpen}
          onClose={() => setNavOpen(false)}
        />
        <main className="min-w-0 flex-1">
          <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2.5">
            <button className="btn-ghost btn-sm lg:hidden" onClick={() => setNavOpen(true)}>
              ☰
            </button>
            <div className="flex-1" />
            <span className="badge bg-brand/15 text-brand">
              {session.role === 'ADMIN' ? 'Administrator' : 'Teacher'}
            </span>
            <button className="btn-ghost btn-sm" onClick={toggleTheme} aria-label="Toggle theme">
              {dark ? '☀️' : '🌙'}
            </button>
          </header>
          <div className="mx-auto max-w-[1500px] p-4">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
