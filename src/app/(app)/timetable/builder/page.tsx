import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import BuilderClient from './BuilderClient';

export const dynamic = 'force-dynamic';

export default async function BuilderPage() {
  const session = await getSession();
  // The builder mutates the master timetable, so it is admin-only.
  if (session?.role !== 'ADMIN') redirect('/timetable/class');
  return <BuilderClient />;
}
