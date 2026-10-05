-- IRLY Bali + IRLY Moms, added on top of the existing model (no new
-- event, chat or community system):
-- - Bali geography: administrative units kept apart from the destination
--   areas people search for (Badung → Canggu → Berawa).
-- - Area profiles (editorial IRLY Guide, never official claims, no prices).
-- - Sourced guides (visa, housing...) with official / guide / third-party
--   kinds and verification dates; "My move" checklist per member.
-- - Places from a data provider (ratings, hours, cuisines) and an
--   explainable ranking; restaurants become social through activities.
-- - Activities get a type (PLAYDATE, DINNER...) and an audience (all,
--   girls, moms). IRLY Moms lives inside IRLY Girl (same eligibility).

-- ───────────────────────── Administrative geography ─────────────────────────

create table if not exists public.admin_areas (
  id text primary key,
  country_id text not null references public.countries (id) on delete cascade,
  parent_id text references public.admin_areas (id) on delete cascade,
  level text not null check (level in ('province', 'regency', 'city', 'district', 'village')),
  name text not null,
  official_name text
);
alter table public.admin_areas enable row level security;
drop policy if exists admin_areas_read on public.admin_areas;
create policy admin_areas_read on public.admin_areas for select to anon, authenticated using (true);
drop policy if exists admin_areas_admin on public.admin_areas;
create policy admin_areas_admin on public.admin_areas for all to authenticated using (private.is_admin()) with check (private.is_admin());

insert into public.admin_areas (id, country_id, parent_id, level, name, official_name) values
  ('id-bali', 'id', null, 'province', 'Bali', 'Provinsi Bali'),
  ('id-bali-jembrana', 'id', 'id-bali', 'regency', 'Jembrana', 'Kabupaten Jembrana'),
  ('id-bali-tabanan', 'id', 'id-bali', 'regency', 'Tabanan', 'Kabupaten Tabanan'),
  ('id-bali-badung', 'id', 'id-bali', 'regency', 'Badung', 'Kabupaten Badung'),
  ('id-bali-gianyar', 'id', 'id-bali', 'regency', 'Gianyar', 'Kabupaten Gianyar'),
  ('id-bali-klungkung', 'id', 'id-bali', 'regency', 'Klungkung', 'Kabupaten Klungkung'),
  ('id-bali-bangli', 'id', 'id-bali', 'regency', 'Bangli', 'Kabupaten Bangli'),
  ('id-bali-karangasem', 'id', 'id-bali', 'regency', 'Karangasem', 'Kabupaten Karangasem'),
  ('id-bali-buleleng', 'id', 'id-bali', 'regency', 'Buleleng', 'Kabupaten Buleleng'),
  ('id-bali-denpasar', 'id', 'id-bali', 'city', 'Denpasar', 'Kota Denpasar')
on conflict (id) do nothing;

-- Destination areas point at their administrative unit, and neighbourhoods
-- at the area people know them by (Berawa is in Canggu).
alter table public.areas
  add column if not exists admin_area_id text references public.admin_areas (id) on delete set null,
  add column if not exists parent_area_id text,
  add column if not exists kind text not null default 'area' check (kind in ('area', 'neighborhood', 'island', 'town')),
  add column if not exists sort integer not null default 100;

