'use client';

import { useEffect, useState } from 'react';
import { ResourcePage } from '@/components/ResourcePage';
import { get } from '@/lib/client';
import { suggestColor } from '@/lib/colors';

interface Stream { id: string; name: string; yearStructure: string }
interface Subject {
  id: string; code: string; name: string; streamId: string; year: string; semester: number;
  type: string; credits: number; weeklyLectures: number; durationMinutes: number;
  roomType: string | null; color: string; status: string; stream?: Stream;
}

export default function SubjectsPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  useEffect(() => {
    void get<Stream[]>('/api/streams').then(setStreams).catch(() => {});
  }, []);

  return (
    <ResourcePage<Subject>
      config={{
        title: '📘 Subject Master',
        subtitle:
          'Subjects are created here first. They only reach a timetable through a Subject Allocation — never by being typed into a cell.',
        endpoint: '/api/subjects',
        noun: 'Subject',
        columns: [
          {
            header: '',
            render: (r) => (
              <span className="inline-block h-3.5 w-3.5 rounded" style={{ background: r.color }} />
            ),
            search: () => '',
          },
          { header: 'Code', render: (r) => <b>{r.code}</b>, search: (r) => r.code },
          { header: 'Subject', render: (r) => r.name, search: (r) => r.name },
          { header: 'Stream', render: (r) => r.stream?.name ?? '—', search: (r) => r.stream?.name ?? '' },
          { header: 'Year', render: (r) => `${r.year} · Sem ${r.semester}`, search: (r) => r.year },
          { header: 'Type', render: (r) => r.type, search: (r) => r.type },
          {
            header: 'Weekly',
            render: (r) => `${r.weeklyLectures} × ${r.durationMinutes}m`,
            search: (r) => String(r.weeklyLectures),
          },
        ],
        fields: ({ values }) => {
          const stream = streams.find((s) => s.id === values.streamId);
          const yearOptions =
            stream?.yearStructure === 'LLB_FIVE_YEAR'
              ? ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5']
              : ['FY', 'SY', 'TY'];

          return [
            { key: 'code', label: 'Subject Code', type: 'text', required: true, placeholder: 'e.g. BSCIT301' },
            { key: 'name', label: 'Subject Name', type: 'text', required: true },
            {
              key: 'streamId', label: 'Stream', type: 'select', required: true,
              options: streams.map((s) => ({ value: s.id, label: s.name })),
            },
            {
              key: 'year', label: 'Year', type: 'select', required: true,
              options: yearOptions.map((y) => ({ value: y, label: y })),
            },
            { key: 'semester', label: 'Semester', type: 'number', required: true },
            {
              key: 'type', label: 'Subject Type', type: 'select', required: true,
              options: [
                { value: 'THEORY', label: 'Theory' },
                { value: 'PRACTICAL', label: 'Practical' },
                { value: 'TUTORIAL', label: 'Tutorial' },
                { value: 'ELECTIVE', label: 'Elective' },
                { value: 'SPECIAL', label: 'Special Lecture' },
              ],
            },
            { key: 'credits', label: 'Credits', type: 'number' },
            { key: 'weeklyLectures', label: 'Weekly Lecture Requirement', type: 'number', required: true },
            {
              key: 'durationMinutes', label: 'Lecture Duration (minutes)', type: 'number', required: true,
              help: 'A duration spanning two grid periods (e.g. 100) books two consecutive slots.',
            },
            {
              key: 'roomType', label: 'Room Requirement', type: 'select',
              options: [
                { value: '', label: 'No specific requirement' },
                { value: 'CLASSROOM', label: 'Classroom' },
                { value: 'LAB', label: 'Laboratory' },
                { value: 'SEMINAR', label: 'Seminar Hall' },
              ],
            },
            {
              key: 'color', label: 'Subject Colour', type: 'color',
              help: 'Used in every view, the PDF and the Excel export.',
            },
            {
              key: 'status', label: 'Status', type: 'select',
              options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }],
            },
          ];
        },
        emptyValues: () => ({
          code: '', name: '', streamId: '', year: '', semester: 1, type: 'THEORY',
          credits: 3, weeklyLectures: 3, durationMinutes: 50, roomType: 'CLASSROOM',
          color: suggestColor(String(Math.random())), status: 'ACTIVE',
        }),
        toFormValues: (r) => ({ ...r, roomType: r.roomType ?? '' }),
        toPayload: (v) => ({ ...v, roomType: v.roomType === '' ? null : v.roomType }),
      }}
    />
  );
}
