'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '@/lib/client';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: ('ADMIN' | 'TEACHER')[];
}
export interface NavGroup {
  group: string | null;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { group: null, items: [{ href: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['ADMIN', 'TEACHER'] }] },
  {
    group: 'Academic Setup',
    items: [
      { href: '/streams', label: 'Streams', icon: '🎓', roles: ['ADMIN'] },
      { href: '/academic-years', label: 'Academic Years', icon: '📅', roles: ['ADMIN'] },
      { href: '/classes', label: 'Classes & Divisions', icon: '🏫', roles: ['ADMIN'] },
    ],
  },
  {
    group: 'Faculty',
    items: [
      { href: '/teachers', label: 'Teachers', icon: '👩‍🏫', roles: ['ADMIN'] },
      { href: '/availability', label: 'Availability', icon: '🕐', roles: ['ADMIN'] },
    ],
  },
  {
    group: 'Subjects',
    items: [
      { href: '/subjects', label: 'Subject Master', icon: '📘', roles: ['ADMIN'] },
      { href: '/syllabus', label: 'Syllabus', icon: '📖', roles: ['ADMIN'] },
      { href: '/allocations', label: 'Subject Allocation', icon: '🔗', roles: ['ADMIN'] },
    ],
  },
  {
    group: 'Work Management',
    items: [{ href: '/work-allotment', label: 'Work Allotment', icon: '📋', roles: ['ADMIN', 'TEACHER'] }],
  },
  {
    group: 'Timetable',
    items: [
      { href: '/time-slots', label: 'Time Slots', icon: '⏰', roles: ['ADMIN'] },
      { href: '/rooms', label: 'Rooms', icon: '🚪', roles: ['ADMIN'] },
      { href: '/timetable/builder', label: 'Timetable Builder', icon: '🗓️', roles: ['ADMIN'] },
      { href: '/timetable/class', label: 'Class-wise', icon: '🏫', roles: ['ADMIN', 'TEACHER'] },
      { href: '/timetable/master', label: 'General / Master', icon: '🌐', roles: ['ADMIN', 'TEACHER'] },
      { href: '/timetable/teacher', label: 'Teacher-wise', icon: '👩‍🏫', roles: ['ADMIN', 'TEACHER'] },
      { href: '/timetable/room', label: 'Room-wise', icon: '🚪', roles: ['ADMIN'] },
    ],
  },
  {
    group: 'Reports',
    items: [
      { href: '/reports/workload', label: 'Faculty Workload', icon: '📈', roles: ['ADMIN'] },
      { href: '/reports/allocation', label: 'Subject Allocation', icon: '📈', roles: ['ADMIN'] },
      { href: '/reports/allotment', label: 'Work Allotment', icon: '📈', roles: ['ADMIN'] },
    ],
  },
  {
    group: 'System',
    items: [
      { href: '/audit', label: 'Audit History', icon: '🕘', roles: ['ADMIN'] },
      { href: '/settings', label: 'Settings', icon: '⚙️', roles: ['ADMIN'] },
    ],
  },
];

export function Sidebar({
  role,
  name,
  open,
  onClose,
}: {
  role: 'ADMIN' | 'TEACHER';
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await post('/api/auth/logout', {});
      router.push('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-60 overflow-y-auto bg-[#161b2e] px-2.5 py-3.5 transition-transform
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-2 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-base">🎓</div>
          <div>
            <div className="text-sm font-extrabold leading-tight text-white">CampusGrid</div>
            <div className="text-[10px] text-slate-400">Timetable System</div>
          </div>
        </div>

        {NAV.map((section, i) => {
          const items = section.items.filter((item) => item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={section.group ?? `g${i}`}>
              {section.group ? (
                <div className="px-3 pb-1 pt-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {section.group}
                </div>
              ) : (
                <div className="h-2" />
              )}
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition ${
                      active ? 'bg-brand text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}

        <div className="mt-5 border-t border-white/10 px-3 pt-3">
          <div className="text-[11px] text-slate-400">Signed in as</div>
          <div className="mb-2 truncate text-sm text-white">{name}</div>
          <button
            className="w-full rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
            onClick={logout}
            disabled={busy}
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  );
}
