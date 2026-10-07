// Imports real restaurants and cafés from Google Places (API "Places New")
// into public.places, area by area. Runs in GitHub Actions so the Google key
// never ships in the app. Ratings, review counts, hours and photos come from
// Google, refreshed on every run (fetched_at), never typed by hand.
//
// Env: GOOGLE_PLACES_API_KEY, SUPABASE_ACCESS_TOKEN (sbp_...),
//      SUPABASE_PROJECT_REF (default: the IRLY project), PLACES_CITY (bali|dubai|all).
import process from 'node:process';
import { deriveTags } from './place-tags.mjs';

const key = (process.env.GOOGLE_PLACES_API_KEY || '').trim();
const raw = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const token = raw.match(/sbp_[^\s"'`]+/)?.[0] ?? '';
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
const only = process.env.PLACES_CITY || 'all';
if (!key || !token) {
  console.log('GOOGLE_PLACES_API_KEY or SUPABASE_ACCESS_TOKEN missing: nothing synced.');
  process.exit(0);
}

const AREAS = {
  bali: ['canggu', 'berawa', 'pererenan', 'seminyak', 'kerobokan', 'kuta', 'jimbaran', 'uluwatu', 'bingin', 'nusadua', 'sanur', 'ubud', 'amed', 'lovina'],
  dubai: ['marina', 'jlt', 'jbr', 'downtown', 'difc', 'businessbay', 'jumeirah', 'palm', 'hills', 'citywalk', 'alquoz'],
};
const LABEL = { nusadua: 'Nusa Dua', jlt: 'JLT', jbr: 'JBR', difc: 'DIFC', businessbay: 'Business Bay', palm: 'Palm Jumeirah', hills: 'Dubai Hills', citywalk: 'City Walk', alquoz: 'Al Quoz' };
const CITY = { bali: 'Bali, Indonesia', dubai: 'Dubai, United Arab Emirates' };
const QUERIES = ['restaurants', 'cafes and brunch', 'family friendly restaurants'];

// Google place types → IRLY cuisines / tags.
const CUISINE = {
  indonesian_restaurant: 'indonesian', italian_restaurant: 'italian', japanese_restaurant: 'japanese', korean_restaurant: 'korean',
  thai_restaurant: 'thai', vietnamese_restaurant: 'vietnamese', chinese_restaurant: 'chinese', indian_restaurant: 'indian',
  middle_eastern_restaurant: 'middle_eastern', lebanese_restaurant: 'middle_eastern', mexican_restaurant: 'mexican',
  american_restaurant: 'american', mediterranean_restaurant: 'mediterranean', greek_restaurant: 'mediterranean', french_restaurant: 'french',
  vegan_restaurant: 'vegan', vegetarian_restaurant: 'vegetarian', seafood_restaurant: 'seafood', steak_house: 'steakhouse',
  pizza_restaurant: 'pizza', hamburger_restaurant: 'burger', bakery: 'bakery', dessert_shop: 'dessert', ice_cream_shop: 'dessert',
  sushi_restaurant: 'sushi', ramen_restaurant: 'japanese', brunch_restaurant: 'brunch', breakfast_restaurant: 'brunch',
  fine_dining_restaurant: 'fine_dining', cafe: 'cafe', coffee_shop: 'coffee', bar: 'bar', health_food_store: 'healthy',
};
const PRICE = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };
const FIELDS = [
  'places.id', 'places.displayName', 'places.rating', 'places.userRatingCount', 'places.priceLevel', 'places.formattedAddress',
  'places.location', 'places.regularOpeningHours', 'places.websiteUri', 'places.nationalPhoneNumber', 'places.types', 'places.photos',
  'places.goodForChildren', 'places.menuForChildren', 'places.servesVegetarianFood', 'places.servesBreakfast', 'places.servesBrunch',
  'places.servesLunch', 'places.servesDinner', 'places.outdoorSeating', 'places.liveMusic', 'places.reservable', 'places.businessStatus',
].join(',');

async function google(q, lat, lng) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({
      textQuery: q,
      maxResultCount: 20,
      ...(lat != null ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 2500 } } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).places ?? [];
}

