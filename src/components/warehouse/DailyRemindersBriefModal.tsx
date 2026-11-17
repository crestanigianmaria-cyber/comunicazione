import React from 'react';
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Package,
  ClipboardList,
  Clock,
  Warehouse,
  Layers,
  ArrowRight,
  PlusCircle,
} from 'lucide-react';
import { WarehouseReminder } from '../../types';
import {
  formatFullItalianDate,
  formatReminderDayLabel,
  getLocalDateKey,
  isReminderOverdue,
  sortReminders,
} from '../../lib/reminders';
import { ResponsiveSheetModal } from './ui/ResponsiveSheetModal';

interface DailyRemindersBriefModalProps {
  isOpen: boolean;
  reminders: WarehouseReminder[];
  onClose: () => void;
  onOpenFullTodoList: () => void;
  onRequestComplete: (reminder: WarehouseReminder) => void;
  onStartOrderFromReminder?: (reminder: WarehouseReminder) => void;
}

export const DailyRemindersBriefModal: React.FC<DailyRemindersBriefModalProps> = ({
  isOpen,
  reminders,
  onClose,
  onOpenFullTodoList,
  onRequestComplete,
  onStartOrderFromReminder,
}) => {
  const todayKey = getLocalDateKey();
  const dueList = React.useMemo(
    () =>
      sortReminders(
        reminders.filter(r => r.status === 'DA_FARE' && r.due_date <= todayKey)
      ),
    [reminders, todayKey]
  );

  const overdueList = dueList.filter(r => isReminderOverdue(r, todayKey));
  const todayList = dueList.filter(r => r.due_date === todayKey);
  const completedTodayCount = reminders.filter(
    r => r.status === 'COMPLETATO' && r.due_date === todayKey
  ).length;
  const urgentCount = dueList.filter(r => r.priority === 'URGENTE').length;

  return (
    <ResponsiveSheetModal
      isOpen={isOpen && dueList.length > 0}
      onClose={onClose}
      headerTone="dark"
      maxWidthClass="sm:max-w-xl"
      title={`Promemoria · ${formatFullItalianDate(todayKey)}`}
      subtitle={`${dueList.length} ${
        dueList.length === 1 ? 'attività in programma' : 'attività in programma'
      }${urgentCount > 0 ? ` · ${urgentCount} urgenti` : ''}`}
      headerBadge={
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono font-black uppercase tracking-wider">
            <CalendarClock className="w-3 h-3" />
            <span>Agenda Magazzino</span>
          </span>
          {overdueList.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-mono font-black uppercase">
              <AlertTriangle className="w-3 h-3" />
              <span>{overdueList.length} arretrati</span>
            </span>
          )}
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFullTodoList();
            }}
            className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition touch-manipulation"
          >
            <ClipboardList className="w-4 h-4 text-slate-700" />
            <span>Apri To-Do Completa</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition touch-manipulation"
          >
            <span>Vai al Magazzino</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {/* Progress Pill Row */}
        {completedTodayCount > 0 && (
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between">
            <span>Attività di oggi già completate</span>
            <span className="font-mono font-black px-2 py-0.5 rounded bg-emerald-600 text-white">
              {completedTodayCount}
            </span>
          </div>
        )}

        {/* Overdue Group */}
        {overdueList.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-black uppercase tracking-wider text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Da giorni precedenti ({overdueList.length})</span>
            </div>
            <div className="space-y-2">
              {overdueList.map(item => (
                <BriefTaskCard
                  key={item.id}
                  item={item}
                  todayKey={todayKey}
                  overdue
                  onComplete={() => onRequestComplete(item)}
                  onStartOrder={
                    onStartOrderFromReminder
                      ? () => {
                          onClose();
                          onStartOrderFromReminder(item);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Today Group */}
        {todayList.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-slate-500">
                In programma oggi ({todayList.length})
              </span>
            </div>
            <div className="space-y-2">
              {todayList.map(item => (
                <BriefTaskCard
                  key={item.id}
                  item={item}
                  todayKey={todayKey}
                  overdue={false}
                  onComplete={() => onRequestComplete(item)}
                  onStartOrder={
                    onStartOrderFromReminder
                      ? () => {
                          onClose();
                          onStartOrderFromReminder(item);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </ResponsiveSheetModal>
  );
};

interface BriefTaskCardProps {
  item: WarehouseReminder;
  todayKey: string;
  overdue: boolean;
  onComplete: () => void;
  onStartOrder?: () => void;
}

const BriefTaskCard: React.FC<BriefTaskCardProps> = ({
  item,
  todayKey,
  overdue,
  onComplete,
  onStartOrder,
}) => {
  const isOrder = item.category === 'ORDINE_DA_PREPARARE';
  const isUrgent = item.priority === 'URGENTE';

  return (
    <div
      className={`rounded-2xl border p-3.5 transition ${
        isUrgent
          ? 'bg-red-50/40 border-red-200 border-l-4 border-l-red-600'
          : overdue
          ? 'bg-amber-50/50 border-amber-200 border-l-4 border-l-amber-500'
          : 'bg-white border-slate-200 shadow-2xs'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isUrgent && (
            <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono font-black uppercase">
              Urgente
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
              isOrder
                ? 'bg-sky-100 text-sky-900 border border-sky-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {isOrder ? <Package className="w-3 h-3" /> : <ClipboardList className="w-3 h-3" />}
            <span>{isOrder ? 'Ordine da preparare' : 'Attività'}</span>
          </span>
          {overdue && (
            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px] font-mono font-black">
              {formatReminderDayLabel(item.due_date, todayKey)}
            </span>
          )}
          {item.due_time && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{item.due_time}</span>
            </span>
          )}
          {item.warehouse_location !== 'ENTRAMBI' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
              {item.warehouse_location === 'DEPOSITO' ? (
                <Layers className="w-3 h-3" />
              ) : (
                <Warehouse className="w-3 h-3" />
              )}
              <span>{item.warehouse_location === 'DEPOSITO' ? 'Deposito' : 'Magazzino'}</span>
            </span>
          )}
        </div>

        <div>
          <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{item.title}</h4>
          {item.customer_reference && (
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              Cliente / Rif: <span className="text-slate-950">{item.customer_reference}</span>
            </p>
          )}
          {item.description && (
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={onComplete}
            className="min-h-[44px] flex-1 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition touch-manipulation"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Segna Completato</span>
          </button>
          {isOrder && onStartOrder && (
            <button
              type="button"
              onClick={onStartOrder}
              className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation"
            >
              <PlusCircle className="w-4 h-4 text-red-600" />
              <span>Apri Carico</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