insert into public.areas (city_id, id, name, lat, lng, admin_area_id, parent_area_id, kind, sort) values
  ('bali', 'canggu', 'Canggu', -8.6478, 115.1385, 'id-bali-badung', null, 'area', 1),
  ('bali', 'berawa', 'Berawa', -8.6620, 115.1430, 'id-bali-badung', 'canggu', 'neighborhood', 2),
  ('bali', 'pererenan', 'Pererenan', -8.6390, 115.1240, 'id-bali-badung', 'canggu', 'neighborhood', 3),
  ('bali', 'seseh', 'Seseh', -8.6450, 115.1100, 'id-bali-badung', 'canggu', 'neighborhood', 4),
  ('bali', 'cemagi', 'Cemagi', -8.6330, 115.1030, 'id-bali-badung', 'canggu', 'neighborhood', 5),
  ('bali', 'tibubeneng', 'Tibubeneng', -8.6530, 115.1500, 'id-bali-badung', 'canggu', 'neighborhood', 6),
  ('bali', 'umalas', 'Umalas', -8.6650, 115.1650, 'id-bali-badung', 'canggu', 'neighborhood', 7),
  ('bali', 'kerobokan', 'Kerobokan', -8.6720, 115.1580, 'id-bali-badung', null, 'area', 8),
  ('bali', 'seminyak', 'Seminyak', -8.6913, 115.1683, 'id-bali-badung', null, 'area', 9),
  ('bali', 'petitenget', 'Petitenget', -8.6800, 115.1560, 'id-bali-badung', 'seminyak', 'neighborhood', 10),
  ('bali', 'legian', 'Legian', -8.7040, 115.1710, 'id-bali-badung', null, 'area', 11),
  ('bali', 'kuta', 'Kuta', -8.7220, 115.1720, 'id-bali-badung', null, 'area', 12),
  ('bali', 'jimbaran', 'Jimbaran', -8.7900, 115.1600, 'id-bali-badung', null, 'area', 13),
  ('bali', 'kedonganan', 'Kedonganan', -8.7600, 115.1700, 'id-bali-badung', 'jimbaran', 'neighborhood', 14),
  ('bali', 'uluwatu', 'Uluwatu', -8.8291, 115.0849, 'id-bali-badung', null, 'area', 15),
  ('bali', 'bingin', 'Bingin', -8.8060, 115.1130, 'id-bali-badung', 'uluwatu', 'neighborhood', 16),
  ('bali', 'ungasan', 'Ungasan', -8.8300, 115.1650, 'id-bali-badung', 'uluwatu', 'neighborhood', 17),
  ('bali', 'pecatu', 'Pecatu', -8.8130, 115.1150, 'id-bali-badung', 'uluwatu', 'neighborhood', 18),
  ('bali', 'nusadua', 'Nusa Dua', -8.8000, 115.2300, 'id-bali-badung', null, 'area', 19),
  ('bali', 'sanur', 'Sanur', -8.6900, 115.2620, 'id-bali-denpasar', null, 'area', 20),
  ('bali', 'denpasar', 'Denpasar', -8.6500, 115.2167, 'id-bali-denpasar', null, 'town', 21),
  ('bali', 'ubud', 'Ubud', -8.5069, 115.2625, 'id-bali-gianyar', null, 'area', 22),
  ('bali', 'tegallalang', 'Tegallalang', -8.4340, 115.2790, 'id-bali-gianyar', 'ubud', 'neighborhood', 23),
  ('bali', 'payangan', 'Payangan', -8.4300, 115.2400, 'id-bali-gianyar', 'ubud', 'neighborhood', 24),
  ('bali', 'kintamani', 'Kintamani', -8.2500, 115.3300, 'id-bali-bangli', null, 'area', 25),
  ('bali', 'sidemen', 'Sidemen', -8.4800, 115.4400, 'id-bali-karangasem', null, 'area', 26),
  ('bali', 'amed', 'Amed', -8.3400, 115.6500, 'id-bali-karangasem', null, 'area', 27),
  ('bali', 'candidasa', 'Candidasa', -8.5100, 115.5700, 'id-bali-karangasem', null, 'area', 28),
  ('bali', 'padangbai', 'Padang Bai', -8.5300, 115.5100, 'id-bali-karangasem', null, 'town', 29),
  ('bali', 'lovina', 'Lovina', -8.1600, 115.0250, 'id-bali-buleleng', null, 'area', 30),
  ('bali', 'munduk', 'Munduk', -8.2650, 115.0700, 'id-bali-buleleng', null, 'area', 31),
  ('bali', 'singaraja', 'Singaraja', -8.1120, 115.0880, 'id-bali-buleleng', null, 'town', 32),
  ('bali', 'tanahlot', 'Tanah Lot', -8.6210, 115.0870, 'id-bali-tabanan', null, 'area', 33),
  ('bali', 'bedugul', 'Bedugul', -8.2800, 115.1650, 'id-bali-tabanan', null, 'area', 34),
  ('bali', 'medewi', 'Medewi', -8.4200, 114.8100, 'id-bali-jembrana', null, 'area', 35),
  ('bali', 'nusapenida', 'Nusa Penida', -8.7300, 115.5400, 'id-bali-klungkung', null, 'island', 36),
  ('bali', 'lembongan', 'Nusa Lembongan', -8.6800, 115.4500, 'id-bali-klungkung', null, 'island', 37),
  ('bali', 'ceningan', 'Nusa Ceningan', -8.6970, 115.4510, 'id-bali-klungkung', 'lembongan', 'island', 38)
on conflict (city_id, id) do update set
  admin_area_id = excluded.admin_area_id, parent_area_id = excluded.parent_area_id,
  kind = excluded.kind, sort = excluded.sort, lat = coalesce(public.areas.lat, excluded.lat), lng = coalesce(public.areas.lng, excluded.lng);

-- ───────────────────────── Area profiles (IRLY Guide) ─────────────────────────
-- Traits are editorial 0–5 ratings written by IRLY to compare areas, shown
-- as "IRLY Guide", never as official data. No prices are stored here.

