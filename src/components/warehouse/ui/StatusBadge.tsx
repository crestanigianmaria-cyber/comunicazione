import React from 'react';
import { CheckCircle2, Clock, Inbox, Layers, Warehouse, FileText } from 'lucide-react';
import {
  OrderStatus,
  CommitmentStatus,
  WarehouseLocation,
  OrderDocumentType,
  ORDER_DOCUMENT_LABELS,
} from '../../../types';

export const OrderStatusBadge: React.FC<{ status: OrderStatus; compact?: boolean }> = ({
  status,
  compact = false,
}) => {
  if (status === 'NUOVO') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 font-mono font-extrabold uppercase text-red-700 ${
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        }`}
      >
        <Inbox className="w-3 h-3 shrink-0" />
        <span>NUOVO</span>
      </span>
    );
  }
  if (status === 'PRESO IN CARICO') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 font-mono font-extrabold uppercase text-amber-900 ${
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        }`}
      >
        <Clock className="w-3 h-3 shrink-0" />
        <span>IN CARICO</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 font-mono font-extrabold uppercase text-emerald-800 ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      <CheckCircle2 className="w-3 h-3 shrink-0" />
      <span>COMPLETATO</span>
    </span>
  );
};

export const CommitmentStatusBadge: React.FC<{ status: CommitmentStatus }> = ({ status }) => {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-extrabold uppercase border ${
        status === 'CARICATO'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-amber-50 text-amber-900 border-amber-200'
      }`}
    >
      {status === 'CARICATO' ? 'CARICATO' : 'ATTIVO'}
    </span>
  );
};

export const LocationBadge: React.FC<{ location?: WarehouseLocation | null }> = ({ location }) => {
  const isDeposito = location === 'DEPOSITO';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold uppercase border ${
        isDeposito
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {isDeposito ? <Layers className="w-3 h-3 shrink-0" /> : <Warehouse className="w-3 h-3 shrink-0" />}
      <span>{isDeposito ? 'DEPOSITO' : 'MAGAZZINO'}</span>
    </span>
  );
};

export const DocumentTypeBadge: React.FC<{ documentType?: OrderDocumentType | null }> = ({
  documentType,
}) => {
  const label = documentType ? ORDER_DOCUMENT_LABELS[documentType] : 'DDT';
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-800">
      <FileText className="w-3 h-3 text-red-600 shrink-0" />
      <span>{label}</span>
    </span>
  );
};
