import { ChevronRight } from 'lucide-react';

// A native disclosure section. Server-rendered, zero client JS: `<details>`
// owns the open/closed state and the browser toggles it natively, so the
// content is in the DOM (SEO-visible) and works without JavaScript. The
// summary doubles as the section's <h2>, matching the page's heading style.
// `defaultOpen` maps straight to the `open` attribute — rendered when true,
// omitted when false.
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group mt-10">
      <summary className="flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none">
        <ChevronRight className="h-4 w-4 shrink-0 text-text-faint transition-transform duration-(--duration-fast) group-open:rotate-90" />
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">{title}</h2>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
