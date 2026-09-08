'use client';

import dynamic from 'next/dynamic';

// The designer is loaded in the browser only. `ssr: false` keeps the editor,
// its tables and previews out of the Worker bundle entirely: the page ships this
// small loader and the browser fetches the rest (field guide §03, "the designer
// UI ships as client-only chunks so the editor never enters the Worker bundle").
const Designer = dynamic(() => import('./Designer').then(m => m.Designer), {
  ssr: false,
  loading: () => (
    <p className="p-6 font-mono text-[11px] uppercase tracking-[0.16em] text-text-faint">Loading the designer…</p>
  ),
});

export function DesignerLoader(props: React.ComponentProps<typeof Designer>) {
  return <Designer {...props} />;
}