create table if not exists public.area_profiles (
  city_id text not null,
  area_id text not null,
  tagline text not null,
  vibe text not null,
  best_for text[] not null default '{}',
  not_ideal_for text[] not null default '{}',
  -- beach, surf, nightlife, coworking, wellness, family, nature, social,
  -- quiet, restaurants, traffic (5 = heavy), airport (5 = close).
  traits jsonb not null default '{}',
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  source text not null default 'IRLY Guide',
  reviewed_at date not null default current_date,
  primary key (city_id, area_id),
  foreign key (city_id, area_id) references public.areas (city_id, id) on delete cascade
);
alter table public.area_profiles enable row level security;
drop policy if exists area_profiles_read on public.area_profiles;
create policy area_profiles_read on public.area_profiles for select to anon, authenticated using (true);
drop policy if exists area_profiles_admin on public.area_profiles;
create policy area_profiles_admin on public.area_profiles for all to authenticated using (private.is_admin()) with check (private.is_admin());

insert into public.area_profiles (city_id, area_id, tagline, vibe, best_for, not_ideal_for, traits, pros, cons) values
  ('bali', 'canggu', 'Surf, cafés and the busiest social scene', 'Young, social, international',
    '{digital nomads,surfers,solo travellers,entrepreneurs}', '{people who want calm,traffic-averse}',
    '{"beach":4,"surf":5,"nightlife":4,"coworking":5,"wellness":4,"family":3,"nature":2,"social":5,"quiet":1,"restaurants":5,"traffic":5,"airport":3}',
    '{Easiest place to meet people,Many coworkings and cafés,Surf for all levels}', '{Heavy traffic at peak times,Busy and noisy in places}'),
  ('bali', 'berawa', 'Canggu with more families and padel', 'Social, a bit more settled',
    '{families,expats,padel players,remote workers}', '{people who want nature}',
    '{"beach":4,"surf":4,"nightlife":3,"coworking":5,"wellness":4,"family":4,"nature":2,"social":5,"quiet":2,"restaurants":5,"traffic":5,"airport":3}',
    '{International schools nearby,Sports and wellness everywhere}', '{Traffic,Very built up}'),
  ('bali', 'pererenan', 'Canggu''s quieter neighbour', 'Relaxed, rice fields meet cafés',
    '{couples,remote workers,long stays}', '{nightlife lovers}',
    '{"beach":4,"surf":4,"nightlife":2,"coworking":4,"wellness":4,"family":4,"nature":3,"social":4,"quiet":3,"restaurants":4,"traffic":4,"airport":2}',
    '{Calmer than Canggu,Close to Canggu''s social life}', '{Fewer evening options,Still busy roads}'),
  ('bali', 'seminyak', 'Restaurants, shopping and beach clubs', 'Polished, lively, central',
    '{food lovers,couples,short stays,shopping}', '{budget surfers,people who want nature}',
    '{"beach":4,"surf":2,"nightlife":5,"coworking":3,"wellness":3,"family":3,"nature":1,"social":4,"quiet":1,"restaurants":5,"traffic":5,"airport":4}',
    '{Dining and shopping on foot,Closer to the airport}', '{Crowded,Traffic}'),
  ('bali', 'kuta', 'Close to the airport, easy and busy', 'Touristy, energetic',
    '{first visits,short stays,beginner surfers}', '{long stays,people who want calm}',
    '{"beach":4,"surf":3,"nightlife":4,"coworking":2,"wellness":2,"family":3,"nature":1,"social":3,"quiet":1,"restaurants":3,"traffic":4,"airport":5}',
    '{Minutes from the airport,Beginner-friendly waves}', '{Very touristy,Busy}'),
  ('bali', 'jimbaran', 'Sunset seafood and calm bay', 'Laid-back, family-friendly',
    '{families,couples,airport access}', '{nightlife lovers,surfers}',
    '{"beach":4,"surf":1,"nightlife":1,"coworking":2,"wellness":3,"family":5,"nature":2,"social":2,"quiet":4,"restaurants":3,"traffic":2,"airport":5}',
    '{Calm swimming beach,Close to the airport}', '{Small social scene}'),
  ('bali', 'uluwatu', 'Cliffs, world-class surf, sunsets', 'Spacious, surf and wellness',
    '{surfers,couples,wellness,nature lovers}', '{people without a scooter,families wanting schools nearby}',
    '{"beach":5,"surf":5,"nightlife":3,"coworking":3,"wellness":4,"family":2,"nature":4,"social":3,"quiet":3,"restaurants":4,"traffic":3,"airport":3}',
    '{Spectacular beaches and cliffs,Strong surf community}', '{Spread out: you need transport,Fewer schools}'),
  ('bali', 'nusadua', 'Resorts, calm water, very easy', 'Quiet, organised, resort life',
    '{families,short stays,calm holidays}', '{social scene seekers,budget travellers}',
    '{"beach":5,"surf":2,"nightlife":1,"coworking":1,"wellness":4,"family":5,"nature":2,"social":1,"quiet":5,"restaurants":3,"traffic":1,"airport":4}',
    '{Calm beaches for kids,Well organised}', '{Resort bubble,Little local social life}'),
  ('bali', 'sanur', 'Calm beachfront, families and long stays', 'Gentle, established, walkable promenade',
    '{families,retirees,long stays,quiet remote work}', '{party seekers,surfers}',
    '{"beach":4,"surf":1,"nightlife":1,"coworking":3,"wellness":4,"family":5,"nature":2,"social":3,"quiet":5,"restaurants":4,"traffic":2,"airport":4}',
    '{Calm, walkable beachfront,Good for families,Boats to Nusa islands}', '{Quieter evenings,Little surf}'),
  ('bali', 'ubud', 'Jungle, culture, yoga and food', 'Creative, spiritual, green',
    '{wellness,culture,creatives,nature lovers}', '{beach lovers,surfers}',
    '{"beach":0,"surf":0,"nightlife":2,"coworking":4,"wellness":5,"family":3,"nature":5,"social":4,"quiet":3,"restaurants":5,"traffic":4,"airport":1}',
    '{Wellness and yoga capital,Rich culture,Green and cooler}', '{No beach,Far from the airport}'),
  ('bali', 'sidemen', 'Rice terraces and true quiet', 'Rural, slow, beautiful',
    '{retreats,nature lovers,writers}', '{social life,coworking needs}',
    '{"beach":0,"surf":0,"nightlife":0,"coworking":1,"wellness":4,"family":2,"nature":5,"social":1,"quiet":5,"restaurants":2,"traffic":1,"airport":1}',
    '{Peace and landscapes}', '{Remote,Few services}'),
  ('bali', 'amed', 'Diving, snorkelling, slow coast', 'Quiet, underwater life',
    '{divers,couples,slow travel}', '{nightlife,coworking needs}',
    '{"beach":3,"surf":0,"nightlife":0,"coworking":1,"wellness":3,"family":2,"nature":5,"social":1,"quiet":5,"restaurants":2,"traffic":1,"airport":1}',
    '{Snorkelling from the shore}', '{Far from everything}'),
  ('bali', 'lovina', 'North coast, calm and authentic', 'Local, quiet',
    '{slow travel,families,budget stays}', '{social scene seekers}',
    '{"beach":3,"surf":0,"nightlife":1,"coworking":1,"wellness":2,"family":3,"nature":4,"social":1,"quiet":5,"restaurants":2,"traffic":1,"airport":0}',
    '{Calm sea,Local feel}', '{Long drive from the south}'),
  ('bali', 'nusapenida', 'Wild cliffs and manta rays', 'Adventurous, raw',
    '{adventure,divers,short trips}', '{long stays,families with young kids}',
    '{"beach":4,"surf":1,"nightlife":0,"coworking":0,"wellness":2,"family":1,"nature":5,"social":1,"quiet":4,"restaurants":2,"traffic":2,"airport":0}',
    '{Iconic landscapes,Diving}', '{Rough roads,Boat needed}')
