-- The neighbourhoods the app already offers in Abu Dhabi, Sharjah, Ajman,
-- Ras Al Khaimah, Fujairah and Umm Al Quwain, so every one of them has its
-- area page, recommendations and map position on the server too.
insert into public.areas (city_id, id, name, lat, lng) values
  ('abudhabi', 'minazayed', 'Mina Zayed', 24.52, 54.38),
  ('abudhabi', 'khalifa', 'Khalifa City', 24.42, 54.57),
  ('sharjah', 'majaz', 'Al Majaz', 25.325, 55.39),
  ('sharjah', 'qasba', 'Al Qasba', 25.322, 55.376),
  ('sharjah', 'heritage', 'Heart of Sharjah', 25.36, 55.385),
  ('sharjah', 'aljada', 'Aljada', 25.31, 55.47),
  ('sharjah', 'unicity', 'University City', 25.29, 55.48),
  ('ajman', 'alzorah', 'Al Zorah', 25.43, 55.48),
  ('ajman', 'nuaimiya', 'Al Nuaimiya', 25.39, 55.45),
  ('ajman', 'aljurf', 'Al Jurf', 25.41, 55.5),
  ('rak', 'marjan', 'Al Marjan Island', 25.68, 55.74),
  ('rak', 'hamra', 'Al Hamra', 25.69, 55.78),
  ('rak', 'minaalarab', 'Mina Al Arab', 25.71, 55.82),
  ('rak', 'rakcity', 'RAK City', 25.79, 55.94),
  ('fujairah', 'alaqah', 'Al Aqah', 25.5, 56.36),
  ('fujairah', 'fujcity', 'Fujairah City', 25.13, 56.33),
  ('fujairah', 'masafi', 'Masafi', 25.3, 56.16),
  ('fujairah', 'wadi', 'Wadi Wurayah', 25.4, 56.27),
  ('uaq', 'oldtown', 'Old Town', 25.58, 55.57),
  ('uaq', 'lagoon', 'Khor Al Beidah', 25.6, 55.65),
  ('uaq', 'alsalam', 'Al Salam City', 25.5, 55.6)
on conflict (city_id, id) do nothing;
