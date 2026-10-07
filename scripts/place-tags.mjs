// Tags IRLY derives from provider data (names, types, hours) for filters
// Google does not offer: warung, Balinese, beach, beach club, rooftop,
// late night, coffee/work-friendly. Conservative on purpose: a tag is only
// added when the name or type says so explicitly. Tested in check-bali.mts.

const NAME_TAGS = [
  [/\bwarung\b/i, ['warung', 'indonesian']],
  [/\b(balinese|bali(nese)? kitchen|babi guling|bebek|ayam betutu)\b/i, ['balinese', 'indonesian']],
  [/\bbeach ?club\b/i, ['beach_club', 'beach']],
  [/\b(beach|pantai|beachfront|seaside|ocean)\b/i, ['beach']],
  [/\brooftop|sky ?bar|roof\b/i, ['rooftop']],
  [/\b(cowork|co-work|laptop|work ?caf[eé])\b/i, ['work_friendly']],
  [/\b(healthy|organic|salad|bowl|juice|plant[- ]based)\b/i, ['healthy']],
  [/\bvegan\b/i, ['vegan']],
  [/\b(brunch|breakfast)\b/i, ['brunch']],
];

const TYPE_TAGS = {
  indonesian_restaurant: ['indonesian'],
  vegan_restaurant: ['vegan', 'healthy'],
  vegetarian_restaurant: ['vegetarian', 'healthy'],
  coffee_shop: ['coffee'],
  cafe: ['coffee'],
  night_club: ['late_night'],
  bar: ['late_night'],
};

/** Open at or after 23:00 on at least one day (Google periods). */
export function lateNight(hours) {
  const periods = hours?.periods ?? [];
  return periods.some((p) => {
    if (!p.close) return true;
    const open = p.open.day * 1440 + p.open.hour * 60 + (p.open.minute ?? 0);
    let close = p.close.day * 1440 + p.close.hour * 60 + (p.close.minute ?? 0);
    if (close <= open) close += 7 * 1440;
    const day = Math.floor(open / 1440) * 1440;
    return close >= day + 23 * 60;
  });
}

export function deriveTags({ name = '', types = [], hours = null }) {
  const out = new Set();
  for (const [re, tags] of NAME_TAGS) if (re.test(name)) tags.forEach((t) => out.add(t));
  for (const t of types) (TYPE_TAGS[t] ?? []).forEach((x) => out.add(x));
  if (lateNight(hours)) out.add('late_night');
  return [...out];
}
