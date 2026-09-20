'use client';

import { useEffect, useState } from 'react';
import { get, put } from '@/lib/client';
import { PageHeader, Spinner, useToast } from '@/components/ui';
import { WEEKDAYS, WEEKDAY_LABEL, type Weekday } from '@/lib/domain';

interface Settings {
  collegeName: string;
  defaultDuration: number;
  workingDays: Weekday[];
  fullTimeStart: string;
  fullTimeEnd: string;
  timetableStatus: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    void get<Settings>('/api/settings')
      .then(setSettings)
      .catch((e) => toast((e as Error).message, 'error'));
  }, [toast]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await put('/api/settings', settings);
      toast('Settings saved.');
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <Spinner />;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings({ ...settings, [key]: value });

  return (
    <>
      <PageHeader
        title="⚙️ Settings"
        subtitle="College-wide configuration. Changing working days affects what the scheduler considers legal."
        actions={
          <button className="btn-brand" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        }
      />

      <div className="panel max-w-2xl p-5">
        <label className="label" htmlFor="collegeName">
          College Name
        </label>
        <input
          id="collegeName"
          className="field mb-4"
          value={settings.collegeName}
          onChange={(e) => set('collegeName', e.target.value)}
        />

        <div className="label">Working Days</div>
        <div className="mb-4 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => {
            const on = settings.workingDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() =>
                  set(
                    'workingDays',
                    on ? settings.workingDays.filter((d) => d !== day) : [...settings.workingDays, day],
                  )
                }
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  on ? 'border-brand bg-brand text-white' : 'border-line hover:bg-brand/10'
                }`}
              >
                {WEEKDAY_LABEL[day]}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="start">
              College Start Time
            </label>
            <input
              id="start"
              type="time"
              className="field"
              value={settings.fullTimeStart}
              onChange={(e) => set('fullTimeStart', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="end">
              College End Time
            </label>
            <input
              id="end"
              type="time"
              className="field"
              value={settings.fullTimeEnd}
              onChange={(e) => set('fullTimeEnd', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="duration">
              Default Lecture Duration (minutes)
            </label>
            <input
              id="duration"
              type="number"
              className="field"
              value={settings.defaultDuration}
              onChange={(e) => set('defaultDuration', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="status">
              Timetable Status
            </label>
            <select
              id="status"
              className="field"
              value={settings.timetableStatus}
              onChange={(e) => set('timetableStatus', e.target.value)}
            >
              <option value="DRAFT">Draft</option>
              <option value="REVIEW">Under Review</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <p className="mt-1 text-xs text-muted">
              Publishing from the builder runs full validation first. Setting it here bypasses that check, so
              prefer the builder&rsquo;s Publish button.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
