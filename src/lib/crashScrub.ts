/** What a crash report may say (lib/crashReport): no ids, numbers, quoted text, emails or links. */

export function scrubRoute(pathname: string): string {
  return pathname
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/[^/]*\d[^/]*/g, '/:id')
    .slice(0, 80);
}

/** The first line of an error message with everything personal taken out. */
export function scrubDetail(message: unknown): string {
  if (typeof message !== 'string') return '';
  return message
    .split('\n')[0]
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\S+@\S+/g, '<email>')
    .replace(/"[^"]*"|`[^`]*`|«[^»]*»/g, '<text>')
    // A short identifier in single quotes (a property name) helps; anything else is text.
    .replace(/'([^']*)'/g, (_m, inner: string) => (/^[A-Za-z_$][\w$.]{0,30}$/.test(inner) ? `'${inner}'` : '<text>'))
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\d{2,}/g, '#')
    .slice(0, 80);
}
