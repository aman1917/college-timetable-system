'use client';

import { ReportTable } from '../ReportTable';

export default function AllotmentReportPage() {
  return (
    <ReportTable
      title="📈 Work Allotment Report"
      subtitle="Teacher-wise subject allotment with weekly hours."
      endpoint="/api/reports/allotment"
    />
  );
}
