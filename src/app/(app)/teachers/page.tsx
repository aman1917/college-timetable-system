'use client';

import { ResourcePage } from '@/components/ResourcePage';
import { WEEKDAYS, WEEKDAY_LABEL, type Weekday } from '@/lib/domain';

interface Availability { day: Weekday; startTime: string; endTime: string }
interface Teacher {
  id: string; teacherCode: string; name: string; email: string | null; mobile: string | null;
  designation: string | null; qualification: string | null; employmentType: 'FULL_TIME' | 'PART_TIME';
  joiningDate: string | null; status: string; maxWeeklyLectures: number; maxDailyLectures: number;
  notes: string | null; availability: Availability[];
}

function AvailabilityEditor({
  values,
  setValue,
}: {
  values: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
}) {
  const rows = (values.availability as Availability[]) ?? [];
  const partTime = values.employmentType === 'PART_TIME';

  function toggle(day: Weekday, on: boolean) {
    const next = on
      ? [...rows, { day, startTime: '09:00', endTime: '17:00' }]
      : rows.filter((r) => r.day !== day);
    setValue('availability', next);
  }

  function update(day: Weekday, field: 'startTime' | 'endTime', value: string) {
    setValue('availability', rows.map((r) => (r.day === day ? { ...r, [field]: value } : r)));
  }

  return (
    <div className="mt-2 border-t border-line pt-3">
      <div className="label">Availability</div>
      <p className="mb-2 text-xs text-muted">
        {partTime
          ? 'Required for part-time staff. The scheduler will never place a lecture outside these windows.'
          : 'Leave every day unticked to default to all working days at college hours.'}
      </p>
      <div className="space-y-1.5">
        {WEEKDAYS.map((day) => {
          const row = rows.find((r) => r.day === day);
          return (
            <div key={day} className="flex flex-wrap items-center gap-2">
              <label className="flex w-28 items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(row)} onChange={(e) => toggle(day, e.target.checked)} />
                {WEEKDAY_LABEL[day]}
              </label>
              {row && (
                <>
                  <input
                    type="time" className="field w-32" value={row.startTime}
                    onChange={(e) => update(day, 'startTime', e.target.value)}
                  />
                  <span className="text-xs text-muted">to</span>
                  <input
                    type="time" className="field w-32" value={row.endTime}
                    onChange={(e) => update(day, 'endTime', e.target.value)}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TeachersPage() {
  return (
    <ResourcePage<Teacher>
      config={{
        title: '👩‍🏫 Teachers',
        subtitle: 'Teachers must exist here before any subject can be allocated to them.',
        endpoint: '/api/teachers',
        noun: 'Teacher',
        columns: [
          { header: 'ID', render: (r) => r.teacherCode, search: (r) => r.teacherCode },
          { header: 'Name', render: (r) => <b>{r.name}</b>, search: (r) => r.name },
          {
            header: 'Type',
            render: (r) =>
              r.employmentType === 'PART_TIME' ? (
                <span className="badge bg-amber-500/15 text-amber-600 dark:text-amber-400">Part-Time</span>
              ) : (
                <span className="badge bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Full-Time</span>
              ),
            search: (r) => r.employmentType,
          },
          { header: 'Designation', render: (r) => r.designation ?? '—', search: (r) => r.designation ?? '' },
          { header: 'Email', render: (r) => r.email ?? '—', search: (r) => r.email ?? '' },
          {
            header: 'Limits',
            render: (r) => `${r.maxDailyLectures}/day · ${r.maxWeeklyLectures}/week`,
            search: (r) => String(r.maxWeeklyLectures),
          },
          { header: 'Status', render: (r) => r.status, search: (r) => r.status },
        ],
        fields: () => [
          { key: 'teacherCode', label: 'Teacher ID', type: 'text', required: true, placeholder: 'e.g. T-001' },
          { key: 'name', label: 'Full Name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'mobile', label: 'Mobile Number', type: 'text' },
          { key: 'designation', label: 'Designation', type: 'text', placeholder: 'e.g. Assistant Professor' },
          { key: 'qualification', label: 'Qualification', type: 'text' },
          {
            key: 'employmentType', label: 'Employment Type', type: 'select', required: true,
            options: [
              { value: 'FULL_TIME', label: 'Full-Time' },
              { value: 'PART_TIME', label: 'Part-Time' },
            ],
          },
          { key: 'joiningDate', label: 'Joining Date', type: 'date' },
          { key: 'maxWeeklyLectures', label: 'Max Weekly Periods', type: 'number', required: true },
          { key: 'maxDailyLectures', label: 'Max Daily Periods', type: 'number', required: true },
          {
            key: 'status', label: 'Status', type: 'select',
            options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }],
          },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        renderExtra: (values, setValue) => <AvailabilityEditor values={values} setValue={setValue} />,
        emptyValues: () => ({
          teacherCode: '', name: '', email: '', mobile: '', designation: '', qualification: '',
          employmentType: 'FULL_TIME', joiningDate: '', status: 'ACTIVE',
          maxWeeklyLectures: 20, maxDailyLectures: 5, notes: '', availability: [],
        }),
        toFormValues: (r) => ({
          teacherCode: r.teacherCode, name: r.name, email: r.email ?? '', mobile: r.mobile ?? '',
          designation: r.designation ?? '', qualification: r.qualification ?? '',
          employmentType: r.employmentType,
          joiningDate: r.joiningDate ? String(r.joiningDate).slice(0, 10) : '',
          status: r.status, maxWeeklyLectures: r.maxWeeklyLectures, maxDailyLectures: r.maxDailyLectures,
          notes: r.notes ?? '', availability: r.availability ?? [],
        }),
        toPayload: (v) => ({ ...v, email: v.email === '' ? null : v.email }),
      }}
    />
  );
}
