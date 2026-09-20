import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  if (await getSession()) redirect('/dashboard');

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-2xl">
            🎓
          </div>
          <h1 className="text-xl font-bold">CampusGrid</h1>
          <p className="text-sm text-muted">College Timetable Management System</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
