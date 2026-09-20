import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: 200 });

  return (
    <>
      <PageHeader
        title="🕘 Audit History"
        subtitle="Who changed what, most recent first. Showing the latest 200 entries."
      />
      {logs.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted">No activity recorded yet.</div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table-simple">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap text-xs text-muted">
                    {new Date(log.at).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap">{log.userLabel}</td>
                  <td>
                    <span className="badge bg-brand/15 text-brand">{log.action}</span>
                  </td>
                  <td className="text-xs text-muted">{log.entity}</td>
                  <td>{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
