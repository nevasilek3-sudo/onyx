import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Gear, SignOut } from '@phosphor-icons/react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isLanding = location.pathname === '/';

  if (isLanding) return <>{children}</>;

  const isAuth = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/setup';
  if (isAuth) return <>{children}</>;

  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="px-6 pt-6 sticky top-0 z-50 max-w-5xl mx-auto w-full">
        <div className="glass-header px-8 h-16 flex items-center justify-between">
          <Link to="/" className="text-ivory font-bold text-lg tracking-tight no-underline">
            Onyx
          </Link>
          <nav className="flex items-center gap-2">
            {user && (
              <span className="text-sm text-stone mr-1">{user.username}</span>
            )}
            {isAdmin && (
              <Link to="/admin" className="btn btn-ghost btn-sm">
                <Gear size={14} />
                Admin
              </Link>
            )}
            <button onClick={logout} className="btn btn-outline btn-sm">
              <SignOut size={14} />
              Logout
            </button>
          </nav>
        </div>
      </div>
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