on conflict (city_id, area_id) do nothing;

-- ───────────────────────── Sourced guides ─────────────────────────
-- Every entry says what it is (official, IRLY guide, third-party service)
-- and where it comes from. Rules, fees and requirements are only stated
-- with a source; until verified, the app says "check the official source".

create table if not exists public.guide_articles (
  id uuid primary key default gen_random_uuid(),
  destination text not null,
  section text not null check (section in ('visa', 'housing', 'banking', 'sim', 'internet', 'transport', 'healthcare', 'insurance',
    'schools', 'childcare', 'work', 'coworking', 'business', 'accounting', 'tax', 'legal', 'real_estate', 'moving', 'pets', 'services')),
  topic text,
  title text not null,
  body text not null,
  kind text not null check (kind in ('official', 'irly_guide', 'third_party')),
  source_name text,
  source_url text check (source_url is null or source_url ~ '^https://'),
  source_date date,
  last_verified_at date,
  review_by date,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  -- Official information always cites its source.
  check (kind <> 'official' or (source_name is not null and source_url is not null))
);
create index if not exists guide_articles_idx on public.guide_articles (destination, section, sort);
alter table public.guide_articles enable row level security;
drop policy if exists guide_articles_read on public.guide_articles;
create policy guide_articles_read on public.guide_articles for select to anon, authenticated using (true);
drop policy if exists guide_articles_admin on public.guide_articles;
create policy guide_articles_admin on public.guide_articles for all to authenticated using (private.is_admin()) with check (private.is_admin());

