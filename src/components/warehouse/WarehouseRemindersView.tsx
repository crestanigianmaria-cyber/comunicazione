import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  Edit3,
  Layers,
  MessageSquareText,
  Package,
  Plus,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Warehouse,
  X,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import {
  ReminderCategory,
  ReminderLocationScope,
  ReminderPriority,
  WarehouseReminder,
} from '../../types';
import {
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
import { ResponsiveSheetModal } from './ui/ResponsiveSheetModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { EmptyState } from './ui/EmptyState';
import { useToast } from './ui/ToastProvider';

interface WarehouseRemindersViewProps {
  reminders: WarehouseReminder[];
  onRefreshReminders: () => Promise<void>;
  onRequestComplete: (reminder: WarehouseReminder) => void;
  onStartOrderFromReminder?: (reminder: WarehouseReminder) => void;
}

type DayTab = 'TODAY' | 'OVERDUE' | 'TOMORROW' | 'WEEK' | 'COMPLETED' | 'ALL' | 'CUSTOM';

export const WarehouseRemindersView: React.FC<WarehouseRemindersViewProps> = ({
  reminders,
  onRefreshReminders,
  onRequestComplete,
  onStartOrderFromReminder,
}) => {
  const { showToast } = useToast();
  const todayKey = getLocalDateKey();
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const weekEndKey = addDaysToDateKey(todayKey, 7);

  const [dayTab, setDayTab] = useState<DayTab>('TODAY');
  const [customDate, setCustomDate] = useState<string>(todayKey);
  const [locationFilter, setLocationFilter] = useState<'ALL' | 'MAGAZZINO' | 'DEPOSITO'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add / Edit Bottom Sheet state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<WarehouseReminder | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReminderCategory>('ATTIVITA');
  const [dueDate, setDueDate] = useState(todayKey);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<ReminderPriority>('NORMALE');
  const [warehouseLocation, setWarehouseLocation] = useState<ReminderLocationScope>('ENTRAMBI');
  const [customerRef, setCustomerRef] = useState('');
  const [description, setDescription] = useState('');
  const [createdBy, setCreatedBy] = useState(() => loadLastReminderOperator('magazzino'));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reopen / Delete Confirm state
  const [pendingReopen, setPendingReopen] = useState<WarehouseReminder | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WarehouseReminder | null>(null);

  // Live day counters
  const stats = useMemo(() => {
    let overdue = 0;
    let todayOpen = 0;
    let todayCompleted = 0;
    let tomorrowOpen = 0;
    let weekOpen = 0;
    let completedTotal = 0;

    for (const r of reminders) {
      if (r.status === 'COMPLETATO') {
        completedTotal++;
        if (r.due_date === todayKey) todayCompleted++;
      } else {
        if (r.due_date < todayKey) overdue++;
        if (r.due_date === todayKey) todayOpen++;
        if (r.due_date === tomorrowKey) tomorrowOpen++;
        if (r.due_date >= todayKey && r.due_date <= weekEndKey) weekOpen++;
      }
    }

    const todayTotal = todayOpen + todayCompleted;
    const todayProgressPct =
      todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

    return {
      overdue,
      todayOpen,
      todayCompleted,
      todayTotal,
      todayProgressPct,
      tomorrowOpen,
      weekOpen,
      completedTotal,
      allTotal: reminders.length,
    };
  }, [reminders, todayKey, tomorrowKey, weekEndKey]);

  const visibleReminders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = reminders.filter((r) => {
      if (dayTab === 'TODAY') {
        // Show today's items (open first, completed below) AND any overdue open tasks so nothing slips!
        const isTodayItem = r.due_date === todayKey;
        const isOverdueOpen = r.status === 'DA_FARE' && r.due_date < todayKey;
        if (!isTodayItem && !isOverdueOpen) return false;
      } else if (dayTab === 'OVERDUE') {
        if (!isReminderOverdue(r, todayKey)) return false;
      } else if (dayTab === 'TOMORROW') {
        if (r.due_date !== tomorrowKey) return false;
      } else if (dayTab === 'WEEK') {
        if (r.due_date < todayKey || r.due_date > weekEndKey) return false;
      } else if (dayTab === 'COMPLETED') {
        if (r.status !== 'COMPLETATO') return false;
      } else if (dayTab === 'CUSTOM') {
        if (r.due_date !== customDate) return false;
      }

      if (locationFilter !== 'ALL') {
        if (r.warehouse_location !== 'ENTRAMBI' && r.warehouse_location !== locationFilter) {
          return false;
        }
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
  }, [reminders, dayTab, customDate, locationFilter, searchQuery, todayKey, tomorrowKey, weekEndKey]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshReminders();
    } finally {
      setIsRefreshing(false);
    }
  };

  const openNewReminderModal = () => {
    setEditingReminder(null);
    setTitle('');
    setCategory('ATTIVITA');
    setDueDate(dayTab === 'TOMORROW' ? tomorrowKey : dayTab === 'CUSTOM' ? customDate : todayKey);
    setDueTime('');
    setPriority('NORMALE');
    setWarehouseLocation('ENTRAMBI');
    setCustomerRef('');
    setDescription('');
    setCreatedBy(loadLastReminderOperator('magazzino'));
    setFormError(null);
    setIsEditorOpen(true);
  };

  const openEditReminderModal = (r: WarehouseReminder) => {
    setEditingReminder(r);
    setTitle(r.title);
    setCategory(r.category);
    setDueDate(r.due_date);
    setDueTime(r.due_time || '');
    setPriority(r.priority);
    setWarehouseLocation(r.warehouse_location);
    setCustomerRef(r.customer_reference || '');
    setDescription(r.description || '');
    setCreatedBy(r.created_by || '');
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleSaveForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setFormError("Inserisci il titolo dell'attività o dell'ordine da preparare.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (createdBy.trim()) {
        saveReminderOperatorChoice(createdBy.trim(), 'magazzino');
      }
      if (editingReminder) {
        await updateWarehouseReminder(editingReminder.id, {
          title: title.trim(),
          description: description.trim() || null,
          category,
          due_date: dueDate,
          due_time: dueTime.trim() || null,
          priority,
          warehouse_location: warehouseLocation,
          customer_reference: customerRef.trim() || null,
          created_by: createdBy.trim() || null,
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
          customer_reference: customerRef.trim() || null,
          created_by: createdBy.trim() || null,
        });
        showToast({
          message: 'Promemoria aggiunto',
          detail: `Programmato per ${formatReminderDayLabel(dueDate, todayKey)}`,
          tone: 'success',
        });
      }
      setIsEditorOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmReopen = async () => {
    if (!pendingReopen) return;
    await reopenWarehouseReminder(pendingReopen.id);
    showToast({ message: 'Attività riaperta come Da Fare', tone: 'info' });
    setPendingReopen(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteWarehouseReminder(pendingDelete.id);
    showToast({ message: 'Promemoria rimosso', tone: 'info' });
    setPendingDelete(null);
  };

  const dayTabs: { id: DayTab; label: string; count?: number; tone?: 'red' | 'amber' | 'emerald' }[] = [
    {
      id: 'TODAY',
      label: 'Oggi',
      count: stats.todayOpen + stats.overdue > 0 ? stats.todayOpen + stats.overdue : undefined,
      tone: stats.overdue > 0 ? 'amber' : 'red',
    },
    ...(stats.overdue > 0
      ? [{ id: 'OVERDUE' as const, label: 'Arretrati', count: stats.overdue, tone: 'amber' as const }]
      : []),
    {
      id: 'TOMORROW',
      label: 'Domani',
      count: stats.tomorrowOpen > 0 ? stats.tomorrowOpen : undefined,
    },
    {
      id: 'WEEK',
      label: '7 Giorni',
      count: stats.weekOpen > 0 ? stats.weekOpen : undefined,
    },
    {
      id: 'COMPLETED',
      label: 'Completate',
      count: stats.completedTotal > 0 ? stats.completedTotal : undefined,
      tone: 'emerald',
    },
    {
      id: 'ALL',
      label: 'Tutte',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-3.5 pb-24 md:pb-8 xl:pb-6">
      {/* Compact Dark Daily Progress Header Card */}
      <section className="bg-[#0b0f19] text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-600/20 text-red-300 border border-red-500/30">
                To-Do Operativa
              </span>
              {stats.overdue > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{stats.overdue} arretrati</span>
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight mt-1.5 leading-tight">
              {formatFullItalianDate(todayKey)}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {stats.todayTotal === 0
                ? 'Nessuna attività programmata per oggi'
                : stats.todayOpen === 0
                ? `Tutte le ${stats.todayTotal} attività di oggi completate`
                : `${stats.todayOpen} da fare oggi · ${stats.todayCompleted} completate`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={isRefreshing}
              aria-label="Aggiorna promemoria"
              className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 flex items-center justify-center text-slate-300 transition touch-manipulation"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={openNewReminderModal}
              className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-sm shadow-red-600/25 transition touch-manipulation"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nuovo</span>
            </button>
          </div>
        </div>

        {/* Daily Progress Bar */}
        {stats.todayTotal > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400">
              <span>Avanzamento Giorno</span>
              <span className="text-white tabular-nums">
                {stats.todayCompleted}/{stats.todayTotal} ({stats.todayProgressPct}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  stats.todayProgressPct === 100 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${stats.todayProgressPct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Scrollable Smartphone Day Filter Strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {dayTabs.map((tab) => {
          const active = dayTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDayTab(tab.id)}
              className={`min-h-[42px] px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 whitespace-nowrap border transition touch-manipulation ${
                active
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : tab.id === 'OVERDUE'
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-mono font-black inline-flex items-center justify-center tabular-nums ${
                    active
                      ? 'bg-white text-slate-950'
                      : tab.tone === 'amber'
                      ? 'bg-amber-500 text-slate-950'
                      : tab.tone === 'emerald'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Direct Date Picker Pill */}
        <label
          className={`min-h-[42px] px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 whitespace-nowrap border cursor-pointer transition touch-manipulation ${
            dayTab === 'CUSTOM'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <input
            type="date"
            value={customDate}
            onChange={(e) => {
              if (e.target.value) {
                setCustomDate(e.target.value);
                setDayTab('CUSTOM');
              }
            }}
            aria-label="Filtra per data specifica"
            className="bg-transparent text-xs font-extrabold focus:outline-none cursor-pointer w-[112px]"
          />
        </label>
      </div>

      {/* Compact Search & Location Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca attività, ordine cliente, operatore..."
            className="w-full min-h-[44px] pl-9 pr-9 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-base sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Pulisci ricerca promemoria"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-stretch sm:self-auto">
          {(
            [
              { id: 'ALL', label: 'Tutti' },
              { id: 'MAGAZZINO', label: 'Magazzino' },
              { id: 'DEPOSITO', label: 'Deposito' },
            ] as const
          ).map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => setLocationFilter(loc.id)}
              className={`min-h-[36px] flex-1 sm:flex-none px-3 rounded-lg text-xs font-extrabold transition touch-manipulation ${
                locationFilter === loc.id
                  ? 'bg-white text-slate-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {loc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List Cards */}
      {visibleReminders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nessun promemoria in questa vista"
          description={
            dayTab === 'TODAY'
              ? "Tutto in ordine per oggi! Tocca 'Nuovo' se vuoi annotare un'attività o un ordine da preparare."
              : 'Prova a cambiare giorno o rimuovere i filtri di ricerca.'
          }
          action={
            <button
              type="button"
              onClick={openNewReminderModal}
              className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-xs font-extrabold inline-flex items-center gap-1.5 hover:bg-slate-800 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Aggiungi Promemoria</span>
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {visibleReminders.map((item) => {
            const isDone = item.status === 'COMPLETATO';
            const isOrderPrep = item.category === 'ORDINE_DA_PREPARARE';
            const isUrgent = !isDone && item.priority === 'URGENTE';
            const overdue = isReminderOverdue(item, todayKey);

            return (
              <article
                key={item.id}
                className={`rounded-2xl border bg-white p-3.5 sm:p-4 transition shadow-2xs ${
                  isDone
                    ? 'border-emerald-200/80 bg-emerald-50/20'
                    : isUrgent
                    ? 'border-red-200 border-l-4 border-l-red-600'
                    : overdue
                    ? 'border-amber-200 border-l-4 border-l-amber-500'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Left Large 48px Touch Checkbox */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isDone) {
                        setPendingReopen(item);
                      } else {
                        onRequestComplete(item);
                      }
                    }}
                    aria-label={
                      isDone
                        ? `Riapri attività ${item.title}`
                        : `Completa attività ${item.title}`
                    }
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition active:scale-95 touch-manipulation border-2 ${
                      isDone
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : isUrgent
                        ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                        : 'bg-slate-50 border-slate-300 text-slate-400 hover:border-emerald-500 hover:text-emerald-600'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                    ) : (
                      <Circle className="w-6 h-6 stroke-[2]" />
                    )}
                  </button>

                  {/* Main Body */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Top Metadata Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isUrgent && (
                        <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono font-black uppercase">
                          Urgente
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          isOrderPrep
                            ? 'bg-sky-100 text-sky-900 border border-sky-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isOrderPrep ? (
                          <Package className="w-3 h-3" />
                        ) : (
                          <ClipboardList className="w-3 h-3" />
                        )}
                        <span>{isOrderPrep ? 'Ordine da preparare' : 'Attività'}</span>
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          overdue
                            ? 'bg-amber-200 text-amber-950 font-black'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {overdue
                          ? `Scaduto · ${formatReminderDayLabel(item.due_date, todayKey)}`
                          : formatReminderDayLabel(item.due_date, todayKey)}
                      </span>

                      {item.due_time && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{item.due_time}</span>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                        {item.warehouse_location === 'DEPOSITO' ? (
                          <Layers className="w-3 h-3" />
                        ) : (
                          <Warehouse className="w-3 h-3" />
                        )}
                        <span>
                          {item.warehouse_location === 'ENTRAMBI'
                            ? 'Mag. + Dep.'
                            : item.warehouse_location === 'DEPOSITO'
                            ? 'Deposito'
                            : 'Magazzino'}
                        </span>
                      </span>
                    </div>

                    {/* Task Title & Details */}
                    <div>
                      <h3
                        className={`text-sm sm:text-base font-extrabold leading-snug ${
                          isDone ? 'line-through text-slate-500' : 'text-slate-900'
                        }`}
                      >
                        {item.title}
                      </h3>

                      {item.customer_reference && (
                        <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-xs font-bold text-sky-950">
                          <Package className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                          <span>Cliente / Rif: {item.customer_reference}</span>
                        </div>
                      )}

                      {item.description && (
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed flex items-start gap-1.5">
                          <MessageSquareText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{item.description}</span>
                        </p>
                      )}

                      {item.created_by && (
                        <div className="mt-1 text-[11px] font-semibold text-slate-400">
                          Inserito da {item.created_by}
                        </div>
                      )}
                    </div>

                    {/* Completed Audit Strip */}
                    {isDone && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-0.5">
                        <div className="font-extrabold flex items-center gap-1.5 flex-wrap">
                          <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>Completata da {item.completed_by || 'Operatore'}</span>
                          {item.completed_at && (
                            <span className="font-mono text-[11px] font-bold text-emerald-700">
                              · {formatReminderTimestamp(item.completed_at)}
                            </span>
                          )}
                        </div>
                        {item.completion_note && (
                          <div className="text-[11px] text-emerald-800 pl-5">
                            Nota: {item.completion_note}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Row */}
                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                        {!isDone ? (
                          <button
                            type="button"
                            onClick={() => onRequestComplete(item)}
                            className="min-h-[44px] flex-1 sm:flex-none px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition touch-manipulation"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Segna Completato</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingReopen(item)}
                            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition touch-manipulation"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Riapri Attività</span>
                          </button>
                        )}

                        {!isDone && isOrderPrep && onStartOrderFromReminder && (
                          <button
                            type="button"
                            onClick={() => onStartOrderFromReminder(item)}
                            className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-extrabold flex items-center gap-1.5 transition touch-manipulation"
                          >
                            <PlusCircle className="w-4 h-4 text-red-600" />
                            <span>Apri Carico</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditReminderModal(item)}
                          aria-label={`Modifica ${item.title}`}
                          className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition touch-manipulation"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(item)}
                          aria-label={`Elimina ${item.title}`}
                          className="w-11 h-11 rounded-xl border border-red-100 bg-red-50/70 hover:bg-red-100 text-red-600 flex items-center justify-center transition touch-manipulation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT REMINDER SHEET MODAL */}
      <ResponsiveSheetModal
        isOpen={isEditorOpen}
        onClose={() => {
          if (!isSaving) setIsEditorOpen(false);
        }}
        headerTone="dark"
        maxWidthClass="sm:max-w-lg"
        title={editingReminder ? 'Modifica Promemoria' : 'Nuovo Promemoria Magazzino'}
        subtitle="Nuova attività o ordine da preparare"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              disabled={isSaving}
              className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-extrabold touch-manipulation"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => void handleSaveForm()}
              disabled={isSaving}
              className="min-h-[48px] px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 touch-manipulation"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Salvataggio...' : editingReminder ? 'Salva Modifiche' : 'Salva Promemoria'}</span>
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveForm} className="p-4 sm:p-5 space-y-4">
          {/* Category Switch */}
          <div>
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
              Tipologia
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategory('ATTIVITA')}
                className={`min-h-[44px] px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation ${
                  category === 'ATTIVITA'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Attività da fare</span>
              </button>
              <button
                type="button"
                onClick={() => setCategory('ORDINE_DA_PREPARARE')}
                className={`min-h-[44px] px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation ${
                  category === 'ORDINE_DA_PREPARARE'
                    ? 'bg-sky-700 text-white border-sky-700'
                    : 'bg-sky-50/70 text-sky-900 border-sky-200'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Ordine da preparare</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
              Titolo / Cosa fare *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder={
                category === 'ORDINE_DA_PREPARARE'
                  ? 'Es. Preparare bancale forati + calce per ritiro...'
                  : 'Es. Scarico camion laterizi ore 10:00...'
              }
              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
            />
          </div>

          {/* Customer Reference */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              {category === 'ORDINE_DA_PREPARARE'
                ? 'Cliente / Rif. Ordine'
                : 'Cliente / Riferimento (Opzionale)'}
            </label>
            <input
              type="text"
              value={customerRef}
              onChange={(e) => setCustomerRef(e.target.value)}
              placeholder="Es. Edilizia Rossi · Cantiere Marostica"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-base sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
            />
          </div>

          {/* Day Selection + Quick Picks */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
              Giorno Programmato
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Oggi', key: todayKey },
                { label: 'Domani', key: tomorrowKey },
                { label: 'Dopodomani', key: addDaysToDateKey(todayKey, 2) },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDueDate(preset.key)}
                  className={`min-h-[40px] rounded-xl text-xs font-extrabold border transition touch-manipulation ${
                    dueDate === preset.key
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => e.target.value && setDueDate(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-base sm:text-sm font-bold text-slate-900 bg-white"
              />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                aria-label="Ora indicativa opzionale"
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-base sm:text-sm font-bold text-slate-900 bg-white"
              />
            </div>
          </div>

          {/* Priority + Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                Priorità
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPriority('NORMALE')}
                  className={`min-h-[42px] rounded-xl text-xs font-extrabold border transition touch-manipulation ${
                    priority === 'NORMALE'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Normale
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('URGENTE')}
                  className={`min-h-[42px] rounded-xl text-xs font-extrabold border transition touch-manipulation ${
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
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                Reparto
              </span>
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
                    className={`min-h-[42px] rounded-xl text-xs font-extrabold border transition touch-manipulation ${
                      warehouseLocation === loc.value
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes + Inserted By */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              Note aggiuntive (Opzionale)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dettagli, posizione corsia, automezzo..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm font-medium text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/25 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              Inserito da (Opzionale)
            </label>
            <input
              type="text"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="Es. Marco, Ufficio..."
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-base sm:text-sm font-semibold text-slate-900"
            />
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              {formError}
            </div>
          )}
        </form>
      </ResponsiveSheetModal>

      {/* REOPEN CONFIRMATION */}
      <ConfirmDialog
        isOpen={Boolean(pendingReopen)}
        title="Riaprire questa attività?"
        description={
          pendingReopen
            ? `L'attività "${pendingReopen.title}" tornerà nello stato Da Fare e verrà azzerato l'operatore registrato (${pendingReopen.completed_by || '-'}).`
            : ''
        }
        confirmLabel="Sì, riapri attività"
        tone="primary"
        onCancel={() => setPendingReopen(null)}
        onConfirm={() => void handleConfirmReopen()}
      />

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Eliminare questo promemoria?"
        description={
          pendingDelete
            ? `Il promemoria "${pendingDelete.title}" verrà rimosso dall'agenda.`
            : ''
        }
        confirmLabel="Elimina"
        tone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
};
