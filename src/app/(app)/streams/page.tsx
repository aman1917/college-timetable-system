'use client';

import { ResourcePage } from '@/components/ResourcePage';

interface Stream { id: string; name: string; code: string; yearStructure: string; displayOrder: number }

export default function StreamsPage() {
  return (
    <ResourcePage<Stream>
      config={{
        title: '🎓 Streams',
        subtitle: 'Stream names are free text and fully configurable — e.g. "BSC / BCOM".',
        endpoint: '/api/streams',
        noun: 'Stream',
        columns: [
          { header: 'Stream', render: (r) => <b>{r.name}</b>, search: (r) => r.name },
          { header: 'Code', render: (r) => r.code, search: (r) => r.code },
          {
            header: 'Year Structure',
            render: (r) => (r.yearStructure === 'LLB_FIVE_YEAR' ? 'Year 1 – Year 5' : 'FY / SY / TY'),
            search: (r) => r.yearStructure,
          },
          { header: 'Order', render: (r) => r.displayOrder, search: (r) => String(r.displayOrder) },
        ],
        fields: () => [
          { key: 'name', label: 'Stream Name', type: 'text', required: true, placeholder: 'e.g. BSC / BCOM' },
          { key: 'code', label: 'Short Code', type: 'text', required: true, placeholder: 'e.g. BSCIT' },
          {
            key: 'yearStructure', label: 'Year Structure', type: 'select', required: true,
            options: [
              { value: 'UG_THREE_YEAR', label: 'FY / SY / TY (3-year UG)' },
              { value: 'LLB_FIVE_YEAR', label: 'Year 1 – Year 5 (5-year LLB)' },
            ],
          },
          { key: 'displayOrder', label: 'Display Order', type: 'number' },
        ],
        emptyValues: () => ({ name: '', code: '', yearStructure: 'UG_THREE_YEAR', displayOrder: 0 }),
        toFormValues: (r) => ({ ...r }),
      }}
    />
  );
}