async function photoUrl(name) {
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&skipHttpRedirect=true`, { headers: { 'X-Goog-Api-Key': key } });
  if (!res.ok) return null;
  return (await res.json()).photoUri ?? null;
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : [];
}
const lit = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(lit).join(',')}]::text[]`;

let total = 0;
for (const city of Object.keys(AREAS)) {
  if (only !== 'all' && only !== city) continue;
  const coords = await sql(`select id, lat, lng from public.areas where city_id = ${lit(city)}`);
  for (const area of AREAS[city]) {
    const at = coords.find((c) => c.id === area);
    const seen = new Set();
    for (const q of QUERIES) {
      const places = await google(`${q} in ${LABEL[area] ?? area[0].toUpperCase() + area.slice(1)}, ${CITY[city]}`, at?.lat, at?.lng);
      for (const p of places) {
        if (seen.has(p.id) || p.businessStatus === 'CLOSED_PERMANENTLY') continue;
        seen.add(p.id);
        const types = p.types ?? [];
        const cuisines = [...new Set(types.map((t) => CUISINE[t]).filter(Boolean))];
        const kind = types.includes('cafe') || types.includes('coffee_shop') ? 'cafe' : 'restaurant';
        const tags = [
          p.goodForChildren || p.menuForChildren ? 'kids' : null,
          p.servesBreakfast ? 'breakfast' : null,
          p.servesBrunch ? 'brunch' : null,
          p.servesLunch ? 'lunch' : null,
          p.servesDinner ? 'dinner' : null,
          p.servesVegetarianFood ? 'vegetarian' : null,
          p.liveMusic ? 'live_music' : null,
          p.outdoorSeating ? 'outdoor' : null,
          ...deriveTags({ name: p.displayName?.text ?? '', types, hours: p.regularOpeningHours }),
        ].filter(Boolean);
        // Derived cuisines (Balinese, Indonesian, healthy…) are searchable as cuisines too.
        for (const c of ['balinese', 'indonesian', 'healthy', 'vegan']) if (tags.includes(c) && !cuisines.includes(c)) cuisines.push(c);
        const photos = [];
        for (const ph of (p.photos ?? []).slice(0, 3)) {
          const u = await photoUrl(ph.name);
          if (u) photos.push(u);
        }
        const amenities = {
          good_for_children: Boolean(p.goodForChildren || p.menuForChildren),
          reservable: Boolean(p.reservable),
          outdoor_seating: Boolean(p.outdoorSeating),
          live_music: Boolean(p.liveMusic),
          attributions: (p.photos ?? []).slice(0, 3).flatMap((ph) => (ph.authorAttributions ?? []).map((a) => a.displayName)),
        };
        await sql(`
          insert into public.places (slug, city_id, area_id, name, kind, category_id, tags, cuisines, types, lat, lng, provider, provider_place_id,
            rating, review_count, price_level, address, phone, website, opening_hours, photos, amenities, fetched_at)
          values (${lit(`g-${p.id}`)}, ${lit(city)}, ${lit(area)}, ${lit(p.displayName?.text ?? 'Restaurant')}, ${lit(kind)}, 'food',
            ${arr([...new Set(tags)])}, ${arr(cuisines)}, ${arr(types)}, ${p.location?.latitude ?? 'null'}, ${p.location?.longitude ?? 'null'}, 'google', ${lit(p.id)},
            ${p.rating ?? 'null'}, ${p.userRatingCount ?? 'null'}, ${PRICE[p.priceLevel] ?? 'null'}, ${lit(p.formattedAddress)},
            ${lit(p.nationalPhoneNumber)}, ${lit(p.websiteUri)}, ${lit(p.regularOpeningHours ? JSON.stringify(p.regularOpeningHours) : null)}::jsonb,
            ${arr(photos)}, ${lit(JSON.stringify(amenities))}::jsonb, now())
          on conflict (slug) do update set
            name = excluded.name, kind = excluded.kind, tags = excluded.tags, cuisines = excluded.cuisines, types = excluded.types,
            rating = excluded.rating, review_count = excluded.review_count, price_level = excluded.price_level, address = excluded.address,
            phone = excluded.phone, website = excluded.website, opening_hours = excluded.opening_hours, photos = excluded.photos,
            amenities = excluded.amenities, fetched_at = now()`);
        total++;
      }
    }
    console.log(`✓ ${city}/${area}: ${seen.size} places`);
  }
}
console.log(`Done: ${total} places synced from Google Places.`);
