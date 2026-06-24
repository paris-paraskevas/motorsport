'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

// Collapsible labelled section — used on the Account page to declutter the
// notifications + followed-series surfaces. The header is a real <button>
// (keyboard-operable + aria-expanded); the body unmounts when collapsed.
export function Accordion({
  title,
  subtitle,
  count,
  icon,
  defaultOpen = false,
  titleClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  titleClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-4 text-left"
      >
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className={`block text-text text-base font-semibold ${titleClassName ?? ''}`}>{title}</span>
          {subtitle && <span className="mt-1 block text-text-faint text-xs leading-relaxed">{subtitle}</span>}
        </span>
        {count != null && (
          <span className="shrink-0 text-xs font-medium text-text-muted tabular-nums">{count}</span>
        )}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 text-text-muted transition-transform duration-(--duration-fast) ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="pb-5 md:pb-6">{children}</div>}
    </div>
  );
}
