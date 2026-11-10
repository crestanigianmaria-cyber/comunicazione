import React, { useState } from 'react';
import {
  Save,
  Database,
  Building,
  Key,
  Globe,
  Check,
  Copy,
  ExternalLink,
  ShieldAlert,
  Server,
  FileCode,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { CompanySettings, SupabaseConfig } from '../../types';
import { saveCompanySettings, changeRolePassword } from '../../services/db';
import { getStoredSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../../lib/supabase';

interface SettingsModalProps {
  initialSettings: CompanySettings;
  onSettingsSaved: (newSettings: CompanySettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  initialSettings,
  onSettingsSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'company' | 'supabase' | 'sql' | 'passwords' | 'ionos'>('company');

  // Company settings
  const [settings, setSettings] = useState<CompanySettings>(initialSettings);
  const [companySavedNotice, setCompanySavedNotice] = useState(false);

  // Supabase settings
  const [supabaseUrl, setSupabaseUrl] = useState(() => getStoredSupabaseConfig().url);
  const [supabaseKey, setSupabaseKey] = useState(() => getStoredSupabaseConfig().anonKey);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Passwords
  const [magazzinoPin, setMagazzinoPin] = useState('');
  const [ufficioPass, setUfficioPass] = useState('');
  const [passNotice, setPassNotice] = useState<string | null>(null);

  // SQL Copy notice
  const [sqlCopied, setSqlCopied] = useState(false);

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    saveCompanySettings(settings);
    onSettingsSaved(settings);
    setCompanySavedNotice(true);
    setTimeout(() => setCompanySavedNotice(false), 2500);
  };

  const handleSaveSupabase = async () => {
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setIsTesting(true);
    setTestResult(null);

    const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
    setIsTesting(false);
    if (res.success) {
      setTestResult({ success: true, message: 'Connessione a Supabase stabilita con successo!' });
    } else {
      setTestResult({ success: false, message: res.error || 'Errore di connessione a Supabase' });
    }
  };

  const handleSavePasswords = (e: React.FormEvent) => {
    e.preventDefault();
    if (magazzinoPin.trim()) {
      changeRolePassword('magazzino', magazzinoPin.trim());
    }
    if (ufficioPass.trim()) {
      changeRolePassword('ufficio', ufficioPass.trim());
    }
    setPassNotice('Password aggiornate correttamente.');
    setMagazzinoPin('');
    setUfficioPass('');
    setTimeout(() => setPassNotice(null), 3000);
  };

  const handleCopySQL = () => {
    const sqlCode = `-- SQL SCHEMA PER SUPABASE
-- Tabella products, orders, order_items, trigger ORD-%06d e RLS
-- Consultabile nel file supabase_schema.sql nella root del progetto.`;
    navigator.clipboard.writeText(sqlCode);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 px-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('company')}
          className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'company'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Dati Aziendali & Intestazione PDF</span>
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'supabase'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Configurazione Supabase</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'sql'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Script SQL Database</span>
        </button>

        <button
          onClick={() => setActiveTab('passwords')}
          className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'passwords'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Gestione Password & PIN</span>
        </button>

        <button
          onClick={() => setActiveTab('ionos')}
          className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'ionos'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Guida IONOS & Pubblicazione</span>
        </button>
      </div>

      {/* Tab 1: Company Profile */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveCompany} className="p-6 space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome Azienda (Intestazione Principale)
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ragione Sociale Completa
              </label>
              <input
                type="text"
                value={settings.legalName}
                onChange={(e) => setSettings({ ...settings, legalName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Indirizzo Sede / Magazzino
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Partita IVA / Codice Fiscale
              </label>
              <input
                type="text"
                value={settings.vatNumber}
                onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Telefono Ufficio / Magazzino
              </label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Note a piè di pagina per la Stampa PDF
            </label>
            <textarea
              rows={2}
              value={settings.notes}
              onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Save className="w-4 h-4" />
              <span>Salva Dati Aziendali</span>
            </button>
            {companySavedNotice && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Salvato!
              </span>
            )}
          </div>
        </form>
      )}

      {/* Tab 2: Supabase Settings */}
      {activeTab === 'supabase' && (
        <div className="p-6 space-y-5 max-w-2xl">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Integrazione Supabase Realtime & PostgreSQL</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              L'applicazione funziona sia in modalità <strong>Offline/Locale Realtime</strong> (tramite sincronizzazione istantanea interna), sia collegandosi direttamente al tuo database <strong>Supabase</strong>.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supabase Project URL
              </label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supabase Anon Public API Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleSaveSupabase}
              disabled={isTesting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Server className="w-4 h-4" />
              <span>{isTesting ? 'Verifica Connessione...' : 'Salva e Testa Connessione'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: SQL Script */}
      {activeTab === 'sql' && (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Script SQL per Inizializzazione Database Supabase
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Copia questo codice ed incollalo nel <strong>SQL Editor</strong> della tua dashboard Supabase.
              </p>
            </div>
            <button
              onClick={handleCopySQL}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              {sqlCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{sqlCopied ? 'Copiato!' : 'Copia Schema SQL'}</span>
            </button>
          </div>

          <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed border border-slate-800 select-all">
            <pre>{`-- Esegui questo script in Supabase > SQL Editor > New query
-- 1. Sequenza numerazione ordini atomica ORD-000001
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Tabella products (catalogo articoli da Excel)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL,
  alternative_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabella orders (testate ordini)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_reference TEXT,
  status TEXT NOT NULL DEFAULT 'NUOVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabella order_items (righe con snapshot)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_code_snapshot TEXT NOT NULL,
  product_description_snapshot TEXT NOT NULL,
  unit_of_measure_snapshot TEXT NOT NULL,
  alternative_code_snapshot TEXT,
  quantity NUMERIC(10, 3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Trigger per auto-generazione numero ordine
DROP TRIGGER IF EXISTS trg_generate_order_number ON orders;
CREATE TRIGGER trg_generate_order_number
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- 6. Abilita Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders, order_items;`}</pre>
          </div>
        </div>
      )}

      {/* Tab 4: Passwords */}
      {activeTab === 'passwords' && (
        <form onSubmit={handleSavePasswords} className="p-6 space-y-4 max-w-md">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600">
            Imposta credenziali di accesso separate per il personale di magazzino e l'ufficio.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nuovo PIN / Password Magazzino (Smartphone)
            </label>
            <input
              type="text"
              placeholder="Es. 1234"
              value={magazzinoPin}
              onChange={(e) => setMagazzinoPin(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nuova Password Ufficio Amministrativo (Computer)
            </label>
            <input
              type="password"
              placeholder="Es. ufficio2026"
              value={ufficioPass}
              onChange={(e) => setUfficioPass(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {passNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>{passNotice}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!magazzinoPin && !ufficioPass}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            <Save className="w-4 h-4" />
            <span>Aggiorna Credenziali</span>
          </button>
        </form>
      )}

      {/* Tab 5: IONOS & Production Guide */}
      {activeTab === 'ionos' && (
        <div className="p-6 space-y-4 max-w-3xl text-xs text-slate-700 leading-relaxed">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-900">
            <h4 className="font-extrabold text-sm mb-1 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Guida Pubblicazione Online & Hosting IONOS</span>
            </h4>
            <p>
              L'applicazione è pronta per essere pubblicata su qualsiasi infrastruttura di produzione, incluso <strong>IONOS Deploy Now</strong>, <strong>IONOS Web Hosting / VPS</strong>, <strong>Vercel</strong> o <strong>Cloud Run</strong>.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <h5 className="font-bold text-slate-900 mb-1">1. Compilazione Build di Produzione</h5>
              <p className="font-mono text-[11px] bg-slate-900 text-slate-200 p-2 rounded-lg mt-1 mb-1">
                npm run build
              </p>
              <p className="text-slate-500">
                Genera la cartella <code className="font-mono text-slate-800">dist/</code> ottimizzata contenente HTML, JavaScript compressi, Service Worker PWA e icone.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <h5 className="font-bold text-slate-900 mb-1">2. Pubblicazione su IONOS Deploy Now (Consigliato)</h5>
              <p>
                1. Collega il tuo repository Git al pannello IONOS Deploy Now.<br />
                2. Framework Preset: seleziona <strong>Vite</strong>.<br />
                3. Build Command: <code className="font-mono">npm run build</code>.<br />
                4. Publish Directory: <code className="font-mono">dist</code>.<br />
                5. Aggiungi le variabili d'ambiente <code className="font-mono">VITE_SUPABASE_URL</code> e <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <h5 className="font-bold text-slate-900 mb-1">3. Collegamento Dominio Aziendale & SSL</h5>
              <p>
                Nel pannello IONOS (Gestione Domini), crea un record CNAME (o record A per server dedicato) che punta all'indirizzo dell'applicazione (es. <code className="font-mono">magazzino.tua-azienda.it</code>).
                Il certificato SSL Let's Encrypt o Wildcard viene attivato automaticamente per garantire la crittografia HTTPS necessaria per la PWA e il Service Worker.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
