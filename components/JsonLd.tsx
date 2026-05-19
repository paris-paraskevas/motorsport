// SSR'd <script type="application/ld+json"> element. One per call.
//
// The `<` -> `<` escape blocks an HTML-parser-level breakout if any
// user-controlled string ever sneaks `</script>` into a JSON-LD payload.
// JSON.parse handles < transparently, so consumers see the original
// character.

export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
