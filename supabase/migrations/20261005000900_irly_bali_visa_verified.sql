-- Bali visa & stay, checked against the Indonesian government's own pages
-- (imigrasi.go.id visa list, evisa.imigrasi.go.id FAQ, regional immigration
-- offices, Bali provincial government) on 2026-10-05. This replaces the
-- secondary-source summaries of 0800, three of which were wrong (C1 fee,
-- Second Home deposit, Silver Hair age). Where the official pages did not
-- give a figure, none is stated. Review again by 2027-01-05.

delete from public.guide_articles
where destination = 'bali' and section = 'visa'
  and title in (
    'Bali tourist levy', 'Visa on Arrival (B1) and e-VOA', 'Visit visa (C1): up to 180 days', 'Extending your stay',
    'Remote Worker KITAS (E33G): digital nomads', 'Work KITAS (E23): employed in Indonesia', 'Investor KITAS: business owners',
    'Family KITAS (E31): spouses and children', 'Retirement KITAS (E33F, E33E)', 'Second Home visa (E33)',
    'Documents you will usually need', 'How to apply');

insert into public.guide_articles (destination, section, topic, title, body, kind, source_name, source_url, source_date, last_verified_at, review_by, sort)
select v.destination, 'visa', v.topic, v.title, v.body, v.kind, v.source_name, v.source_url, '2026-10-05'::date,
  case when v.kind = 'official' then '2026-10-05'::date end, '2027-01-05'::date, v.sort
