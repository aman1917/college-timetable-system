'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { post } from '@/lib/client';

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/api/auth/login', { email, password });
      router.push(params.get('next') || '/dashboard');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel p-5" onSubmit={submit}>
      <label className="label" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        className="field mb-3"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="admin@college.edu"
      />

      <label className="label" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        className="field mb-4"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button className="btn-brand w-full justify-center" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="mt-4 text-center text-xs text-muted">
        Seeded accounts are printed by <code>npm run db:seed</code>.
      </p>
    </form>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<div className="panel p-5 text-sm text-muted">Loading…</div>}>
      <Form />
    </Suspense>
  );
}
