import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8 px-4' : 'py-12 px-5'
      }`}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200/80 text-slate-400 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 stroke-[1.75]" />
      </div>
      <p className="text-sm font-extrabold text-slate-800">{title}</p>
      {description && (
        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="space-y-2.5 animate-pulse" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between gap-3"
        >
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 rounded bg-slate-200" />
              <div className="h-4 w-12 rounded bg-slate-100" />
            </div>
            <div className="h-4 w-3/4 rounded bg-slate-200/80" />
          </div>
          <div className="h-10 w-24 rounded-xl bg-slate-200 shrink-0" />
        </div>
      ))}
    </div>
  );
};
