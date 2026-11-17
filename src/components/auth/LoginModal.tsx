import React, { useState } from 'react';
import { Smartphone, Building2, Lock, ArrowRight, ShieldCheck, Warehouse } from 'lucide-react';
import { UserRole } from '../../types';
import { signInRole } from '../../services/db';

interface LoginModalProps {
  onLoginSuccess: (role: UserRole) => void;
  defaultRole?: UserRole;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, defaultRole = 'magazzino' }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signInRole(selectedRole, password);
      onLoginSuccess(selectedRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accesso non riuscito. Verifica le credenziali.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setPassword('');
    setError(null);
  };

  return (
    <div className="min-h-dvh bg-[#0b0f19] flex flex-col items-center px-4 py-6 pt-safe pb-safe overflow-y-auto select-none">
      {/* Subtle top corporate bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-red-600 z-50" />

      <div className="w-full max-w-[440px] my-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-800/40">
        {/* Corporate Identity Header */}
        <div className="bg-[#0f172a] px-6 py-6 text-white border-b border-slate-800 relative">
          <div className="flex items-center gap-4">
            <div className="w-20 h-14 bg-white rounded-xl flex items-center justify-center p-2 shadow-md shrink-0 border border-slate-200">
              <img
                src="/saggin-logo.png"
                alt="Saggin Guglielmo S.R.L."
                className="w-full h-full object-contain"
                width="80"
                height="56"
                fetchPriority="high"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-600 text-white">
                  DAL 1957
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  ERP · WMS
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white mt-1 truncate">
                SAGGIN GUGLIELMO S.R.L.
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Materiali Edili & Ferramenta · Nove · Marostica
              </p>
            </div>
          </div>
        </div>

        {/* Role Selection & Credentials */}
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Seleziona Postazione Operativa
            </label>
            <span className="text-[10px] font-mono text-slate-400">
              {selectedRole === 'magazzino' ? 'TOUCH / TABLET' : 'DESKTOP PC'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleRoleSelect('magazzino')}
              className={`p-4 rounded-xl border-2 text-left transition-all touch-manipulation ${
                selectedRole === 'magazzino'
                  ? 'border-red-600 bg-red-50/40 shadow-xs'
                  : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  selectedRole === 'magazzino' ? 'bg-red-600 text-white' : 'bg-slate-200/80 text-slate-600'
                }`}>
                  <Warehouse className="w-5 h-5" />
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  selectedRole === 'magazzino' ? 'bg-red-600 ring-4 ring-red-600/15' : 'bg-slate-300'
                }`} />
              </div>
              <div className="font-extrabold text-sm text-slate-900">Magazzino</div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                Piazzale · Mobile & Tablet
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('ufficio')}
              className={`p-4 rounded-xl border-2 text-left transition-all touch-manipulation ${
                selectedRole === 'ufficio'
                  ? 'border-slate-900 bg-slate-900/[0.03] shadow-xs'
                  : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  selectedRole === 'ufficio' ? 'bg-slate-900 text-white' : 'bg-slate-200/80 text-slate-600'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  selectedRole === 'ufficio' ? 'bg-slate-900 ring-4 ring-slate-900/15' : 'bg-slate-300'
                }`} />
              </div>
              <div className="font-extrabold text-sm text-slate-900">Ufficio</div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                Amministrazione · PC
              </div>
            </button>
          </div>

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {selectedRole === 'magazzino'
                  ? 'Codice / Password Operatore Magazzino'
                  : 'Password Amministrazione Ufficio'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  inputMode="text"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={selectedRole === 'magazzino' ? 'Inserisci credenziale magazzino...' : 'Inserisci password ufficio...'}
                  required
                  autoFocus
                  className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className={`w-full h-12 disabled:opacity-45 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition touch-manipulation ${
                selectedRole === 'magazzino'
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-600/15'
                  : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/15'
              }`}
            >
              <span>{isLoading ? 'Autenticazione in corso...' : `Accedi a ${selectedRole === 'magazzino' ? 'Magazzino' : 'Ufficio'}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer info */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Sincronizzazione Cloud Supabase
            </span>
            <span className="font-mono text-[10px]">v2.4 ERP</span>
          </div>
        </div>
      </div>
    </div>
  );
};

