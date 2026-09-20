'use client';

import { ResourcePage } from '@/components/ResourcePage';

interface TimeSlot {
  id: string; startTime: string; endTime: string;
  type: 'LECTURE' | 'BREAK' | 'LUNCH'; isActive: boolean; displayOrder: number;
}

export default function TimeSlotsPage() {
  return (
    <ResourcePage<TimeSlot>
      config={{
        title: '⏰ Time Slots',
        subtitle:
          'Break and lunch slots can never hold a lecture, and they split the day into runs — a 100-minute practical cannot straddle one.',
        endpoint: '/api/time-slots',
        noun: 'Time Slot',
        columns: [
          { header: 'Start', render: (r) => r.startTime, search: (r) => r.startTime },
          { header: 'End', render: (r) => r.endTime, search: (r) => r.endTime },
          {
            header: 'Type',
            render: (r) =>
              r.type === 'LECTURE' ? (
                'Lecture'
              ) : (
                <span className="text-amber-600 dark:text-amber-400">{r.type}</span>
              ),
            search: (r) => r.type,
          },
          { header: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No'), search: (r) => String(r.isActive) },
          { header: 'Order', render: (r) => r.displayOrder, search: (r) => String(r.displayOrder) },
        ],
        fields: () => [
          { key: 'startTime', label: 'Start Time', type: 'time', required: true },
          { key: 'endTime', label: 'End Time', type: 'time', required: true },
          {
            key: 'type', label: 'Slot Type', type: 'select', required: true,
            options: [
              { value: 'LECTURE', label: 'Lecture' },
              { value: 'BREAK', label: 'Break' },
              { value: 'LUNCH', label: 'Lunch' },
            ],
          },
          { key: 'displayOrder', label: 'Display Order', type: 'number', help: 'Slots are ordered by this, then by start time.' },
          { key: 'isActive', label: 'Active', type: 'checkbox', placeholder: 'Available for scheduling' },
        ],
        emptyValues: () => ({ startTime: '09:00', endTime: '09:50', type: 'LECTURE', isActive: true, displayOrder: 0 }),
        toFormValues: (r) => ({ ...r }),
      }}
    />
  );
}
