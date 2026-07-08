import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import type { Stats, AdminUser, JarInfo } from '../lib/types';
import { Users, Key, ChartBar, ArrowUp, Upload, Copy, MagnifyingGlass, Funnel } from '@phosphor-icons/react';

export default function Admin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [jarInfo, setJarInfo] = useState<JarInfo | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [keyCount, setKeyCount] = useState(10);
  const [keyDuration, setKeyDuration] = useState(30);
  const [keysOutput, setKeysOutput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
    loadJarInfo();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [page, search, roleFilter]);

  async function loadStats() {
    try {
      const d = await api.get<Stats>('/admin/stats');
      setStats(d);
    } catch {}
  }

  async function loadUsers() {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const d = await api.get<{ users: AdminUser[]; total: number; limit: number }>('/admin/users?' + params);
      setUsers(d.users);
      setTotalUsers(d.total);
    } catch {}
  }

  async function loadJarInfo() {
    try {
      const info = await api.getJarInfo();
      setJarInfo(info);
    } catch {}
  }

  async function handleGenerateKeys() {
    setLoading(true);
    try {
      const d = await api.post<{ keys: string[] }>('/admin/generate-keys', { count: keyCount, duration_days: keyDuration });
      setKeysOutput(d.keys.join('\n'));
      setSuccess('Generated ' + d.keys.length + ' keys.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadJar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jar';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await api.uploadJar(file);
        setSuccess('JAR uploaded!');
        loadJarInfo();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    };
    input.click();
  }

  async function handleUserAction(id: string) {
    const action = prompt(
      'Actions:\n1 - Give sub\n2 - Revoke sub\n3 - Change role\n4 - Reset HWID\nEnter number:'
    );
    if (!action) return;
    try {
      if (action === '1') {
        const days = prompt('Duration in days:');
        if (!days) return;
        await api.post(`/admin/users/${id}/give-sub`, { duration_days: parseInt(days) });
        setSuccess('Subscription given.');
      } else if (action === '2') {
        await api.post(`/admin/users/${id}/revoke-sub`);
        setSuccess('Subscription revoked.');
      } else if (action === '3') {
        const role = prompt('Enter role (any custom name, e.g. vip, mod, tester):');
        if (!role) return;
        await api.post(`/admin/users/${id}/change-role`, { role: role.trim() });
        setSuccess('Role changed.');
      } else if (action === '4') {
        await api.post(`/admin/users/${id}/reset-hwid`);
        setSuccess('HWID reset.');
      }
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  async function handleToggleBan(id: string) {
    try {
      await api.post(`/admin/users/${id}/ban`);
      setSuccess('Done.');
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  const totalPages = Math.ceil(totalUsers / 20);

  return (
    <div className="flex flex-col gap-5">
      {error && <div className="alert alert-error">{error}
        <button onClick={() => setError('')} className="float-right text-xs opacity-60 hover:opacity-100">✕</button>
      </div>}
      {success && <div className="alert alert-success">{success}
        <button onClick={() => setSuccess('')} className="float-right text-xs opacity-60 hover:opacity-100">✕</button>
      </div>}

      <div className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <h2 className="card-header">Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: stats?.total_users ?? '-', icon: Users },
            { label: 'Active Subs', value: stats?.active_subs ?? '-', icon: Key },
            { label: 'Keys Used', value: stats?.total_keys_used ?? '-', icon: ChartBar },
            { label: 'New Today', value: stats?.users_today ?? '-', icon: ArrowUp },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center gap-2 p-5 rounded-xl bg-[rgba(245,241,235,0.03)] border border-[rgba(245,241,235,0.06)]">
              <div className="size-9 rounded-lg bg-accent-soft flex items-center justify-center">
                <s.icon size={16} className="text-accent" />
              </div>
              <span className="text-2xl font-bold text-accent">{s.value}</span>
              <span className="text-xs text-stone">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <h2 className="card-header">JAR Management</h2>
        <p className="text-sm text-stone mb-4">Upload a new JAR file for users to download.</p>
        {jarInfo && (
          <p className="text-xs text-stone mb-4 font-mono">
            {jarInfo.exists
              ? `Current: ${(jarInfo.size! / 1024 / 1024).toFixed(1)} MB`
              : 'No JAR uploaded yet.'}
          </p>
        )}
        <button className="btn btn-outline btn-sm" onClick={handleUploadJar}>
          <Upload size={14} />
          Upload JAR
        </button>
      </div>

      <div className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <h2 className="card-header">Generate License Keys</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Count</label>
            <input type="number" className="input w-24" value={keyCount} min={1} max={1000}
              onChange={e => setKeyCount(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <label className="label">Duration (days)</label>
            <input type="number" className="input w-28" value={keyDuration} min={1} max={3650}
              onChange={e => setKeyDuration(parseInt(e.target.value) || 30)} />
          </div>
          <button className="btn btn-success" onClick={handleGenerateKeys} disabled={loading}>
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {keysOutput && (
          <div className="mt-4">
            <textarea
              readOnly
              className="input font-mono text-xs h-30 resize-none"
              value={keysOutput}
            />
            <button className="btn btn-outline btn-sm mt-2" onClick={() => {
              navigator.clipboard.writeText(keysOutput);
              setSuccess('Copied!');
            }}>
              <Copy size={14} />
              Copy All
            </button>
          </div>
        )}
      </div>

      <div className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <h2 className="card-header">Users</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-40">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone" />
            <input
              className="input pl-9"
              placeholder="Search by username or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-auto min-w-32" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="prem-user">Prem-User</option>
            <option value="media">Media</option>
            <option value="admin">Admin</option>
            <option value="developer">Developer</option>
          </select>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-stone text-xs uppercase tracking-wider border-b border-[rgba(245,241,235,0.06)]">
                <th className="text-left py-3 pr-4 font-medium">Username</th>
                <th className="text-left py-3 pr-4 font-medium">Email</th>
                <th className="text-left py-3 pr-4 font-medium">Role</th>
                <th className="text-left py-3 pr-4 font-medium">HWID</th>
                <th className="text-left py-3 pr-4 font-medium">Created</th>
                <th className="text-left py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-[rgba(245,241,235,0.04)] hover:bg-[rgba(245,241,235,0.02)] transition-colors">
                  <td className="py-3 pr-4 text-ivory">{u.username}</td>
                  <td className="py-3 pr-4 text-stone text-xs">{u.email}</td>
                  <td className="py-3 pr-4"><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                  <td className="py-3 pr-4 font-mono text-xs text-stone">
                    {u.hwid ? u.hwid.substring(0, 16) + '...' : '-'}
                  </td>
                  <td className="py-3 pr-4 text-stone text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-3 flex gap-2">
                    <button className="btn btn-outline btn-sm" onClick={() => handleUserAction(u.id)}>Manage</button>
                    <button
                      className={`btn btn-sm ${u.banned ? 'btn-success' : 'btn-danger'}`}
                      onClick={() => handleToggleBan(u.id)}
                    >
                      {u.banned ? 'Unban' : 'Ban'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-stone text-sm">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-5">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
