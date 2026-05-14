'use client';
import { Coffee, Mail, Settings } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import type { SeriesMeta } from '@/lib/types';
import { openContactModal } from './ContactModal';
import { SettingsClient } from './SettingsClient';

const COFFEE_URL = process.env.NEXT_PUBLIC_COFFEE_URL || 'https://buymeacoffee.com/parisp';

export function HeaderUtils({
  className = '',
  seriesList,
}: {
  className?: string;
  seriesList: SeriesMeta[];
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={openContactModal}
        aria-label="Contact"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
      >
        <Mail size={13} />
        <span className="hidden sm:inline">Contact</span>
      </button>
      <a
        href={COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy me a coffee"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-950 bg-amber-300 hover:bg-amber-200 rounded-full px-3 py-1.5 transition-colors shadow-sm shadow-amber-500/20"
      >
        <Coffee size={13} />
        <span className="hidden sm:inline">Buy me a coffee</span>
        <span className="sm:hidden">Coffee</span>
      </a>
      <UserButton
        appearance={{ elements: { avatarBox: 'w-8 h-8' } }}
      >
        <UserButton.UserProfilePage
          label="Preferences"
          url="preferences"
          labelIcon={<Settings size={14} />}
        >
          <div className="paddock-prefs">
            <SettingsClient seriesList={seriesList} />
          </div>
        </UserButton.UserProfilePage>
      </UserButton>
    </div>
  );
}
