import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import { DownloadSimple, ArrowClockwise, Image, Trash, WarningCircle } from '@phosphor-icons/react';

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const hasSub = user?.sub_until ? new Date(user.sub_until) > new Date() : false;
  const isPrivileged = user?.role === 'admin' || user?.role === 'developer' || user?.role === 'media';
  const canDownload = hasSub || isPrivileged;

  useEffect(() => {
    loadIcon();
  }, []);

  async function loadIcon() {
    try {
      const data = await api.get<{ icon: string | null; mime_type?: string }>('/icon/get');
      if (data.icon) {
        setIconUrl(`data:${data.mime_type};base64,${data.icon}`);
      }
    } catch {}
  }

  async function handleIconUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/gif';
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (file.size > 256 * 1024) {
        setError('File too large (max 256KB).');
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          await api.post('/icon/upload', { icon_data: base64, mime_type: file.type });
          setSuccess('Icon uploaded!');
          loadIcon();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Upload failed');
        }
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  }

  async function handleIconDelete() {
    try {
      await api.del('/icon/delete');
      setIconUrl(null);
      setSuccess('Icon removed.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const blob = await api.downloadJar();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'appleskin.jar';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  async function handleResetHwid() {
    const pwd = prompt('Enter your password to reset HWID:');
    if (!pwd) return;
    try {
      await api.post('/user/reset-hwid', { password: pwd });
      setSuccess('HWID reset. Re-activate with your license key.');
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    }
  }

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
        <h2 className="card-header">Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div><span className="text-stone">Username</span><br /><span className="text-ivory">{user?.username ?? '-'}</span></div>
          <div>
            <span className="text-stone">Role</span><br />
            <span className={`badge badge-${user?.role ?? 'user'}`}>{user?.role ?? '-'}</span>
          </div>
          <div><span className="text-stone">Email</span><br /><span className="text-ivory">{user?.email ?? '-'}</span></div>
          <div>
            <span className="text-stone">Subscription</span><br />
            <span className="text-ivory">
              {hasSub
                ? `Active until ${new Date(user!.sub_until!).toLocaleDateString()}`
                : 'No active subscription'}
            </span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-stone">HWID</span><br />
            <span className="font-mono text-xs text-stone">{user?.hwid ?? 'Not set'}</span>
          </div>
          <div><span className="text-stone">Registered</span><br /><span className="text-ivory">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</span></div>
        </div>
      </div>

      <div className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <h2 className="card-header">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={handleDownload} disabled={!canDownload || downloading}>
            <DownloadSimple size={16} />
            {downloading ? 'Downloading...' : 'Download JAR'}
          </button>
          {(user?.role === 'admin' || user?.role === 'developer') && (
            <button className="btn btn-danger" onClick={handleResetHwid}>
              <ArrowClockwise size={16} />
              Reset HWID
            </button>
          )}
        </div>
        {!canDownload && (
          <p className="text-xs text-danger mt-3">
            <WarningCircle size={12} className="inline mr-1" />
            You need an active subscription to download.
          </p>
        )}
      </div>

      <div className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <h2 className="card-header">Your Icon</h2>
        <p className="text-sm text-stone mb-4">
          Upload an icon that will be displayed on your player in-game.
        </p>
        {iconUrl && (
          <div className="mb-4">
            <img src={iconUrl} alt="Current icon" className="size-16 rounded-lg object-cover border-2 border-[rgba(245,241,235,0.1)] bg-onyx" />
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-outline btn-sm" onClick={handleIconUpload}>
            <Image size={14} />
            {iconUrl ? 'Change' : 'Choose File'}
          </button>
          {iconUrl && (
            <button className="btn btn-danger btn-sm" onClick={handleIconDelete}>
              <Trash size={14} />
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
