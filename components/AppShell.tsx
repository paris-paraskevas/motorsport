'use client';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SeriesMeta } from '@/lib/types';

export function AppShell({
  children,
  seriesList,
}: {
  children: React.ReactNode;
  seriesList: SeriesMeta[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // lock body scroll when drawer open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-900/80">
        <div className="max-w-2xl mx-auto px-3 h-14 flex items-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="p-2 -ml-2 text-zinc-300 hover:text-zinc-100 rounded-lg hover:bg-zinc-900 transition-colors"
          >
            <Menu size={22} />
          </button>
          <Link
            href="/"
            className="ml-2 text-zinc-100 font-semibold text-base tracking-tight"
          >
            Motorsport
          </Link>
        </div>
      </header>

      <main>{children}</main>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-80 max-w-[85vw] bg-zinc-950 border-r border-zinc-900 p-4 overflow-y-auto transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-zinc-100 font-semibold text-lg tracking-tight">Motorsport</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="p-2 -mr-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-900 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-0.5">
          <DrawerLink href="/" active={pathname === '/'} label="Home" />

          <DrawerLabel>Championships</DrawerLabel>
          {seriesList.map(s => (
            <DrawerLink
              key={s.slug}
              href={`/series/${s.slug}`}
              active={pathname === `/series/${s.slug}`}
              label={s.name}
              dot={s.color}
            />
          ))}

          <DrawerLabel>More</DrawerLabel>
          <DrawerLink href="/about" active={pathname === '/about'} label="About" />
        </nav>
      </aside>
    </>
  );
}

function DrawerLink({
  href,
  active,
  label,
  dot,
}: {
  href: string;
  active: boolean;
  label: string;
  dot?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
        active ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-900/70 hover:text-zinc-100'
      }`}
    >
      {dot && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: dot }}
        />
      )}
      <span className={`font-medium ${dot ? '' : 'ml-[20px]'}`}>{label}</span>
    </Link>
  );
}

function DrawerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-5 pb-1 px-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">
      {children}
    </div>
  );
}
