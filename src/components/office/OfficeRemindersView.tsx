import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Edit3,
  Layers,
  ListTodo,
  MessageSquareText,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Warehouse,
} from 'lucide-react';
import {
  ReminderCategory,
  ReminderLocationScope,
  ReminderPriority,
  WarehouseReminder,
} from '../../types';
import {
  completeWarehouseReminder,
  createWarehouseReminder,
  deleteWarehouseReminder,
  reopenWarehouseReminder,
  updateWarehouseReminder,
} from '../../services/db';
import {
  addDaysToDateKey,
  formatFullItalianDate,
  formatReminderDayLabel,
  formatReminderTimestamp,
  getLocalDateKey,
  isReminderOverdue,
  loadLastReminderOperator,
  saveReminderOperatorChoice,
  sortReminders,
} from '../../lib/reminders';
import { CompleteReminderModal } from '../warehouse/CompleteReminderModal';
import { useToast } from '../warehouse/ui/ToastProvider';

interface OfficeRemindersViewProps {
  reminders: WarehouseReminder[];
  onRefreshReminders: () => Promise<void>;
}

type OfficeDayFilter = 'ALL' | 'TODAY' | 'OVERDUE' | 'TOMORROW' | 'WEEK' | 'CUSTOM';

export const OfficeRemindersView: React.FC<OfficeRemindersViewProps> = ({
  reminders,
  onRefreshReminders,
}) => {
  const { showToast } = useToast();
  const todayKey = getLocalDateKey();
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const weekEndKey = addDaysToDateKey(todayKey, 7);

  // Create / Edit Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<ReminderCategory>('ATTIVITA');
  const [title, setTitle] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [dueDate, setDueDate] = useState(todayKey);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<ReminderPriority>('NORMALE');
  const [warehouseLocation, setWarehouseLocation] = useState<ReminderLocationScope>('ENTRAMBI');
  const [description, setDescription] = useState('');
  const [createdBy, setCreatedBy] = useState(() => loadLastReminderOperator('ufficio') || 'Ufficio');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // List Filter State
  const [dayFilter, setDayFilter] = useState<OfficeDayFilter>('ALL');
  const [customDate, setCustomDate] = useState(todayKey);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DA_FARE' | 'COMPLETATO'>('ALL');
  const [locationFilter, setLocationFilter] = useState<'ALL' | 'MAGAZZINO' | 'DEPOSITO'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Complete Modal target (still asks who completed it!)
  const [pendingComplete, setPendingComplete] = useState<WarehouseReminder | null>(null);

  const stats = useMemo(() => {
    let todayOpen = 0;
    let overdueOrUrgent = 0;
    let completedToday = 0;
    let futurePlanned = 0;

    for (const r of reminders) {
      if (r.status === 'DA_FARE') {
        if (r.due_date === todayKey) todayOpen++;
        if (r.due_date < todayKey || r.priority === 'URGENTE') overdueOrUrgent++;
        if (r.due_date > todayKey) futurePlanned++;
      } else if (r.due_date === todayKey) {
        completedToday++;
      }
    }

    return { todayOpen, overdueOrUrgent, completedToday, futurePlanned };
  }, [reminders, todayKey]);

  const visibleReminders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = reminders.filter((r) => {
      if (dayFilter === 'TODAY' && r.due_date !== todayKey) return false;
      if (dayFilter === 'OVERDUE' && !isReminderOverdue(r, todayKey)) return false;
      if (dayFilter === 'TOMORROW' && r.due_date !== tomorrowKey) return false;
      if (dayFilter === 'WEEK' && (r.due_date < todayKey || r.due_date > weekEndKey)) return false;
      if (dayFilter === 'CUSTOM' && r.due_date !== customDate) return false;

      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

      if (
        locationFilter !== 'ALL' &&
        r.warehouse_location !== 'ENTRAMBI' &&
        r.warehouse_location !== locationFilter
      ) {
        return false;
      }

      if (q) {
        const hay = [
          r.title,
          r.description,
          r.customer_reference,
          r.completed_by,
          r.created_by,
          r.completion_note,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return sortReminders(filtered);
  }, [
    reminders,
    dayFilter,
    customDate,
    statusFilter,
    locationFilter,
    searchQuery,
    todayKey,
    tomorrowKey,
    weekEndKey,
  ]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCustomerReference('');
    setDueDate(todayKey);
    setDueTime('');
    setPriority('NORMALE');
    setWarehouseLocation('ENTRAMBI');
    setDescription('');
    setFormError(null);
  };

  const handleLoadEdit = (r: WarehouseReminder) => {
    setEditingId(r.id);
    setCategory(r.category);
    setTitle(r.title);
    setCustomerReference(r.customer_reference || '');
    setDueDate(r.due_date);
    setDueTime(r.due_time || '');
    setPriority(r.priority);
    setWarehouseLocation(r.warehouse_location);
    setDescription(r.description || '');
    setCreatedBy(r.created_by || 'Ufficio');
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Inserisci il titolo dell'attività o dell'ordine da preparare.");
      return;
    }

    setIsSaving(true);
    try {
      if (createdBy.trim()) {
        saveReminderOperatorChoice(createdBy.trim(), 'ufficio');
      }
      if (editingId) {
        await updateWarehouseReminder(editingId, {
          title: title.trim(),
          description: description.trim() || null,
          category,
          due_date: dueDate,
          due_time: dueTime.trim() || null,
          priority,
          warehouse_location: warehouseLocation,
          customer_reference: customerReference.trim() || null,
          created_by: createdBy.trim() || 'Ufficio',
        });
        showToast({ message: 'Promemoria aggiornato', tone: 'success' });
      } else {
        await createWarehouseReminder({
          title: title.trim(),
          description: description.trim() || null,
          category,
          due_date: dueDate,
          due_time: dueTime.trim() || null,
          priority,
          warehouse_location: warehouseLocation,
          customer_reference: customerReference.trim() || null,
          created_by: createdBy.trim() || 'Ufficio',
        });
        showToast({
          message: 'Promemoria inviato al Magazzino',
          detail: `Data: ${formatReminderDayLabel(dueDate, todayKey)}`,
          tone: 'success',
        });
      }
      resetForm();
      await onRefreshReminders();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateTomorrow = async (r: WarehouseReminder) => {
    const targetDay = r.due_date >= todayKey ? addDaysToDateKey(r.due_date, 1) : tomorrowKey;
    await createWarehouseReminder({
      title: r.title,
      description: r.description,
      category: r.category,
      due_date: targetDay,
      due_time: r.due_time,
      priority: r.priority,
      warehouse_location: r.warehouse_location,
      customer_reference: r.customer_reference,
      created_by: createdBy.trim() || r.created_by || 'Ufficio',
    });
    showToast({
      message: 'Attività duplicata',
      detail: `Programmata per ${formatReminderDayLabel(targetDay, todayKey)}`,
      tone: 'success',
    });
    await onRefreshReminders();
  };

  const handleDelete = async (r: WarehouseReminder) => {
    if (!window.confirm(`Eliminare il promemoria "${r.title}"?`)) return;
    await deleteWarehouseReminder(r.id);
    showToast({ message: 'Promemoria eliminato', tone: 'info' });
    await onRefreshReminders();
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshReminders();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ListTodo className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Promemoria &amp; To-Do Giornaliera Magazzino
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pianifica attività e ordini da preparare per giorno ({formatFullItalianDate(todayKey)}). Vedi in tempo reale chi li ha completati in magazzino.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleManualRefresh()}
          disabled={isRefreshing}
          className="self-start lg:self-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold inline-flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Aggiorna Stato</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
            Da Fare Oggi
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{stats.todayOpen}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-mono font-bold uppercase text-red-500">
            Urgenti / Arretrati
          </div>
          <div className="text-2xl font-black text-red-600 mt-1 tabular-nums">
            {stats.overdueOrUrgent}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-mono font-bold uppercase text-emerald-600">
            Completati Oggi
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">
            {stats.completedToday}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
            Prossimi Giorni
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {stats.futurePlanned}
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Create / Edit Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CalendarPlus className="w-5 h-5 text-red-400" />
              <h2 className="text-sm sm:text-base font-extrabold">
                {editingId ? 'Modifica Promemoria' : 'Nuovo Promemoria per Magazzino'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white"
              >
                Annulla
              </button>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                Tipologia
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('ATTIVITA')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-2 transition ${
                    category === 'ATTIVITA'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Attività da Fare</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('ORDINE_DA_PREPARARE')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-2 transition ${
                    category === 'ORDINE_DA_PREPARARE'
                      ? 'bg-sky-700 text-white border-sky-700 shadow-xs'
                      : 'bg-sky-50/70 text-sky-900 border-sky-200 hover:bg-sky-50'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Ordine da Preparare</span>
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Descrizione Attività / Materiale *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === 'ORDINE_DA_PREPARARE'
                    ? 'Es. Preparare pedana laterizio e calce per carico...'
                    : 'Es. Scarico bilico cemento ore 10:00 / Riordino corsia...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
              />
            </div>

            {/* Customer / Ref */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                {category === 'ORDINE_DA_PREPARARE'
                  ? 'Cliente / Rif. Ordine o Cantiere'
                  : 'Cliente / Riferimento (Opzionale)'}
              </label>
              <input
                type="text"
                value={customerReference}
                onChange={(e) => setCustomerReference(e.target.value)}
                placeholder="Es. Impresa Verdi Mario · Ritiro domani mattina"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
              />
            </div>

            {/* Day Presets + Date & Time */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Giorno di Esecuzione *
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Oggi', key: todayKey },
                  { label: 'Domani', key: tomorrowKey },
                  { label: 'Dopodomani', key: addDaysToDateKey(todayKey, 2) },
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setDueDate(d.key)}
                    className={`py-2 rounded-lg text-xs font-extrabold border transition ${
                      dueDate === d.key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => e.target.value && setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
                />
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  aria-label="Ora indicativa opzionale"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
                />
              </div>
            </div>

            {/* Priority & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                  Priorità
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPriority('NORMALE')}
                    className={`py-2 rounded-lg text-xs font-extrabold border transition ${
                      priority === 'NORMALE'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Normale
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('URGENTE')}
                    className={`py-2 rounded-lg text-xs font-extrabold border transition ${
                      priority === 'URGENTE'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    Urgente
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                  Sede / Reparto
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { value: 'ENTRAMBI', label: 'Entrambi' },
                      { value: 'MAGAZZINO', label: 'Mag.' },
                      { value: 'DEPOSITO', label: 'Dep.' },
                    ] as const
                  ).map((loc) => (
                    <button
                      key={loc.value}
                      type="button"
                      onClick={() => setWarehouseLocation(loc.value)}
                      className={`py-2 rounded-lg text-xs font-extrabold border transition ${
                        warehouseLocation === loc.value
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Note / Istruzioni (Opzionale)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Es. Caricare sul lato sinistro del piazzale · Ritiro furgone targato..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none"
              />
            </div>

            {/* Created By */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Inserito da (Ufficio)
              </label>
              <input
                type="text"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                placeholder="Es. Marco, Ufficio..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
              />
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-extrabold shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              <Plus className="w-5 h-5" />
              <span>
                {isSaving
                  ? 'Salvataggio in corso...'
                  : editingId
                  ? 'Salva Modifiche'
                  : 'Invia Promemoria al Magazzino'}
              </span>
            </button>
          </div>
        </form>

        {/* Right: List & Completion Audit */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca per attività, cliente, chi ha completato..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-slate-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'ALL' | 'DA_FARE' | 'COMPLETATO')
                }
                className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700"
              >
                <option value="ALL">Tutti gli stati</option>
                <option value="DA_FARE">Da Fare</option>
                <option value="COMPLETATO">Completati</option>
              </select>
              <select
                value={locationFilter}
                onChange={(e) =>
                  setLocationFilter(e.target.value as 'ALL' | 'MAGAZZINO' | 'DEPOSITO')
                }
                className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700"
              >
                <option value="ALL">Tutte le sedi</option>
                <option value="MAGAZZINO">Magazzino</option>
                <option value="DEPOSITO">Deposito</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'ALL', label: 'Tutti i giorni' },
                  { id: 'TODAY', label: 'Oggi' },
                  { id: 'OVERDUE', label: 'Arretrati' },
                  { id: 'TOMORROW', label: 'Domani' },
                  { id: 'WEEK', label: 'Prossimi 7 gg' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setDayFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition ${
                    dayFilter === chip.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
              <label
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer ${
                  dayFilter === 'CUSTOM'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setCustomDate(e.target.value);
                      setDayFilter('CUSTOM');
                    }
                  }}
                  className="bg-transparent text-xs font-bold focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* Cards */}
          {visibleReminders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
              <h3 className="text-sm font-extrabold text-slate-700">
                Nessun promemoria trovato
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Compila il modulo a sinistra per pianificare un&apos;attività o un ordine da preparare per il magazzino.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleReminders.map((r) => {
                const isDone = r.status === 'COMPLETATO';
                const overdue = isReminderOverdue(r, todayKey);
                const isUrgent = !isDone && r.priority === 'URGENTE';
                const isOrderPrep = r.category === 'ORDINE_DA_PREPARARE';

                return (
                  <div
                    key={r.id}
                    className={`bg-white rounded-2xl border shadow-2xs p-4 space-y-2.5 ${
                      isDone
                        ? 'border-emerald-200/90 bg-emerald-50/15'
                        : isUrgent
                        ? 'border-red-200 border-l-4 border-l-red-600'
                        : overdue
                        ? 'border-amber-200 border-l-4 border-l-amber-500'
                        : 'border-slate-200/90'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : overdue
                                ? 'bg-amber-200 text-amber-950'
                                : 'bg-slate-900 text-white'
                            }`}
                          >
                            {isDone ? 'COMPLETATO' : overdue ? 'SCADUTO' : 'DA FARE'}
                          </span>
                          {isUrgent && (
                            <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono font-black uppercase">
                              URGENTE
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isOrderPrep
                                ? 'bg-sky-100 text-sky-900 border border-sky-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isOrderPrep ? (
                              <Package className="w-3 h-3" />
                            ) : (
                              <ClipboardList className="w-3 h-3" />
                            )}
                            <span>{isOrderPrep ? 'ORDINE DA PREPARARE' : 'ATTIVITÀ'}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                            {formatReminderDayLabel(r.due_date, todayKey)}
                            {r.due_time ? ` · ${r.due_time}` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                            {r.warehouse_location === 'DEPOSITO' ? (
                              <Layers className="w-3 h-3" />
                            ) : (
                              <Warehouse className="w-3 h-3" />
                            )}
                            <span>{r.warehouse_location}</span>
                          </span>
                        </div>

                        <h3
                          className={`text-base font-extrabold leading-snug ${
                            isDone ? 'line-through text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {r.title}
                        </h3>

                        {r.customer_reference && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-xs font-bold text-sky-950">
                            <Package className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                            <span>Cliente / Rif: {r.customer_reference}</span>
                          </div>
                        )}

                        {r.description && (
                          <p className="text-xs text-slate-600 flex items-start gap-1.5">
                            <MessageSquareText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>{r.description}</span>
                          </p>
                        )}
                      </div>

                      {/* Card Controls */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {!isDone ? (
                          <button
                            type="button"
                            onClick={() => setPendingComplete(r)}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Completa</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void reopenWarehouseReminder(r.id)}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Riapri</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleDuplicateTomorrow(r)}
                          title="Duplica per il giorno successivo"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadEdit(r)}
                          title="Modifica promemoria"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(r)}
                          title="Elimina promemoria"
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Completion Traceability Audit Bar */}
                    {isDone ? (
                      <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 font-extrabold">
                          <UserCheck className="w-4 h-4 text-emerald-700" />
                          <span>Completata da {r.completed_by || 'Operatore'}</span>
                          {r.completed_at && (
                            <span className="font-mono text-[11px] font-bold text-emerald-700">
                              · {formatReminderTimestamp(r.completed_at)}
                            </span>
                          )}
                        </div>
                        {r.completion_note && (
                          <span className="text-[11px] font-medium text-emerald-800">
                            Nota: {r.completion_note}
                          </span>
                        )}
                      </div>
                    ) : overdue ? (
                      <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Attività programmata per {formatReminderDayLabel(r.due_date, todayKey)} ancora aperta in magazzino.</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Operator Attribution Modal */}
      <CompleteReminderModal
        reminder={pendingComplete}
        operatorMode="magazzino"
        onCancel={() => setPendingComplete(null)}
        onConfirm={async (operatorName, note) => {
          if (!pendingComplete) return;
          await completeWarehouseReminder(pendingComplete.id, {
            completedBy: operatorName,
            completionNote: note,
          });
          showToast({
            message: 'Attività completata',
            detail: `Registrato completamento di ${operatorName}`,
            tone: 'success',
          });
          setPendingComplete(null);
        }}
      />
    </div>
  );
};
