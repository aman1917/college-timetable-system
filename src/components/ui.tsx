'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// ------------------------------------------------------------------ toast ---

interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error';
}
const ToastContext = createContext<(message: string, tone?: 'ok' | 'error') => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md whitespace-pre-line rounded-lg px-4 py-2.5 text-sm shadow-lg ${
              t.tone === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-surface'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ------------------------------------------------------------------ modal ---

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="no-print fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/55 p-4 sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`panel w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold">{title}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">{footer}</div> : null}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- confirm ----

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className={danger ? 'btn-danger' : 'btn-brand'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="whitespace-pre-line text-sm text-muted">{message}</p>
    </Modal>
  );
}

// ------------------------------------------------------------ page header ---

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-bold">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="panel p-10 text-center text-sm text-muted">{message}</div>;
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="p-10 text-center text-sm text-muted">{label}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'PUBLISHED'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : status === 'REVIEW'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : status === 'ARCHIVED'
          ? 'bg-slate-500/15 text-muted'
          : 'bg-brand/15 text-brand';
  return <span className={`badge ${tone}`}>{status}</span>;
}

// ------------------------------------------------------------------ field ---

export type FieldType =
  | 'text' | 'number' | 'email' | 'date' | 'time'
  | 'textarea' | 'select' | 'color' | 'checkbox';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  /** Hide the field entirely based on other values (e.g. part-time only). */
  hidden?: (values: Record<string, unknown>) => boolean;
}

export function Field({
  def,
  value,
  onChange,
  values,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  values: Record<string, unknown>;
}) {
  if (def.hidden?.(values)) return null;
  const id = `field-${def.key}`;

  const common = 'field';
  let input: React.ReactNode;

  switch (def.type) {
    case 'textarea':
      input = (
        <textarea
          id={id}
          className={common}
          rows={3}
          value={(value as string) ?? ''}
          placeholder={def.placeholder}
          onChange={(e) => onChange(def.key, e.target.value)}
        />
      );
      break;
    case 'select':
      input = (
        <select
          id={id}
          className={common}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(def.key, e.target.value)}
        >
          <option value="">Select…</option>
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'checkbox':
      input = (
        <label className="flex items-center gap-2 text-sm">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(def.key, e.target.checked)}
          />
          <span>{def.placeholder ?? 'Yes'}</span>
        </label>
      );
      break;
    case 'color':
      input = (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            className="h-9 w-16 rounded border border-line bg-surface p-0.5"
            value={(value as string) || '#6366f1'}
            onChange={(e) => onChange(def.key, e.target.value)}
          />
          <span className="font-mono text-xs text-muted">{(value as string) || '#6366f1'}</span>
        </div>
      );
      break;
    case 'number':
      input = (
        <input
          id={id}
          type="number"
          className={common}
          value={value === null || value === undefined ? '' : String(value)}
          placeholder={def.placeholder}
          onChange={(e) => onChange(def.key, e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
      break;
    default:
      input = (
        <input
          id={id}
          type={def.type}
          className={common}
          value={(value as string) ?? ''}
          placeholder={def.placeholder}
          onChange={(e) => onChange(def.key, e.target.value)}
        />
      );
  }

  return (
    <div className="mb-3">
      {def.type !== 'checkbox' ? (
        <label className="label" htmlFor={id}>
          {def.label}
          {def.required ? ' *' : ''}
        </label>
      ) : (
        <span className="label">{def.label}</span>
      )}
      {input}
      {def.help ? <p className="mt-1 text-xs text-muted">{def.help}</p> : null}
    </div>
  );
}
