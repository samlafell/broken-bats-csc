import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Lock, AlertCircle } from 'lucide-react';

interface LoginGateProps {
  minRole: 'player' | 'admin';
  children: React.ReactNode;
}

export default function LoginGate({ minRole, children }: LoginGateProps) {
  // #region agent log
  fetch('http://127.0.0.1:7613/ingest/5b90fa54-6c67-43c2-9e12-8404ec8a797f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'890096'},body:JSON.stringify({sessionId:'890096',location:'LoginGate.tsx:render',message:'LoginGate rendering',data:{minRole,lockType:typeof Lock,alertCircleType:typeof AlertCircle,useAuthType:typeof useAuth},timestamp:Date.now(),hypothesisId:'H1-H4'})}).catch(()=>{});
  // #endregion
  const { isAuthenticated, isAdmin, isPlayer, login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasAccess =
    isAuthenticated && (minRole === 'player' ? isPlayer : isAdmin);

  if (hasAccess) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(password, minRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {minRole === 'admin' ? "Manager's Office" : 'Clubhouse'}
            </h2>
            <p className="text-stone-400 text-sm mt-2">
              {minRole === 'admin'
                ? 'Enter the manager password to continue.'
                : 'Enter the team password to continue.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              autoFocus
            />

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white font-bold rounded-xl uppercase tracking-widest transition-colors"
            >
              {loading ? 'Checking...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
