import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
        <h1 className="text-lg font-semibold text-center mb-6 text-ivory">Create Account</h1>

        {error && <div className="alert alert-error mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              required
              minLength={3}
              maxLength={32}
              className="input"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="input"
              placeholder="Min 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full mt-1" disabled={loading}>
            {loading ? 'Loading...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-stone">
          Already have an account?{' '}
          <Link to="/login" className="text-accent no-underline hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
