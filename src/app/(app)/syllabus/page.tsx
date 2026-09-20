'use client';

import { useEffect, useState } from 'react';
import { ResourcePage } from '@/components/ResourcePage';
import { get } from '@/lib/client';

interface Subject { id: string; code: string; name: string }
interface Syllabus {
  id: string; subjectId: string; subject?: Subject;
  unit1: string | null; unit2: string | null; unit3: string | null;
  unit4: string | null; unit5: string | null; estimatedLectures: number | null;
}

export default function SyllabusPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  useEffect(() => {
    void get<Subject[]>('/api/subjects').then(setSubjects).catch(() => {});
  }, []);

  return (
    <ResourcePage<Syllabus>
      config={{
        title: '📖 Syllabus',
        subtitle: 'Unit-wise syllabus per subject. The estimated lecture count helps sanity-check the weekly requirement.',
        endpoint: '/api/syllabus',
        noun: 'Syllabus',
        columns: [
          {
            header: 'Subject',
            render: (r) => <b>{r.subject ? `${r.subject.code} — ${r.subject.name}` : '—'}</b>,
            search: (r) => `${r.subject?.code ?? ''} ${r.subject?.name ?? ''}`,
          },
          {
            header: 'Units filled',
            render: (r) => [r.unit1, r.unit2, r.unit3, r.unit4, r.unit5].filter(Boolean).length + ' / 5',
            search: () => '',
          },
          { header: 'Est. Lectures', render: (r) => r.estimatedLectures ?? '—', search: () => '' },
        ],
        fields: () => [
          {
            key: 'subjectId', label: 'Subject', type: 'select', required: true,
            options: subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })),
          },
          { key: 'estimatedLectures', label: 'Estimated Lectures', type: 'number' },
          { key: 'unit1', label: 'Unit 1', type: 'textarea' },
          { key: 'unit2', label: 'Unit 2', type: 'textarea' },
          { key: 'unit3', label: 'Unit 3', type: 'textarea' },
          { key: 'unit4', label: 'Unit 4', type: 'textarea' },
          { key: 'unit5', label: 'Unit 5', type: 'textarea' },
        ],
        emptyValues: () => ({
          subjectId: '', unit1: '', unit2: '', unit3: '', unit4: '', unit5: '', estimatedLectures: '',
        }),
        toFormValues: (r) => ({
          subjectId: r.subjectId,
          unit1: r.unit1 ?? '', unit2: r.unit2 ?? '', unit3: r.unit3 ?? '',
          unit4: r.unit4 ?? '', unit5: r.unit5 ?? '',
          estimatedLectures: r.estimatedLectures ?? '',
        }),
        toPayload: (v) => ({ ...v, estimatedLectures: v.estimatedLectures === '' ? null : v.estimatedLectures }),
      }}
    />
  );
}
