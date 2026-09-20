'use client';

import { useEffect, useState } from 'react';
import { ResourcePage } from '@/components/ResourcePage';
import { get } from '@/lib/client';

interface Stream { id: string; name: string; code: string; yearStructure: string }
interface AcademicYear { id: string; label: string }
interface Klass {
  id: string; year: string; semester: number; division: string; strength: number | null;
  streamId: string; academicYearId: string;
  stream: Stream; academicYear: AcademicYear;
}

export default function ClassesPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);

  useEffect(() => {
    void get<Stream[]>('/api/streams').then(setStreams).catch(() => {});
    void get<AcademicYear[]>('/api/academic-years').then(setYears).catch(() => {});
  }, []);

  return (
    <ResourcePage<Klass>
      config={{
        title: '🏫 Classes & Divisions',
        subtitle: 'A class is a stream + year + semester + division. Subjects are allocated to these.',
        endpoint: '/api/classes',
        noun: 'Class',
        columns: [
          {
            header: 'Class',
            render: (r) => <b>{`${r.year} ${r.stream?.code ?? ''} ${r.division}`}</b>,
            search: (r) => `${r.year} ${r.stream?.code ?? ''} ${r.division}`,
          },
          { header: 'Stream', render: (r) => r.stream?.name ?? '—', search: (r) => r.stream?.name ?? '' },
          { header: 'Semester', render: (r) => r.semester, search: (r) => String(r.semester) },
          { header: 'Academic Year', render: (r) => r.academicYear?.label ?? '—', search: (r) => r.academicYear?.label ?? '' },
          { header: 'Strength', render: (r) => r.strength ?? '—', search: (r) => String(r.strength ?? '') },
        ],
        fields: ({ values }) => {
          const stream = streams.find((s) => s.id === values.streamId);
          // Year options follow the stream's structure, so an LLB class can never
          // be given "FY" and a BSc class can never be given "Year 4".
          const yearOptions =
            stream?.yearStructure === 'LLB_FIVE_YEAR'
              ? ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5']
              : ['FY', 'SY', 'TY'];

          return [
            {
              key: 'streamId', label: 'Stream', type: 'select', required: true,
              options: streams.map((s) => ({ value: s.id, label: s.name })),
            },
            {
              key: 'year', label: 'Year', type: 'select', required: true,
              options: yearOptions.map((y) => ({ value: y, label: y })),
              help: stream ? undefined : 'Choose a stream first.',
            },
            { key: 'semester', label: 'Semester', type: 'number', required: true },
            { key: 'division', label: 'Division', type: 'text', required: true, placeholder: 'e.g. A' },
            {
              key: 'academicYearId', label: 'Academic Year', type: 'select', required: true,
              options: years.map((y) => ({ value: y.id, label: y.label })),
            },
            { key: 'strength', label: 'Class Strength', type: 'number' },
          ];
        },
        emptyValues: () => ({ streamId: '', year: '', semester: 1, division: 'A', academicYearId: '', strength: '' }),
        toFormValues: (r) => ({
          streamId: r.streamId, year: r.year, semester: r.semester,
          division: r.division, academicYearId: r.academicYearId, strength: r.strength ?? '',
        }),
        toPayload: (v) => ({ ...v, strength: v.strength === '' ? null : v.strength }),
      }}
    />
  );
}
