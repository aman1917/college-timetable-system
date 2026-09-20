'use client';

export function ExportButtons({
  kind,
  id,
  label,
}: {
  kind: 'class' | 'teacher' | 'room' | 'master';
  id: string;
  label: string;
}) {
  const query = `kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
  return (
    <>
      <a className="btn-ghost" href={`/api/export/pdf?${query}`} title={`Download ${label} as PDF`}>
        📄 PDF
      </a>
      <a className="btn-ghost" href={`/api/export/excel?${query}`} title={`Download ${label} as Excel`}>
        📊 Excel
      </a>
      <button className="btn-ghost" onClick={() => window.print()}>
        🖨 Print
      </button>
    </>
  );
}
