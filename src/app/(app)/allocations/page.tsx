'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResourcePage } from '@/components/ResourcePage';
import { get } from '@/lib/client';

interface Teacher {
  id: string;
  name: string;
  employmentType: string;
  status: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  weeklyLectures: number;
  durationMinutes: number;
  roomType: string | null;
}

interface Klass {
  id: string;
  year: string;
  division: string;
  semester: number;
  stream: {
    code: string;
  };
}

interface Room {
  id: string;
  name: string;
  type: string;
}

interface CommonGroup {
  id: string;
  name: string;
  code: string;
}

interface Allocation {
  id: string;
  teacherId: string;
  subjectId: string;
  classId: string;
  roomId: string | null;
  weeklyLectures: number;
  durationMinutes: number;
  status: string;

  commonGroupId: string | null;
  isCommon: boolean;

  teacher?: Teacher;
  subject?: Subject;
  class?: Klass;
  room?: Room;
  commonGroup?: CommonGroup;

  entries?: {
    groupId: string;
  }[];
}

const label = (c?: Klass) =>
  c
    ? `${c.year} ${c.stream?.code ?? ''} ${c.division} (Sem ${c.semester})`
    : '—';

export default function AllocationsPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [commonGroups, setCommonGroups] = useState<CommonGroup[]>([]);

  useEffect(() => {
    void get<Teacher[]>('/api/teachers')
      .then(setTeachers)
      .catch(() => { });

    void get<Subject[]>('/api/subjects')
      .then(setSubjects)
      .catch(() => { });

    void get<Klass[]>('/api/classes')
      .then(setClasses)
      .catch(() => { });

    void get<Room[]>('/api/rooms')
      .then(setRooms)
      .catch(() => { });

    void get<CommonGroup[]>('/api/common-groups')
      .then(setCommonGroups)
      .catch(() => { });
  }, []);

  const classOptions = useMemo(
    () =>
      classes.map((c) => ({
        value: c.id,
        label: label(c),
      })),
    [classes],
  );

  return (
    <ResourcePage<Allocation>
      config={{
        title: '🔗 Subject Allocation',

        subtitle:
          'Assign a teacher, subject and class. Common groups allow the same lecture to be shared by multiple classes.',

        endpoint: '/api/allocations',

        noun: 'Allocation',

        columns: [
          {
            header: 'Teacher',
            render: (r) => <b>{r.teacher?.name ?? '—'}</b>,
            search: (r) => r.teacher?.name ?? '',
          },

          {
            header: 'Subject',
            render: (r) =>
              r.subject
                ? `${r.subject.code} — ${r.subject.name}`
                : '—',
            search: (r) =>
              `${r.subject?.code ?? ''} ${r.subject?.name ?? ''}`,
          },

          {
            header: 'Class',
            render: (r) => label(r.class),
            search: (r) => label(r.class),
          },

          {
            header: 'Common',
            render: (r) =>
              r.isCommon ? (
                <span className="text-blue-600 dark:text-blue-400">
                  ✓ {r.commonGroup?.code ?? 'Common'}
                </span>
              ) : (
                '—'
              ),
            search: (r) =>
              r.isCommon
                ? `${r.commonGroup?.code ?? ''} common`
                : '',
          },

          {
            header: 'Scheduled',
            render: (r) => {
              const placed = new Set(
                (r.entries ?? []).map((e) => e.groupId),
              ).size;

              const done = placed >= r.weeklyLectures;

              return (
                <span
                  className={
                    done
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }
                >
                  {placed}/{r.weeklyLectures} {done ? '✓' : '⚠'}
                </span>
              );
            },
            search: (r) => String(r.weeklyLectures),
          },

          {
            header: 'Duration',
            render: (r) => `${r.durationMinutes} min`,
            search: () => '',
          },

          {
            header: 'Room',
            render: (r) => r.room?.name ?? '—',
            search: (r) => r.room?.name ?? '',
          },

          {
            header: 'Status',
            render: (r) => r.status,
            search: (r) => r.status,
          },
        ],

        fields: ({ values }) => {
          const subject = subjects.find(
            (s) => s.id === values.subjectId,
          );

          const usableRooms = subject?.roomType
            ? rooms.filter(
              (r) => r.type === subject.roomType,
            )
            : rooms;

          return [
            {
              key: 'teacherId',
              label: 'Teacher',
              type: 'select',
              required: true,

              options: teachers
                .filter((t) => t.status === 'ACTIVE')
                .map((t) => ({
                  value: t.id,
                  label: `${t.name}${t.employmentType === 'PART_TIME'
                      ? ' (Part-Time)'
                      : ''
                    }`,
                })),
            },

            {
              key: 'subjectId',
              label: 'Subject',
              type: 'select',
              required: true,

              options: subjects
                .filter((s) => s.status === 'ACTIVE')
                .map((s) => ({
                  value: s.id,
                  label: `${s.code} — ${s.name}`,
                })),

              help: subject
                ? `Curriculum default: ${subject.weeklyLectures} lecture(s)/week, ${subject.durationMinutes} min${subject.roomType
                  ? `, needs a ${subject.roomType.toLowerCase()}`
                  : ''
                }.`
                : undefined,
            },

            {
              key: 'classId',
              label: 'Class / Division',
              type: 'select',
              required: true,

              options: classOptions,
            },

            {
              key: 'weeklyLectures',
              label: 'Weekly Lectures',
              type: 'number',
              required: true,
            },

            {
              key: 'durationMinutes',
              label: 'Lecture Duration (minutes)',
              type: 'number',
              required: true,
            },

            {
              key: 'roomId',
              label: 'Room',
              type: 'select',

              options: usableRooms.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.type.toLowerCase()})`,
              })),

              help: subject?.roomType
                ? `Filtered to ${subject.roomType.toLowerCase()}s.`
                : undefined,
            },

            {
              key: 'isCommon',
              label: 'Common Lecture?',
              type: 'select',
              required: true,

              // options: [
              //   {
              //     value: false,
              //     label: 'No — Normal Class Lecture',
              //   },
              //   {
              //     value: true,
              //     label: 'Yes — Common Lecture',
              //   },
              // ],
              options: [
                {
                  value: 'false',
                  label: 'No — Normal Class Lecture',
                },
                {
                  value: 'true',
                  label: 'Yes — Common Lecture',
                },
              ],
              help:
                'Choose Yes when multiple classes attend the same lecture together.',
            },

            {
              key: 'commonGroupId',
              label: 'Common Group',
              type: 'select',

              options: [
                {
                  value: '',
                  label: 'No Common Group',
                },

                ...commonGroups.map((group) => ({
                  value: group.id,
                  label: `${group.code} — ${group.name}`,
                })),
              ],

              help:
                'Select the same Common Group for all classes participating in one shared lecture.',
            },

            {
              key: 'status',
              label: 'Status',
              type: 'select',

              options: [
                {
                  value: 'ACTIVE',
                  label: 'Active',
                },
                {
                  value: 'INACTIVE',
                  label: 'Inactive',
                },
              ],
            },
          ];
        },

        emptyValues: () => ({
          teacherId: '',
          subjectId: '',
          classId: '',
          roomId: '',

          weeklyLectures: 3,
          durationMinutes: 50,

          isCommon: false,
          commonGroupId: '',

          status: 'ACTIVE',
        }),

        toFormValues: (r) => ({
          teacherId: r.teacherId,
          subjectId: r.subjectId,
          classId: r.classId,
          roomId: r.roomId ?? '',

          weeklyLectures: r.weeklyLectures,
          durationMinutes: r.durationMinutes,

          isCommon: r.isCommon,
          commonGroupId: r.commonGroupId ?? '',

          status: r.status,
        }),

        toPayload: (v) => ({
          ...v,

          roomId:
            v.roomId === ''
              ? null
              : v.roomId,

          commonGroupId:
            v.commonGroupId === ''
              ? null
              : v.commonGroupId,

          isCommon:
            v.isCommon === true ||
            v.isCommon === 'true',
        }),
      }}
    />
  );
}