from (values
  ('bali', 'levy', 'Bali tourist levy (PWA)',
    'Foreign tourists entering Bali pay IDR 150,000 per person, once per visit, on top of any visa. Pay it before you travel on the Love Bali website (card, bank transfer, virtual account or QRIS) and keep the voucher. It stays valid as long as you do not leave Indonesia.',
    'official', 'Bali Provincial Government: Love Bali and Bali Tourism Office', 'https://lovebali.baliprov.go.id/faq', 2),
  ('bali', 'tourist', 'Visa on Arrival and e-VOA: 30 days',
    'For eligible nationalities: tourism, family visits, business meetings, shopping or transit. Stay: up to 30 days. Fee: IDR 500,000. Buy it online before you fly (e-VOA) or at the airport. Check on the official portal that your nationality is eligible.',
    'official', 'Directorate General of Immigration (e-Visa FAQ)', 'https://evisa.imigrasi.go.id/front/faq/59e5c2c3-525d-485b-928b-ed25079d0fd1', 10),
  ('bali', 'extension', 'Extending a Visa on Arrival',
    'A Visa on Arrival can be extended once, for another 30 days (60 days in total). Fee: IDR 500,000. Apply online on the e-Visa portal (Services → Find existing stay permit → Extend) from 14 days before expiry and at the latest one day before. After paying, have your photo taken at the nearest immigration office (in Bali: Denpasar, Ngurah Rai or Singaraja) from one working day after payment.',
    'official', 'Directorate General of Immigration, Yogyakarta and West Jakarta offices', 'https://jogja.imigrasi.go.id/extending-indonesia-visa-on-arrival-101/', 11),
  ('bali', 'tourist', 'Tourist visit visa (C1): 60 days, up to 180',
    'Applied for online before you travel. Single entry, first stay up to 60 days from arrival, extendable online up to 180 days in total. Fee: IDR 1,000,000. Documents: passport valid at least 6 months, proof of living costs (bank statement of the last 3 months showing at least USD 2,000 or equivalent), a recent colour photo. Processing: about 5 working days after payment. Work is not allowed on a visit visa.',
    'official', 'Directorate General of Immigration (visa list: C1)', 'https://www.imigrasi.go.id/wna/daftar-visa-indonesia/C1', 12),
  ('bali', 'remote_work', 'Remote worker visa (E33G): digital nomads',
    'For people employed by a company outside Indonesia who work remotely while staying here. Stay: up to 1 year. Fee: IDR 7,000,000. Requirements: proof of income of at least USD 60,000 a year, an employment contract with a company established outside Indonesia, and a personal bank statement of at least USD 2,000 over the last 3 months. Allowed: your foreign employer''s work, tourism, family visits, travelling in and out. Not allowed: working for Indonesian clients or companies.',
    'official', 'Directorate General of Immigration (visa list: E33G)', 'https://www.imigrasi.go.id/wna/daftar-visa-indonesia/E33G', 20),
  ('bali', 'retirement', 'Senior second home visa (E33E): 5 years, 55+',
    'For people aged 55 or older who want to settle in Indonesia, without a sponsor. Stay: up to 5 years. Fee: IDR 13,000,000. Requirements: a commitment to deposit at least USD 50,000 in your own account at an Indonesian state-owned bank, and proof of income or pension of at least USD 3,000 a month.',
    'official', 'Directorate General of Immigration (visa list: E33E)', 'https://www.imigrasi.go.id/wna/daftar-visa-indonesia/E33E', 21),
  ('bali', 'retirement', 'Senior visa (E33F): 1 year',
    'The one-year version for seniors. Stay: up to 1 year. Fee: IDR 7,000,000. General requirements include a passport valid at least 6 months, a personal bank statement of at least USD 2,000 over the last 3 months and a recent photo. Age and guarantee conditions: read the official page before applying.',
    'official', 'Directorate General of Immigration (visa list: E33F)', 'https://www.imigrasi.go.id/wna/daftar-visa-indonesia/E33F', 22),
  ('bali', 'second_home', 'Second home visa (E33): 5 or 10 years',
    'To live in Indonesia without a sponsor, against an immigration guarantee: a commitment to keep at least USD 130,000 in your own account at an Indonesian state-owned bank, or ownership of a house or apartment in Indonesia worth at least USD 1,000,000. Fees: IDR 13,000,000 for 5 years, IDR 19,500,000 for 10 years.',
    'official', 'Directorate General of Immigration (visa list: E33)', 'https://www.imigrasi.go.id/wna/daftar-visa-indonesia/E33', 23),
  ('bali', 'work', 'Work visa (E23): employed in Indonesia',
    'For work within an employment relationship with an Indonesian employer, who is your sponsor (guarantor) and applies for you. You cannot apply on your own. Durations, quotas and the work permit (RPTKA) depend on the job: your employer handles them.',
    'official', 'Directorate General of Immigration (visa list: E23)', 'https://www.imigrasi.go.id/wna/permohonan-visa-republik-indonesia/visa-tinggal-terbatas-indeks-e23?golden_visa=0', 24),
  ('bali', 'investor', 'Investor visa (E28A): shareholders',
    'For foreign shareholders of a company registered with the Ministry of Investment / BKPM that acts as guarantor. Official requirement: share ownership of at least IDR 10,000,000,000 (ten billion rupiah) or equivalent in that company. Other investor visas (E28B to E28F) exist for setting up companies, capital markets or branches.',
    'official', 'Directorate General of Immigration (visa list: E28A)', 'https://www.imigrasi.go.id/wna/daftar-visa-indonesia/E28A', 25),
  ('bali', 'family', 'Spouse visa (E31A): married to an Indonesian',
    'For the foreign husband or wife of an Indonesian citizen. The Indonesian spouse applies. Documents: application letter from the spouse, passport valid at least 6 months, proof of living costs (at least USD 2,000 over the last 3 months), recent photo, and proof of marriage: Indonesian marriage book, or a foreign marriage certificate registered in Indonesia (translated by a sworn translator unless in English).',
    'official', 'Directorate General of Immigration (visa list: E31A)', 'https://www.imigrasi.go.id/wna/daftar-visa-indonesia/E31A', 26),
  ('bali', 'process', 'How to apply',
    '1. Pick the visa that matches what you will do in Bali (visit, remote work, employment, family, retirement, investment). 2. Apply only on the official e-Visa portal: look-alike sites charge extra. 3. Pay the official fee on the portal. 4. Keep the e-visa PDF with your passport. 5. Pay the Bali tourist levy separately on Love Bali. 6. Note your expiry date and extend in time.',
    'irly_guide', null, null, 30)
) v (destination, topic, title, body, kind, source_name, source_url, sort)
where not exists (select 1 from public.guide_articles g where g.destination = v.destination and g.title = v.title);
