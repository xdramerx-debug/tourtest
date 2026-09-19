import React, { type ReactNode, type ButtonHTMLAttributes, type HTMLAttributes } from 'react';

/** Базовые примитивы DS. Тач-таргеты ≥48px (NFR §5) — гарантируются ds.css классами. */

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'ghost' | 'danger' | 'quiet';
  size?: 'md' | 'lg' | 'xl';
  block?: boolean;
}
export function Button({ variant = 'primary', size = 'md', block, className = '', ...rest }: BtnProps) {
  return <button type="button" className={`ds-btn ds-btn--${variant} ds-btn--${size} ${block ? 'ds-btn--block' : ''} ${className}`} {...rest} />;
}

export function IconButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`ds-iconbtn ${className}`} {...rest} />;
}

export function Card({ className = '', interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={`ds-card ${interactive ? 'ds-card--int' : ''} ${className}`} {...rest} />;
}

export function Chip({ className = '', active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button type="button" aria-pressed={active || undefined} className={`ds-chip ${active ? 'is-active' : ''} ${className}`} {...rest} />;
}

export function Badge({ tone = 'muted', live, children }: { tone?: 'muted' | 'primary' | 'danger' | 'accent' | 'good'; live?: boolean; children: ReactNode }) {
  return (
    <span className={`ds-badge ds-badge--${tone} ${live ? 'is-live' : ''}`}>
      {live ? <span className="ds-livedot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="ds-segment" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value}
          className={`ds-segment__item ${o.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="ds-field">
      <span className="ds-field__label">{label}</span>
      {children}
      {hint && !error ? <span className="ds-field__hint">{hint}</span> : null}
      {error ? <span className="ds-field__error" role="alert">{error}</span> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="ds-input" {...props} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="ds-input" {...props} />;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`ds-switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}>
      <span className="ds-switch__thumb" />
      <span className="ds-switch__label">{label}</span>
    </button>
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  if (!open) return null;
  return (
    <div className="ds-sheetwrap" role="presentation" onClick={onClose}>
      <div className="ds-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="ds-sheet__handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

export interface SyncBarProps {
  state: 'connecting' | 'online' | 'offline';
  queued: number;
  dataAt?: string;
  labels: { online: string; offline: string; queued: string; dataAt: string };
}
export function OfflineBar({ state, queued, dataAt, labels }: SyncBarProps) {
  return (
    <div className={`ds-sync is-${state}`} role="status" aria-live="polite">
      <span className="ds-sync__dot" aria-hidden="true" />
      <span className="ds-sync__text">
        {state === 'online' ? labels.online : state === 'offline' ? labels.offline : '…'}
        {queued > 0 ? ` · ${labels.queued.replace('{{n}}', String(queued))}` : ''}
        {state === 'offline' && dataAt ? ` · ${labels.dataAt.replace('{{time}}', dataAt)}` : ''}
      </span>
    </div>
  );
}

export function Skeleton({ w = '60%', h = 16 }: { w?: string; h?: number }) {
  return <span className="ds-skel" style={{ width: w, height: h }} aria-hidden="true" />;
}

/** Бегущая строка для Broadcast (D2) — CSS-анимация, reduced-motion гасится. */
export function Ticker({ items, ariaLabel }: { items: ReactNode[]; ariaLabel: string }) {
  return (
    <div className="ds-ticker" aria-label={ariaLabel}>
      <div className="ds-ticker__track">
        {items.concat(items).map((it, i) => <span className="ds-ticker__item" key={i}>{it}</span>)}
      </div>
    </div>
  );
}

/** Подсветка дельты (смена строки лидерборда): класс is-delta на ~3с. */
export function useDeltaFlag(dep: unknown): boolean {
  const [on, setOn] = React.useState(false);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    setOn(true);
    const t = setTimeout(() => setOn(false), 3000);
    return () => clearTimeout(t);
  }, [dep]);
  return on;
}
