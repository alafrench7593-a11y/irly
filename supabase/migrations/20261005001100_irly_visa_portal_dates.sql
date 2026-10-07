-- The two official portal links (e-Visa portal, Immigration website) were
-- checked on 2026-10-05 with the rest of the visa section: date them too.
update public.guide_articles
set last_verified_at = '2026-10-05', source_date = coalesce(source_date, '2026-10-05'), review_by = coalesce(review_by, '2027-01-05')
where destination = 'bali' and section = 'visa' and kind = 'official' and last_verified_at is null;
