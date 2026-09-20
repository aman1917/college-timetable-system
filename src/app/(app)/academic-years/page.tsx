'use client';

import { ResourcePage } from '@/components/ResourcePage';

interface AcademicYear { id: string; label: string; isActive: boolean }

export default function AcademicYearsPage() {
  return (
    <ResourcePage<AcademicYear>
      config={{
        title: '📅 Academic Years',
        endpoint: '/api/academic-years',
        noun: 'Academic Year',
        columns: [
          { header: 'Academic Year', render: (r) => <b>{r.label}</b>, search: (r) => r.label },
          {
            header: 'Status',
            render: (r) =>
              r.isActive ? (
                <span className="badge bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">ACTIVE</span>
              ) : (
                <span className="text-muted">Archived</span>
              ),
            search: (r) => (r.isActive ? 'active' : 'archived'),
          },
        ],
        fields: () => [
          { key: 'label', label: 'Label', type: 'text', required: true, placeholder: 'e.g. 2026-27' },
          { key: 'isActive', label: 'Active', type: 'checkbox', placeholder: 'This is the current academic year' },
        ],
        emptyValues: () => ({ label: '', isActive: false }),
        toFormValues: (r) => ({ ...r }),
      }}
    />
  );
}
