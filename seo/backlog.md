# Backlog

Ordered by expected effect for the effort. « Owner » means it cannot be done from the repo.

## Now
| # | What | Effect | Effort | Who |
| --- | --- | --- | --- | --- |
| 1 | Done on 12 November 2026: the probe showed `getirly.com` redirects (308) to `www.getirly.com`, which serves the pages; every canonical, hreflang, sitemap and robots line now names `https://www.getirly.com/`. | high | done | repo |
| 2 | Google Search Console and Bing Webmaster Tools: verify the domain, submit `/sitemap.xml`. Nothing is measured until this is done. | high | 15 min | owner |
| 3 | Audience measurement on the website (not in the app). Today nothing counts visits, so « sign-ups from search » cannot be known. The guide buttons now carry `utm_` marks, ready for any tool. Choosing a tool changes the privacy policy: owner's decision. | high | 1 h once chosen | owner decides |
| 4 | Done on 12 November 2026: from GitHub's network, the host answers `Googlebot`, `Bingbot`, `OAI-SearchBot` and `PerplexityBot` with the same page as a browser (200, full HTML). Re-run the « Website probe » workflow after any change of firewall settings. | high | done | repo |
| 5 | Send the five drafts in `seo/outreach/`, each to a named person. External mentions are what the site lacks most. | high | 2 h | owner |

## Routine
| When | What | Who |
| --- | --- | --- |
| every morning | « Website probe » reads every page of the sitemap on the live site; a problem fails the run and GitHub writes to the owner | automatic |
| after each deployment | « Announce pages » sends the sitemap's addresses to Bing and the other IndexNow engines | automatic |
| every day | two blog posts from `docs/BLOG-PLAN.md`, checked by `scripts/test-site.mjs` before they are merged | scheduled task |
| every week | read Search Console (Indexing → Pages, Performance → Queries) into `seo/dashboard.md` | owner, until Search Console can be read by the repo |
| every month | the 25 questions of `seo/ai-prompts.md`, then `seo/reports/` from the template | owner + repo |

Reading Search Console from the repo (so that the weekly and monthly steps run by themselves) needs a Google service account added as a user of the property, with its key stored as a repository secret. It is the owner's to create.

## Next
| # | What | Effect | Effort | Who |
| --- | --- | --- | --- | --- |
| 6 | First check of the 25 questions in `seo/ai-prompts.md` on four assistants, dated. | medium | 1 h | owner |
| 7 | Read the pages that name real institutions (`fr/dubai/rencontrer-des-francais/`, `dubai/free-social-activities/` and their twins) and confirm each name against the institution's own site. | medium | 30 min | owner |
| 8 | After three weeks of Search Console data: improve the pages in positions 8 to 20; merge or differentiate any two pages that receive impressions for the same query. | high | per page | repo |
| 9 | A photo for each blog post (they share the site's picture today). Only real photos or free-licence ones, with credit. | low | 2 h | repo + owner |
| 10 | App Store and Google Play listings, when the apps are out: same name and description as `seo/directories.md`; then add the store links to the site and to the app's structured data. | high | at launch | owner |

## Later
- A page per neighbourhood or per emirate only if Search Console shows such queries: never before.
- « IRLY vs <product> » pages: only with sources and an « as of » date for every claim about the other product, and only for products people really compare IRLY with.
- A free tool close to the product (for example a « first month in Dubai » plan to tick): only if it can be made genuinely useful.

## Not to do
- Buying links, link exchanges, paid directories, pages written only to hold keywords, reviews or figures that do not exist.
