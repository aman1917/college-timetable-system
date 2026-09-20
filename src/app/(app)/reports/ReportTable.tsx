'use client';

import { useEffect, useMemo, useState } from 'react';
import { get } from '@/lib/client';
import { PageHeader, Spinner, useToast } from '@/components/ui';

interface ReportData {
  headers: string[];
  rows: string[][];
}

export function ReportTable({
  title,
  subtitle,
  endpoint,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
}) {
  const [data, setData] = useState<ReportData | null>(null);
  const [query, setQuery] = useState('');
  const toast = useToast();

  useEffect(() => {
    void get<ReportData>(endpoint)
      .then(setData)
      .catch((e) => toast((e as Error).message, 'error'));
  }, [endpoint, toast]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter((r) => r.join(' ').toLowerCase().includes(q));
  }, [data, query]);

  function downloadCsv() {
    if (!data) return;
    // Quote every field and double internal quotes — teacher names and subject
    // titles routinely contain commas.
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [data.headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <input
              className="field w-56"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn-ghost" onClick={downloadCsv} disabled={!data}>
              ⬇ CSV
            </button>
            <button className="btn-ghost" onClick={() => window.print()}>
              🖨 Print
            </button>
          </>
        }
      />
      {!data ? (
        <Spinner />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table-simple">
            <thead>
              <tr>
                {data.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-brand/5">
                  {r.map((cell, j) => (
                    <td key={j} className={cell === 'OVERLOADED' ? 'font-bold text-red-600 dark:text-red-400' : ''}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
