-- Bali visa & stay content. Figures below were collected on 2026-10-05 from
-- published guides that cite the Indonesian immigration rules; IRLY could
-- not read the official portal directly that day, so every entry is an IRLY
-- Guide summary with its source, never marked as verified
-- (last_verified_at stays null) and due for review in three months.
-- Official links stay as the "Official information" entries from 0700.

-- The explainer now matches how figures are shown (with source and date).
update public.guide_articles
set body = 'IRLY separates three things: Official (from the government, with its link), IRLY Guide (our explanations, never a legal rule) and Third-party services (agents you may hire). Fees and durations always come with their source and its date, and say whether IRLY has verified them.'
where destination = 'bali' and title = 'How to read visa information on IRLY';

-- The two vague placeholders are replaced by the detailed entries below.
delete from public.guide_articles
where destination = 'bali' and section = 'visa'
  and title in ('Tourist stays and extensions', 'Long stays, work, family and investment');

insert into public.guide_articles (destination, section, topic, title, body, kind, source_name, source_url, source_date, review_by, sort)
select v.destination, v.section, v.topic, v.title, v.body, v.kind, v.source_name, v.source_url, v.source_date::date, v.review_by::date, v.sort
from (values
  ('bali', 'visa', 'levy', 'Bali tourist levy',
    'Bali''s provincial government charges foreign visitors a tourist levy, separate from any visa. Reported amount: IDR 150,000 per person, per entry into Bali. It can be paid online on the Love Bali site before you travel, or on arrival.',
    'official', 'Bali Provincial Government (Love Bali)', 'https://lovebali.baliprov.go.id/', '2026-10-05', '2027-01-05', 5),
  ('bali', 'visa', 'tourist', 'Visa on Arrival (B1) and e-VOA',
    'For eligible nationalities, for tourism and short visits. Reported: 30 days from arrival, extendable once by 30 days (60 days in total). Reported fee: IDR 500,000, and the same again for the extension, which must be done before the first 30 days end. It can be bought online in advance (e-VOA) or at the airport. Check that your nationality is eligible on the official portal.',
    'irly_guide', 'Indonesia visa guides citing the Directorate General of Immigration', 'https://www.komodoresort.com/blog/indonesia-visa-guide/', '2026-10-05', '2027-01-05', 10),
  ('bali', 'visa', 'tourist', 'Visit visa (C1): up to 180 days',
    'A visit visa applied for online before you travel, for tourism, family visits and social activities. Reported: 60 days on a single entry, extendable for up to 180 days in total. Reported fee: IDR 500,000. Working, even for a foreign employer, is not covered by a visit visa.',
    'irly_guide', 'Indonesia visa guides citing the Directorate General of Immigration', 'https://evisaindonesia.info/indonesia-evisa-types/', '2026-10-05', '2027-01-05', 11),
  ('bali', 'visa', 'extension', 'Extending your stay',
    'Extensions are requested before your current stay ends, online or at an immigration office (Bali has offices in Denpasar, Ngurah Rai airport area and Singaraja). Overstaying leads to fines and possible deportation: start early.',
    'irly_guide', 'Indonesia visa guides citing the Directorate General of Immigration', 'https://visa.balieasy.com/blog/indonesia-30-day-visa-extension/', '2026-10-05', '2027-01-05', 12),
  ('bali', 'visa', 'remote_work', 'Remote Worker KITAS (E33G): digital nomads',
    'A one-year stay permit for people working remotely for companies outside Indonesia, with multiple entries. Reported requirement: at least USD 60,000 a year of income from abroad, proven by contract, payslips or bank records. Reported government fees: IDR 7,000,000, plus IDR 1,500,000 for the re-entry permit. You may not work for Indonesian clients or companies on it.',
    'irly_guide', 'Remote worker visa guides citing the Directorate General of Immigration', 'https://emerhub.com/indonesia/visas/remote-worker-visa/', '2026-10-05', '2027-01-05', 20),
  ('bali', 'visa', 'work', 'Work KITAS (E23): employed in Indonesia',
    'For employees of a company registered in Indonesia (PT, PT PMA or representative office), which sponsors the permit. Reported validity: 6 months, 1 year or 2 years, renewable. Your employer applies; you cannot apply alone.',
    'irly_guide', 'KITAS guides citing the Directorate General of Immigration', 'https://propertia.com/kitas-types-for-expats-bali/', '2026-10-05', '2027-01-05', 21),
  ('bali', 'visa', 'investor', 'Investor KITAS: business owners',
    'For foreign shareholders of an Indonesian foreign-investment company (PT PMA). The requirements depend on the investment held in the company: confirm the current threshold on the official portal and with your company''s legal adviser before investing.',
    'irly_guide', 'KITAS guides citing the Directorate General of Immigration', 'https://dda-realestate.com/indonesia/posts/temporary-stay-permit-kitas-and-visa-regime-in-indonesia-in-2026', '2026-10-05', '2027-01-05', 22),
  ('bali', 'visa', 'family', 'Family KITAS (E31): spouses and children',
    'For the foreign spouse or children of an Indonesian citizen, or family members of a foreigner who already holds a KITAS. Reported validity: 1 to 2 years, renewable. The Indonesian spouse or the KITAS holder sponsors the application.',
    'irly_guide', 'KITAS guides citing the Directorate General of Immigration', 'https://propertia.com/kitas-types-for-expats-bali/', '2026-10-05', '2027-01-05', 23),
  ('bali', 'visa', 'retirement', 'Retirement KITAS (E33F, E33E)',
    'For retirees. Reported: E33F is a one-year permit, renewable, with proof of pension income (about USD 1,500 a month) and a sponsor; E33E "Silver Hair" is a five-year permit with a deposit of USD 50,000 in an Indonesian state bank and USD 3,000 a month of income, without a sponsor. Age limits apply.',
    'irly_guide', 'Retirement visa guides citing the Directorate General of Immigration', 'https://emerhub.com/indonesia/visas/retirement-visa/', '2026-10-05', '2027-01-05', 24),
  ('bali', 'visa', 'second_home', 'Second Home visa (E33)',
    'A 5- or 10-year stay permit without a sponsor or age limit. Reported condition: a deposit of IDR 2 billion in an Indonesian state bank, or property worth USD 1 million. It does not allow work for an Indonesian company.',
    'irly_guide', 'Second home visa guides citing the Directorate General of Immigration', 'https://emerhub.com/indonesia/visas/second-home-visa/', '2026-10-05', '2027-01-05', 25),
  ('bali', 'visa', 'documents', 'Documents you will usually need',
    'A passport valid for at least 6 months from arrival, a return or onward ticket for visit visas, a recent photo, and proof of funds. Long-stay permits add a sponsor letter or income and bank evidence. The official portal lists the exact documents for each visa: check it before applying.',
    'irly_guide', 'Indonesia visa guides citing the Directorate General of Immigration', 'https://www.komodoresort.com/blog/indonesia-visa-guide/', '2026-10-05', '2027-01-05', 30),
  ('bali', 'visa', 'process', 'How to apply',
    '1. Pick the visa that matches what you will do in Bali (visit, remote work, employment, family, retirement). 2. Apply on the official e-Visa portal only: beware of look-alike sites charging extra. 3. Pay the government fee on the portal. 4. Keep the e-visa PDF with your passport. 5. Pay the Bali tourist levy separately. 6. Note your expiry date and extend before it.',
    'irly_guide', null, null, null, '2027-01-05', 31)
) v (destination, section, topic, title, body, kind, source_name, source_url, source_date, review_by, sort)
where not exists (select 1 from public.guide_articles g where g.destination = v.destination and g.title = v.title);