insert into public.guide_articles (destination, section, topic, title, body, kind, source_name, source_url, sort)
select * from (values
  ('bali', 'visa', 'official', 'Indonesian e-Visa portal',
    'Visa types, requirements, fees and applications are published by the Directorate General of Immigration. Rules change: always check the current version here before you book or apply.',
    'official', 'Directorate General of Immigration, Republic of Indonesia', 'https://evisa.imigrasi.go.id/', 0),
  ('bali', 'visa', 'official', 'Indonesian Immigration website',
    'Official news, regulations and immigration office contacts, including offices in Bali.',
    'official', 'Directorate General of Immigration, Republic of Indonesia', 'https://www.imigrasi.go.id/', 1),
  ('bali', 'visa', 'how_to', 'How to read visa information on IRLY',
    'IRLY separates three things: Official (from the government, with its link), IRLY Guide (our explanations, never a legal rule) and Third-party services (agents you may hire). Fees and durations are only shown when an official source has been checked, with the date it was checked.',
    'irly_guide', null, null, 2),
  ('bali', 'visa', 'tourist', 'Tourist stays and extensions',
    'Short stays and extensions depend on your passport and the visa you hold. Check the official portal for the options open to your nationality, then ask your community in IRLY how the process went for them.',
    'irly_guide', null, null, 3),
  ('bali', 'visa', 'long_stay', 'Long stays, work, family and investment',
    'Long-stay, work, family and investor permits each have their own requirements and sponsors. Start from the official portal, and use a licensed agent if you are unsure: IRLY never gives legal advice.',
    'irly_guide', null, null, 4),
  ('bali', 'housing', 'how_to', 'Finding a place to live',
    'Visit the area before signing a long rental, see the property in person, and meet the owner or agent. Ask in your area''s IRLY community for recent experiences.',
    'irly_guide', null, null, 0),
  ('bali', 'sim', 'how_to', 'Phone and data',
    'Local SIM cards and eSIMs are widely available. Your phone must be able to use a local SIM in Indonesia: check the official rules for registering foreign phones before relying on it for a long stay.',
    'irly_guide', null, null, 0),
  ('bali', 'transport', 'how_to', 'Getting around',
    'Most people use ride-hailing apps, private drivers or scooters. Only ride with the licence and insurance that cover you.',
    'irly_guide', null, null, 0),
  ('bali', 'healthcare', 'how_to', 'Healthcare',
    'Save the contacts of an international clinic and a hospital near your area on your first day, and check what your insurance covers.',
    'irly_guide', null, null, 0),
  ('bali', 'schools', 'how_to', 'Schools and childcare',
    'Visit schools in person and ask about waiting lists early. IRLY Moms in your area can share their experience.',
    'irly_guide', null, null, 0)
) v (destination, section, topic, title, body, kind, source_name, source_url, sort)
where not exists (select 1 from public.guide_articles g where g.destination = 'bali' and g.title = v.title);

-- ───────────────────────── My move (relocation checklist) ─────────────────────────

create table if not exists public.relocation_steps (
  id text primary key,
  label text not null,
  section text,
  sort integer not null default 0
);
alter table public.relocation_steps enable row level security;
drop policy if exists relocation_steps_read on public.relocation_steps;
create policy relocation_steps_read on public.relocation_steps for select to anon, authenticated using (true);

insert into public.relocation_steps (id, label, section, sort) values
  ('visa', 'Visa', 'visa', 0), ('housing', 'Housing', 'housing', 1), ('insurance', 'Insurance', 'insurance', 2),
  ('sim', 'SIM / eSIM', 'sim', 3), ('internet', 'Internet', 'internet', 4), ('banking', 'Banking', 'banking', 5),
  ('transport', 'Transport', 'transport', 6), ('healthcare', 'Healthcare', 'healthcare', 7), ('school', 'School', 'schools', 8),
  ('work', 'Work', 'work', 9), ('community', 'Community', null, 10), ('activities', 'Activities', null, 11)
on conflict (id) do nothing;

create table if not exists public.relocation_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  destination text not null,
  step_id text not null references public.relocation_steps (id) on delete cascade,
  done_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 300),
  primary key (user_id, destination, step_id)
);
alter table public.relocation_progress enable row level security;
drop policy if exists relocation_progress_self on public.relocation_progress;
create policy relocation_progress_self on public.relocation_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── Activities: type and audience ─────────────────────────

alter table public.activities
  add column if not exists activity_type text check (activity_type is null or activity_type in (
    'PLAYDATE', 'BEACH_WITH_KIDS', 'PARK_MEETUP', 'KIDS_FOOTBALL', 'KIDS_PADEL', 'KIDS_TENNIS', 'SWIMMING', 'MOM_BABY_WALK',
    'MOM_COFFEE', 'BRUNCH_WITH_KIDS', 'FAMILY_PICNIC', 'CREATIVE_WORKSHOP', 'KIDS_ART',
    'DINNER', 'BRUNCH', 'COFFEE', 'GIRLS_DINNER', 'FAMILY_DINNER', 'MOM_BRUNCH', 'RESTAURANT_MEETUP',
    'SURF', 'WELLNESS', 'SUNSET', 'COWORKING')),
  add column if not exists audience text not null default 'all' check (audience in ('all', 'girls', 'moms', 'families'));
-- Girls and moms activities are IRLY Girl activities: same server rule.
alter table public.activities drop constraint if exists activities_audience_girl;
alter table public.activities add constraint activities_audience_girl check (audience not in ('girls', 'moms') or girl_only);

