'use client';

import { ReportTable } from '../ReportTable';

export default function WorkloadReportPage() {
  return (
    <ReportTable
      title="📈 Faculty Workload Report"
      subtitle="Theory and practical load per teacher, against their configured weekly limit."
      endpoint="/api/reports/workload"
    />
  );
}
