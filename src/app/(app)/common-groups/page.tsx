'use client';

import { useEffect, useState } from 'react';
import { ResourcePage } from '@/components/ResourcePage';

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface Teacher {
  id: string;
  teacherCode: string;
  name: string;
}

interface Stream {
  id: string;
  code: string;
  name: string;
}

interface AcademicYear {
  id: string;
  label: string;
}

interface Klass {
  id: string;
  year: string;
  semester: number;
  division: string;
  stream: Stream;
  academicYear: AcademicYear;
}

interface Room {
  id: string;
  name: string;
}

interface Allocation {
  id: string;
  subject: Subject;
  teacher: Teacher;
  class: Klass;
  room: Room | null;
  weeklyLectures: number;
  durationMinutes: number;
}

interface CommonGroup {
  id: string;
  name: string;
  code: string;
  allocations: Allocation[];
}

/* -------------------------------------------------------
   Multiple Class Selection
------------------------------------------------------- */

function ClassMultiSelect({
  classes,
  values,
  setValue,
}: {
  classes: Klass[];
  values: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
}) {
  const selected = Array.isArray(values.classIds)
    ? (values.classIds as string[])
    : [];

  function toggle(classId: string) {
    const next = selected.includes(classId)
      ? selected.filter((id) => id !== classId)
      : [...selected, classId];

    setValue('classIds', next);
  }

  return (
    <div className="mt-2">
      <div className="label">
        Participating Classes <span className="text-red-500">*</span>
      </div>

      <p className="mb-2 text-xs text-muted">
        Select at least 2 classes that will attend this lecture together.
      </p>

      <div
        className={`max-h-64 space-y-1.5 overflow-y-auto rounded-lg border p-3 ${
          selected.length < 2
            ? 'border-red-500/50'
            : 'border-line'
        }`}
      >
        {classes.length === 0 ? (
          <p className="text-sm text-muted">
            No classes available.
          </p>
        ) : (
          classes.map((klass) => (
            <label
              key={klass.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={selected.includes(klass.id)}
                onChange={() => toggle(klass.id)}
              />

              <span className="text-sm">
                {klass.year}{' '}
                {klass.stream?.code ?? ''}{' '}
                {klass.division}
                {' — '}
                Sem {klass.semester}
                {' — '}
                {klass.academicYear?.label ?? ''}
              </span>
            </label>
          ))
        )}
      </div>

      {selected.length < 2 ? (
        <p className="mt-1 text-xs text-red-500">
          Select at least 2 classes for a Common Group.
        </p>
      ) : (
        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
          {selected.length} classes selected.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   Main Page
------------------------------------------------------- */

export default function CommonGroupsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  /* -----------------------------------------------------
     Load Subjects / Teachers / Classes / Rooms
  ----------------------------------------------------- */

  useEffect(() => {
    async function loadData() {
      try {
        const [
          subjectsResponse,
          teachersResponse,
          classesResponse,
          roomsResponse,
        ] = await Promise.all([
          fetch('/api/subjects'),
          fetch('/api/teachers'),
          fetch('/api/classes'),
          fetch('/api/rooms'),
        ]);

        if (!subjectsResponse.ok) {
          throw new Error('Failed to load subjects.');
        }

        if (!teachersResponse.ok) {
          throw new Error('Failed to load teachers.');
        }

        if (!classesResponse.ok) {
          throw new Error('Failed to load classes.');
        }

        if (!roomsResponse.ok) {
          throw new Error('Failed to load rooms.');
        }

        const [
          subjectsData,
          teachersData,
          classesData,
          roomsData,
        ] = await Promise.all([
          subjectsResponse.json(),
          teachersResponse.json(),
          classesResponse.json(),
          roomsResponse.json(),
        ]);

        setSubjects(
          Array.isArray(subjectsData)
            ? subjectsData
            : subjectsData.data ?? [],
        );

        setTeachers(
          Array.isArray(teachersData)
            ? teachersData
            : teachersData.data ?? [],
        );

        setClasses(
          Array.isArray(classesData)
            ? classesData
            : classesData.data ?? [],
        );

        setRooms(
          Array.isArray(roomsData)
            ? roomsData
            : roomsData.data ?? [],
        );
      } catch (error) {
        console.error(
          'Failed to load Common Group data:',
          error,
        );
      }
    }

    loadData();
  }, []);

  /* -----------------------------------------------------
     Page
  ----------------------------------------------------- */

  return (
    <ResourcePage<CommonGroup>
      config={{
        title: '🔗 Common Groups',

        subtitle:
          'Create one lecture shared by multiple classes or streams.',

        endpoint: '/api/common-groups',

        noun: 'Common Group',

        /* -------------------------------------------------
           Table Columns
        ------------------------------------------------- */

        columns: [
          {
            header: 'Name',

            render: (r) => <b>{r.name}</b>,

            search: (r) => r.name,
          },

          {
            header: 'Code',

            render: (r) => r.code,

            search: (r) => r.code,
          },

          {
            header: 'Subject',

            render: (r) => {
              const allocation = r.allocations[0];

              if (!allocation) {
                return '—';
              }

              return `${allocation.subject.code} — ${allocation.subject.name}`;
            },

            search: (r) => {
              const allocation = r.allocations[0];

              if (!allocation) {
                return '';
              }

              return `${allocation.subject.code} ${allocation.subject.name}`;
            },
          },

          {
            header: 'Teacher',

            render: (r) =>
              r.allocations[0]?.teacher?.name ?? '—',

            search: (r) =>
              r.allocations[0]?.teacher?.name ?? '',
          },

          {
            header: 'Classes',

            render: (r) => {
              if (r.allocations.length === 0) {
                return '—';
              }

              return r.allocations
                .map(
                  (allocation) =>
                    `${allocation.class.year} ${
                      allocation.class.stream?.code ?? ''
                    } ${
                      allocation.class.division
                    } (Sem ${
                      allocation.class.semester
                    })`,
                )
                .join(', ');
            },

            search: (r) =>
              r.allocations
                .map(
                  (allocation) =>
                    `${allocation.class.year} ${
                      allocation.class.stream?.code ?? ''
                    } ${
                      allocation.class.division
                    } Sem ${
                      allocation.class.semester
                    }`,
                )
                .join(' '),
          },

          {
            header: 'Room',

            render: (r) => {
              const room = r.allocations[0]?.room;

              if (!room) {
                return 'No Room';
              }

              /*
               * Room model uses `name`.
               * Do not use room.code here because
               * the Room model does not contain that field.
               */
              return room.name;
            },

            search: (r) =>
              r.allocations[0]?.room?.name ?? '',
          },

          {
            header: 'Weekly',

            render: (r) => {
              const allocation = r.allocations[0];

              if (!allocation) {
                return '—';
              }

              return `${allocation.weeklyLectures}/week`;
            },

            search: (r) => {
              const allocation = r.allocations[0];

              return allocation
                ? String(allocation.weeklyLectures)
                : '';
            },
          },

          {
            header: 'Duration',

            render: (r) => {
              const allocation = r.allocations[0];

              if (!allocation) {
                return '—';
              }

              return `${allocation.durationMinutes} min`;
            },

            search: (r) => {
              const allocation = r.allocations[0];

              return allocation
                ? String(allocation.durationMinutes)
                : '';
            },
          },
        ],

        /* -------------------------------------------------
           Form Fields
        ------------------------------------------------- */

        fields: () => [
          {
            key: 'name',

            label: 'Common Group Name',

            type: 'text',

            required: true,

            placeholder:
              'e.g. FY BCOM + FY BCOMMS Business Communication',
          },

          {
            key: 'code',

            label: 'Common Group Code',

            type: 'text',

            required: true,

            placeholder:
              'e.g. FYBCOM-BCOMMS-BC',
          },

          {
            key: 'subjectId',

            label: 'Subject',

            type: 'select',

            required: true,

            options: subjects.map((subject) => ({
              value: subject.id,
              label: `${subject.code} — ${subject.name}`,
            })),
          },

          {
            key: 'teacherId',

            label: 'Teacher',

            type: 'select',

            required: true,

            options: teachers.map((teacher) => ({
              value: teacher.id,
              label: `${teacher.teacherCode} — ${teacher.name}`,
            })),
          },

          {
            key: 'roomId',

            label: 'Room',

            type: 'select',

            options: [
              {
                value: '',
                label: 'No Room / Normal Classroom',
              },

              ...rooms.map((room) => ({
                value: room.id,
                label: room.name,
              })),
            ],
          },

          {
            key: 'weeklyLectures',

            label: 'Weekly Lectures',

            type: 'number',

            required: true,
          },

          {
            key: 'durationMinutes',

            label: 'Duration (minutes)',

            type: 'number',

            required: true,
          },
        ],

        /* -------------------------------------------------
           Extra Section: Multiple Classes
        ------------------------------------------------- */

        renderExtra: (values, setValue) => (
          <ClassMultiSelect
            classes={classes}
            values={values}
            setValue={setValue}
          />
        ),

        /* -------------------------------------------------
           Default Form Values
        ------------------------------------------------- */

        emptyValues: () => ({
          name: '',
          code: '',
          subjectId: '',
          teacherId: '',
          classIds: [],
          roomId: '',
          weeklyLectures: 2,
          durationMinutes: 50,
        }),

        /* -------------------------------------------------
           Existing Record → Form
        ------------------------------------------------- */

        toFormValues: (r) => ({
          name: r.name,

          code: r.code,

          subjectId:
            r.allocations[0]?.subject?.id ?? '',

          teacherId:
            r.allocations[0]?.teacher?.id ?? '',

          classIds:
            r.allocations.map(
              (allocation) => allocation.class.id,
            ),

          roomId:
            r.allocations[0]?.room?.id ?? '',

          weeklyLectures:
            r.allocations[0]?.weeklyLectures ?? 2,

          durationMinutes:
            r.allocations[0]?.durationMinutes ?? 50,
        }),

        /* -------------------------------------------------
           Form → API Payload + Validation
        ------------------------------------------------- */

        toPayload: (v) => {
          const name = String(v.name ?? '').trim();

          const code = String(v.code ?? '').trim();

          const subjectId = String(
            v.subjectId ?? '',
          );

          const teacherId = String(
            v.teacherId ?? '',
          );

          const classIds = Array.isArray(v.classIds)
            ? (v.classIds as string[]).filter(Boolean)
            : [];

          const roomId = v.roomId
            ? String(v.roomId)
            : null;

          const weeklyLectures = Number(
            v.weeklyLectures ?? 0,
          );

          const durationMinutes = Number(
            v.durationMinutes ?? 0,
          );

          /* -----------------------------------------------
             Required Validation
          ------------------------------------------------ */

          if (!name) {
            throw new Error(
              'Common Group Name is required.',
            );
          }

          if (!code) {
            throw new Error(
              'Common Group Code is required.',
            );
          }

          if (!subjectId) {
            throw new Error(
              'Please select a Subject.',
            );
          }

          if (!teacherId) {
            throw new Error(
              'Please select a Teacher.',
            );
          }

          if (classIds.length < 2) {
            throw new Error(
              'Please select at least 2 classes for a Common Group.',
            );
          }

          if (
            !Number.isInteger(weeklyLectures) ||
            weeklyLectures < 1 ||
            weeklyLectures > 20
          ) {
            throw new Error(
              'Weekly Lectures must be between 1 and 20.',
            );
          }

          if (
            !Number.isInteger(durationMinutes) ||
            durationMinutes < 20 ||
            durationMinutes > 300
          ) {
            throw new Error(
              'Duration must be between 20 and 300 minutes.',
            );
          }

          /* -----------------------------------------------
             Final API Payload
          ------------------------------------------------ */

          return {
            name,
            code,
            subjectId,
            teacherId,
            classIds,
            roomId,
            weeklyLectures,
            durationMinutes,
          };
        },
      }}
    />
  );
}