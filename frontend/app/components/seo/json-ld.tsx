/**
 * Renders a JSON-LD block. The single place in the app allowed to emit
 * `application/ld+json`, so escaping is enforced in one spot.
 */

/** The `<` JSON escape sequence, assembled so this file never contains a literal `<`. */
const ESCAPED_LT = `\\u00${'3c'}`;

/**
 * Escapes `<` to `<`. That is still valid JSON and parses back to the same
 * string, but it can no longer terminate the surrounding `<script>` element — without
 * it, any product or FAQ string containing a closing script tag would break out of
 * the block and become executable markup.
 */
function serialize(data: unknown): string {
  return JSON.stringify(data).replaceAll('<', ESCAPED_LT);
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      // JSON-LD has to be injected as raw text: React would HTML-escape a string child,
      // producing &quot; inside the JSON and breaking every parser that reads it. The
      // payload is built server-side from typed schema builders and every `<` is escaped
      // by `serialize` above, so it cannot close this element or introduce markup.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
      type="application/ld+json"
    />
  );
}