-- ───────────────────────── Places from a data provider ─────────────────────────

alter table public.places drop constraint if exists places_kind_check;
alter table public.places add constraint places_kind_check check (kind in
  ('mall', 'beach', 'beach_club', 'restaurant', 'cafe', 'court', 'park', 'venue', 'market', 'marina', 'desert', 'coworking',
   'clinic', 'school', 'gym', 'spa', 'surf', 'temple', 'nature', 'other'));

alter table public.places
  add column if not exists provider text check (provider in ('google', 'irly')),
  add column if not exists provider_place_id text,
  add column if not exists rating numeric(2, 1) check (rating is null or rating between 0 and 5),
  add column if not exists review_count integer check (review_count is null or review_count >= 0),
  add column if not exists price_level smallint check (price_level is null or price_level between 0 and 4),
  add column if not exists cuisines text[] not null default '{}',
  add column if not exists types text[] not null default '{}',
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists booking_url text,
  add column if not exists menu_url text,
  add column if not exists opening_hours jsonb,
  add column if not exists photos text[] not null default '{}',
  add column if not exists amenities jsonb not null default '{}',
  add column if not exists fetched_at timestamptz;
create unique index if not exists places_provider_idx on public.places (provider, provider_place_id) where provider_place_id is not null;
create index if not exists places_rank_idx on public.places (city_id, kind, rating desc);

-- Rank = Bayesian rating (a 4.9 with 12 reviews does not beat a 4.7 with
-- 3,000), + IRLY popularity (saves, likes, activities planned there),
-- + freshness of the data. Returns the parts so the app can explain it.
create or replace function public.place_rank(rating numeric, reviews integer, popularity integer, fetched timestamptz)
returns table (score numeric, confidence numeric)
language sql stable as $$
  select
    round((
      (coalesce(reviews, 0)::numeric / (coalesce(reviews, 0) + 50)) * coalesce(rating, 0)
      + (50::numeric / (coalesce(reviews, 0) + 50)) * 4.2
    ) * 20
    + 4 * ln(1 + greatest(coalesce(popularity, 0), 0))::numeric
    + 3 * case when fetched is null then 0 else exp(-extract(epoch from (now() - fetched)) / (86400 * 120)) end::numeric, 1),
    round(coalesce(reviews, 0)::numeric / (coalesce(reviews, 0) + 50), 2)
$$;

