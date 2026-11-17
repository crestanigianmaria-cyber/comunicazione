import React, { useState } from 'react';
import {
  Building2,
  Lock,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  ShieldCheck,
  Warehouse,
  Eye,
  EyeOff,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';
import { UserRole } from '../../types';
import { signInRole } from '../../services/db';

interface LoginModalProps {
  onLoginSuccess: (role: UserRole) => void;
  defaultRole?: UserRole;
  onCancel?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onLoginSuccess,
  defaultRole = 'magazzino',
  onCancel,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    setShowPassword(false);
    setError(null);
  };

  return (
    <div className="min-h-dvh bg-[#0b0f19] wms-grid-bg flex flex-col items-center px-4 py-6 pt-safe pb-safe overflow-y-auto select-none">
      {/* Corporate Saggin Accent Strip */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-red-600 z-50" />

      <div className="w-full max-w-[460px] my-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-800/50 animate-wms-slide-up">
        {/* Industrial Header */}
        <div className="bg-[#0f172a] px-6 py-5 sm:py-6 text-white border-b border-slate-800">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mb-4 -ml-1.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 transition touch-manipulation min-h-[36px]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Torna alla postazione attiva</span>
            </button>
          )}

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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-600 text-white">
                  DAL 1957
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  WMS · GESTIONALE
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white mt-1.5 leading-tight truncate">
                SAGGIN GUGLIELMO S.R.L.
              </h1>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                Materiali Edili &amp; Ferramenta · Nove · Marostica
              </p>
            </div>
          </div>
        </div>

        {/* Form Area */}
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Postazione Operativa
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {selectedRole === 'magazzino' ? 'TOUCH / TABLET' : 'DESKTOP UFFICIO'}
            </span>
          </div>

          {/* Role Cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleRoleSelect('magazzino')}
              aria-pressed={selectedRole === 'magazzino'}
              className={`min-h-[84px] p-3.5 sm:p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] touch-manipulation ${
                selectedRole === 'magazzino'
                  ? 'border-red-600 bg-red-50/50 shadow-xs ring-2 ring-red-600/10'
                  : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                    selectedRole === 'magazzino'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Warehouse className="w-5 h-5" />
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full transition ${
                    selectedRole === 'magazzino'
                      ? 'bg-red-600 ring-4 ring-red-600/15'
                      : 'bg-slate-300'
                  }`}
                />
              </div>
              <div className="font-extrabold text-sm text-slate-900">Magazzino</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">
                Piazzale · Mobile &amp; PC
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('ufficio')}
              aria-pressed={selectedRole === 'ufficio'}
              className={`min-h-[84px] p-3.5 sm:p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] touch-manipulation ${
                selectedRole === 'ufficio'
                  ? 'border-slate-900 bg-slate-900/[0.04] shadow-xs ring-2 ring-slate-900/10'
                  : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                    selectedRole === 'ufficio'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full transition ${
                    selectedRole === 'ufficio'
                      ? 'bg-slate-900 ring-4 ring-slate-900/15'
                      : 'bg-slate-300'
                  }`}
                />
              </div>
              <div className="font-extrabold text-sm text-slate-900">Ufficio</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">
                Amministrazione · PC
              </div>
            </button>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="saggin-login-password"
                className="block text-xs font-extrabold text-slate-700 mb-1.5"
              >
                {selectedRole === 'magazzino'
                  ? 'PIN / Password Operatore Magazzino'
                  : 'Password Amministrazione Ufficio'}
              </label>
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="saggin-login-password"
                  type={showPassword ? 'text' : 'password'}
                  inputMode="text"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  spellCheck={false}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={
                    selectedRole === 'magazzino'
                      ? 'Inserisci codice o password magazzino...'
                      : 'Inserisci password ufficio...'
                  }
                  required
                  autoFocus
                  className="w-full h-13 pl-11 pr-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm sm:text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900 transition placeholder:text-slate-400 placeholder:font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center justify-center min-w-[46px] text-slate-400 hover:text-slate-700 touch-manipulation"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className={`w-full h-13 disabled:opacity-45 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition touch-manipulation ${
                selectedRole === 'magazzino'
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                  : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'
              }`}
            >
              <span>
                {isLoading
                  ? 'Verifica in corso...'
                  : `Accedi a ${selectedRole === 'magazzino' ? 'Magazzino' : 'Ufficio'}`}
              </span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>

          {/* Integrated Suite Switcher -> Saggin Planning */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Suite Aziendale Saggin
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400">
                <CalendarRange className="w-3 h-3 text-red-500" />
                <span>Ufficio &amp; Viaggi</span>
              </span>
            </div>

            <a
              href="https://sagginplanning.vercel.app"
              className="group w-full min-h-[62px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-[#0f172a] hover:border-[#0f172a] active:scale-[0.99] transition-all flex items-center justify-between gap-3 touch-manipulation shadow-2xs hover:shadow-md"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-9 rounded-lg bg-white border border-slate-200 group-hover:border-slate-700 flex items-center justify-center p-1.5 shrink-0 shadow-2xs">
                  <img
                    src="/saggin-logo.png"
                    alt="Saggin Planning"
                    className="w-full h-full object-contain"
                    width="48"
                    height="36"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-white transition-colors truncate">
                      Saggin Planning
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 group-hover:bg-red-600 group-hover:text-white text-[9px] font-mono font-black uppercase tracking-wider transition-colors shrink-0">
                      PLANNING
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 group-hover:text-slate-300 transition-colors truncate mt-0.5">
                    Vai a sagginplanning.vercel.app
                  </p>
                </div>
              </div>

              <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 group-hover:bg-red-600 group-hover:border-red-600 text-slate-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </div>
            </a>
          </div>

          {/* Footer info */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Sincronizzazione Cloud Supabase
            </span>
            <span className="font-mono text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">
              WMS v3.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
