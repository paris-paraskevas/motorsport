import type { EmbedSpec } from '@/lib/blog-embeds';
import { ChartEmbed, EmbedNote } from './ChartEmbed';

// Server dispatcher for a `[[type ...]]` blog shortcode. Each embed is a data
// widget, not article prose, so the frame opts out of the surrounding `prose`
// typography (`not-prose`) and owns its own vertical rhythm between paragraphs.
// Unknown types fail soft to a muted note so a typo in a draft never breaks the
// post render.
export function BlogEmbed({ spec }: { spec: EmbedSpec }) {
  return <div className="not-prose my-8">{renderEmbed(spec)}</div>;
}

function renderEmbed(spec: EmbedSpec) {
  switch (spec.type) {
    case 'chart':
      return <ChartEmbed series={spec.args.series} />;
    default:
      return <EmbedNote>Unknown embed “{spec.type}”.</EmbedNote>;
  }
}