-- Public total of saves for a place (who saved stays private).
create or replace function public.place_save_count(p_slug text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.saves where target_type = 'place' and target_id = p_slug
$$;

create or replace function public.places_search(
  p_city text,
  p_area text default null,
  p_kind text default null,
  p_cuisine text default null,
  p_min_rating numeric default null,
  p_max_price integer default null,
  p_tags text[] default null,
  p_kids boolean default false,
  p_q text default null,
  p_limit integer default 40
)
returns table (id uuid, slug text, name text, kind text, area_id text, rating numeric, review_count integer, price_level smallint,
  cuisines text[], tags text[], photo text, opening_hours jsonb, amenities jsonb, lat numeric, lng numeric,
  going integer, score numeric, confidence numeric)
language sql stable security invoker set search_path = public as $$
  with base as (
    select p.*,
      public.place_save_count(p.slug) as saves_n,
      (select count(*)::int from public.activities a where a.place_id = p.id and a.cancelled_at is null and a.starts_at > now()) as going_n
    from public.places p
    where p.city_id = p_city
      and (p_area is null or p.area_id = p_area
        or p.area_id in (select a.id from public.areas a where a.city_id = p_city and a.parent_area_id = p_area))
      and (p_kind is null or p.kind = p_kind or (p_kind = 'restaurant' and p.kind in ('restaurant', 'cafe')))
      and (p_cuisine is null or p_cuisine = any (p.cuisines) or p_cuisine = any (p.tags))
      and (p_min_rating is null or p.rating >= p_min_rating)
      and (p_max_price is null or p.price_level is null or p.price_level <= p_max_price)
      and (p_tags is null or p.tags @> p_tags)
      and (not p_kids or coalesce((p.amenities ->> 'good_for_children')::boolean, false) or 'kids' = any (p.tags))
      and (p_q is null or p.name ilike '%' || p_q || '%' or array_to_string(p.cuisines || p.tags, ' ') ilike '%' || p_q || '%')
  )
  select b.id, b.slug, b.name, b.kind, b.area_id, b.rating, b.review_count, b.price_level, b.cuisines, b.tags,
    coalesce(b.photos[1], b.image_url), b.opening_hours, b.amenities, b.lat, b.lng, b.going_n, r.score, r.confidence
  from base b, lateral public.place_rank(b.rating, b.review_count, b.saves_n + b.going_n * 3, b.fetched_at) r
  order by r.score desc, b.name
  limit least(greatest(p_limit, 1), 100)
$$;

-- A place and who is going there next.
create or replace function public.place_activities(p_slug text)
returns table (id uuid, title text, activity_type text, audience text, starts_at timestamptz, going integer)
language sql stable security invoker set search_path = public as $$
  select a.id, a.title, a.activity_type, a.audience, a.starts_at,
    (select count(*)::int from public.activity_participants x where x.activity_id = a.id and x.status = 'going')
  from public.activities a
  join public.places p on p.id = a.place_id and p.slug = p_slug
  where a.cancelled_at is null and a.starts_at > now() - interval '2 hours'
  order by a.starts_at
  limit 20
$$;

-- Family-friendly and well-known non-restaurant places (no ratings invented).
insert into public.places (slug, city_id, area_id, name, kind, category_id, tags, lat, lng, featured, provider) values
  ('echo-beach', 'bali', 'canggu', 'Echo Beach', 'beach', 'beach', '{surf,sunset}', -8.6550, 115.1240, true, 'irly'),
  ('berawa-beach', 'bali', 'berawa', 'Berawa Beach', 'beach', 'beach', '{surf,sunset,kids}', -8.6650, 115.1380, false, 'irly'),
  ('padang-padang', 'bali', 'uluwatu', 'Padang Padang Beach', 'beach', 'beach', '{surf,swimming}', -8.8110, 115.1030, true, 'irly'),
  ('melasti-beach', 'bali', 'ungasan', 'Melasti Beach', 'beach', 'beach', '{swimming,sunset,kids}', -8.8480, 115.1610, false, 'irly'),
  ('sanur-beach', 'bali', 'sanur', 'Sanur Beach & promenade', 'beach', 'beach', '{swimming,kids,running,cycling}', -8.6880, 115.2640, true, 'irly'),
  ('campuhan-ridge', 'bali', 'ubud', 'Campuhan Ridge Walk', 'nature', 'outdoor', '{walk,sunrise}', -8.5030, 115.2540, true, 'irly'),
  ('tegallalang-terraces', 'bali', 'tegallalang', 'Tegallalang Rice Terraces', 'nature', 'outdoor', '{walk,photo}', -8.4330, 115.2790, false, 'irly'),
  ('ubud-monkey-forest', 'bali', 'ubud', 'Sacred Monkey Forest Sanctuary', 'nature', 'culture', '{kids,culture}', -8.5190, 115.2600, false, 'irly'),
  ('zabeel-park', 'dubai', 'burdubai', 'Zabeel Park', 'park', 'outdoor', '{kids,picnic,running}', 25.2310, 55.2960, true, 'irly'),
  ('safa-park', 'dubai', 'jumeirah', 'Al Safa Park', 'park', 'outdoor', '{kids,picnic,running}', 25.1880, 55.2440, false, 'irly'),
  ('barsha-pond-park', 'dubai', 'alquoz', 'Al Barsha Pond Park', 'park', 'outdoor', '{kids,running,cycling}', 25.1050, 55.2050, false, 'irly'),
  ('creek-park', 'dubai', 'burdubai', 'Dubai Creek Park', 'park', 'outdoor', '{kids,picnic}', 25.2380, 55.3270, false, 'irly')
on conflict (slug) do nothing;
update public.places set tags = array(select distinct unnest(tags || '{kids}')) where slug in ('kite-beach', 'jbr-beach', 'sanur-beach');

-- ───────────────────────── IRLY Girl: Bali status and Mom mode ─────────────────────────

alter table public.irly_match_profiles
  add column if not exists destination_status text check (destination_status is null or destination_status in ('visiting', 'moving_soon', 'just_arrived', 'living')),
  add column if not exists destination text,
  add column if not exists move_month date,
  add column if not exists mom_mode boolean not null default false,
  -- Age groups only, never names or birthdays.
  add column if not exists kids_age_groups text[] not null default '{}'
    check (kids_age_groups <@ array['baby', 'toddler', 'kid', 'teen']),
  add column if not exists looking_for text[] not null default '{}';

-- Women to meet in a destination: moving soon, just arrived, living there,
-- moms. Same eligibility, privacy and blocking rules as Match discovery.
create or replace function public.girl_circle(p_destination text, p_status text default null, p_moms boolean default false, p_area text default null, p_limit integer default 30)
returns table (user_id uuid, first_name text, areas text[], destination_status text, move_month date, mom_mode boolean,
  kids_age_groups text[], looking_for text[], interests text[], score integer)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
begin
  return query
  select mp.user_id, p.first_name,
    case when 'areas' = any (mp.hidden_fields) then '{}'::text[] else mp.areas end,
    mp.destination_status, mp.move_month, mp.mom_mode,
    case when mp.mom_mode then mp.kids_age_groups else '{}'::text[] end,
    mp.looking_for, mp.interests,
    (select s.score from private.match_score(me, mp.user_id) s)
  from public.irly_match_profiles mp
  join public.profiles p on p.id = mp.user_id and p.deleted_at is null and p.gender = 'woman'
  left join public.safety_settings ss on ss.user_id = mp.user_id
  where mp.user_id <> me
    and mp.visible
    and coalesce(ss.profile_visibility, 'everyone') <> 'nobody'
    and not private.is_blocked(me, mp.user_id)
    and (mp.destination = p_destination or (mp.destination is null and p.city_id = p_destination))
    and (p_status is null or mp.destination_status = p_status)
    and (not p_moms or mp.mom_mode)
    and (p_area is null or (p_area = any (mp.areas) and not 'areas' = any (mp.hidden_fields)))
  order by 10 desc nulls last, mp.last_active_at desc
  limit least(greatest(p_limit, 1), 60);
end $$;

-- ───────────────────────── Communities: Bali girls, moms (Dubai + Bali) ─────────────────────────

insert into public.communities (city_id, name, tagline, category_id, girl_only)
select v.city_id, v.name, v.tagline, v.category_id, true from (values
  ('bali', 'Bali Girls', 'Meet women across Bali', 'girl'),
  ('bali', 'Canggu Girls', 'Coffee, surf and sunsets in Canggu', 'girl'),
  ('bali', 'Seminyak Girls', 'Brunch, shopping and beach clubs', 'girl'),
  ('bali', 'Ubud Girls', 'Yoga, culture and jungle walks', 'girl'),
  ('bali', 'Uluwatu Girls', 'Cliffs, surf and sunset sessions', 'girl'),
  ('bali', 'Bali Girls Who Travel', 'Find travel companions around Indonesia', 'travel'),
  ('bali', 'Girls Surf Bali', 'Morning surf sessions, all levels', 'sport'),
  ('bali', 'Girls Padel Bali', 'Padel games and tournaments', 'sport'),
  ('bali', 'Bali Wellness Girls', 'Yoga, breathwork, spa days', 'wellness'),
  ('bali', 'Bali Digital Nomad Girls', 'Coworking days and laptop cafés', 'networking'),
  ('bali', 'Women Entrepreneurs Bali', 'Founders and freelancers', 'networking'),
  ('bali', 'French Girls Bali', 'Les Françaises à Bali', 'girl'),
  ('bali', 'Bali Newcomer Girls', 'Just arrived? Start here', 'girl'),
  ('bali', 'Bali Beach Girls', 'Beach days and swims', 'beach'),
  ('bali', 'Bali Brunch Girls', 'The best brunches, together', 'food'),
  ('bali', 'Bali Coworking Girls', 'Work together, then sunset', 'networking'),
  ('bali', 'Girls Moving To Bali', 'Meet women before you arrive', 'girl'),
  ('bali', 'Bali Moms', 'Meet moms. Find activities. Build your circle.', 'family'),
  ('bali', 'Canggu Moms', 'Playdates, beaches and family brunches', 'family'),
  ('bali', 'Ubud Moms', 'Nature, workshops and slow days with kids', 'family'),
  ('bali', 'Sanur Moms', 'Calm beaches and park meetups', 'family'),
  ('dubai', 'Dubai Moms', 'Meet moms. Find activities. Build your circle.', 'family'),
  ('dubai', 'Marina & JBR Moms', 'Beach mornings and park meetups', 'family'),
  ('dubai', 'Dubai Hills Moms', 'Playdates and family brunches', 'family'),
  ('dubai', 'New Moms Dubai', 'Mom & baby walks and coffee', 'family')
) v (city_id, name, tagline, category_id)
where not exists (select 1 from public.communities c where c.city_id = v.city_id and c.name = v.name);

-- ───────────────────────── Grants ─────────────────────────

grant execute on function public.places_search(text, text, text, text, numeric, integer, text[], boolean, text, integer),
  public.place_activities(text), public.place_rank(numeric, integer, integer, timestamptz),
  public.place_save_count(text) to anon, authenticated;

-- Hardening: functions added to `private` after the first migration kept
-- PostgreSQL's default EXECUTE for everyone. Only explicit grants remain.
revoke all on all functions in schema private from public, anon;

-- are_friends answered by itself (security definer) so the raw friendship
-- lookup is no longer exposed to members: you can only ask about yourself.
create or replace function private.are_friends(a uuid, b uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> a and auth.uid() <> b then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return private.friends_unchecked(a, b);
end $$;
revoke all on function private.are_friends(uuid, uuid) from public, anon;
grant execute on function private.are_friends(uuid, uuid) to authenticated;
revoke execute on function private.friends_unchecked(uuid, uuid) from authenticated;
revoke all on function public.girl_circle(text, text, boolean, text, integer) from public, anon;
grant execute on function public.girl_circle(text, text, boolean, text, integer) to authenticated;
