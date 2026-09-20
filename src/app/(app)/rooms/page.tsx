'use client';

import { ResourcePage } from '@/components/ResourcePage';

interface Room { id: string; name: string; type: string; capacity: number; building: string | null; status: string }

const TYPE_LABEL: Record<string, string> = { CLASSROOM: 'Classroom', LAB: 'Laboratory', SEMINAR: 'Seminar Hall' };

export default function RoomsPage() {
  return (
    <ResourcePage<Room>
      config={{
        title: '🚪 Rooms',
        subtitle: 'Room type matters: a practical subject can only be allocated a laboratory.',
        endpoint: '/api/rooms',
        noun: 'Room',
        columns: [
          { header: 'Room', render: (r) => <b>{r.name}</b>, search: (r) => r.name },
          { header: 'Type', render: (r) => TYPE_LABEL[r.type] ?? r.type, search: (r) => r.type },
          { header: 'Capacity', render: (r) => r.capacity, search: (r) => String(r.capacity) },
          { header: 'Building', render: (r) => r.building ?? '—', search: (r) => r.building ?? '' },
          { header: 'Status', render: (r) => r.status, search: (r) => r.status },
        ],
        fields: () => [
          { key: 'name', label: 'Room Name', type: 'text', required: true, placeholder: 'e.g. Room 201' },
          {
            key: 'type', label: 'Room Type', type: 'select', required: true,
            options: [
              { value: 'CLASSROOM', label: 'Classroom' },
              { value: 'LAB', label: 'Laboratory' },
              { value: 'SEMINAR', label: 'Seminar Hall' },
            ],
          },
          { key: 'capacity', label: 'Capacity', type: 'number' },
          { key: 'building', label: 'Building', type: 'text' },
          {
            key: 'status', label: 'Status', type: 'select',
            options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }],
          },
        ],
        emptyValues: () => ({ name: '', type: 'CLASSROOM', capacity: 60, building: '', status: 'ACTIVE' }),
        toFormValues: (r) => ({ ...r, building: r.building ?? '' }),
      }}
    />
  );
}
