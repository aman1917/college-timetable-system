'use client';

import { ReportTable } from '../ReportTable';

export default function AllocationReportPage() {
  return (
    <ReportTable
      title="📈 Subject Allocation Report"
      subtitle="Every subject–teacher–class allocation and how much of it is scheduled."
      endpoint="/api/reports/allocation"
    />
  );
}
