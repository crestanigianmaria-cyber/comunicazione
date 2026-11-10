import React, { useState } from 'react';
import { Smartphone, Building2, Lock, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
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
      setError(err instanceof Error ? err.message : 'Accesso non riuscito. Riprova.');
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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-8 select-none">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header Banner */}
        <div className="bg-slate-950 p-6 text-white text-center border-b border-slate-800">
          <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-3 shadow-lg shadow-blue-500/25">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Magazzino Edile WMS</h1>
          <p className="text-xs text-slate-400 mt-1">
            Seleziona la tua postazione per accedere al sistema
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="p-6">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Ruolo di Accesso
          </label>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleRoleSelect('magazzino')}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedRole === 'magazzino'
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Smartphone className={`w-5 h-5 ${selectedRole === 'magazzino' ? 'text-blue-600' : 'text-slate-500'}`} />
                {selectedRole === 'magazzino' && (
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                )}
              </div>
              <div className="font-bold text-sm text-slate-900">Magazzino</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Operatori Smartphone</div>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('ufficio')}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedRole === 'ufficio'
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Building2 className={`w-5 h-5 ${selectedRole === 'ufficio' ? 'text-blue-600' : 'text-slate-500'}`} />
                {selectedRole === 'ufficio' && (
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                )}
              </div>
              <div className="font-bold text-sm text-slate-900">Ufficio</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Dashboard Computer</div>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {selectedRole === 'magazzino' ? 'Password Magazzino' : 'Password Amministrativa Ufficio'}
                </label>

              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={selectedRole === 'magazzino' ? 'password' : 'password'}
                  inputMode="text"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={selectedRole === 'magazzino' ? 'Inserisci password Magazzino' : 'Inserisci password ufficio'}
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 flex items-start gap-2">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-[0.98] transition"
            >
              <span>{isLoading ? 'Verifica in corso...' : 'Entra nel Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Security note */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Credenziali modificabili dal pannello Impostazioni Ufficio</span>
          </div>
        </div>
      </div>
    </div>
  );
};
