import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';

export default function Setup() {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSuccess('Success! You are now a developer. Redirecting...');
      localStorage.removeItem('user');
      setTimeout(() => window.location.href = '/admin', 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-[radial-gradient(ellipse_at_center,_rgba(242,239,232,0.04)_0%,_transparent_70%)]">
      <div className="w-full max-w-sm text-center mb-10">
        <Link to="/" className="text-ivory font-bold text-2xl no-underline">Onyx</Link>
      </div>

      <div className="w-full max-w-sm glass-card p-10">
        <h1 className="text-lg font-semibold text-center mb-2 text-ivory">Developer Setup</h1>
        <p className="text-sm text-stone text-center mb-6">
          One-time setup. Only works if no developer exists yet.
        </p>

        {error && <div className="alert alert-error mb-4">{error}</div>}
        {success && <div className="alert alert-success mb-4">{success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="secret">Secret Key</label>
            <input
              id="secret"
              type="password"
              required
              className="input"
              placeholder="Enter setup key"
              value={secret}
              onChange={e => setSecret(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full mt-1" disabled={loading}>
            {loading ? 'Loading...' : 'Make Me Developer'}
          </button>
        </form>

        <p className="text-center mt-5">
          <Link to="/dashboard" className="text-accent text-sm no-underline hover:underline">Back to Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
