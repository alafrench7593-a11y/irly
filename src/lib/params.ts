/**
 * One value of a link's query parameter. A parameter repeated in the link
 * (`?q=a&q=b`, often added by a tracker) comes from expo-router as a list:
 * the first value is used, so a screen never calls `.trim()` on an array.
 */
export const firstParam = (v: string | string[] | undefined | null): string | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));
