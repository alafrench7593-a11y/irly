/**
 * IRLY Networking, professional side: the domains people work in, what they
 * are (founder, freelancer…) and what they came for. Ids are stored on the
 * server (pro_profiles), so they never change; labels can.
 */

export type IndustryId =
  | 'tech' | 'ai' | 'saas' | 'ecommerce' | 'apps' | 'fintech' | 'marketing' | 'design' | 'business' | 'startups' | 'web3'
  | 'realestate' | 'retail' | 'food' | 'media' | 'creator' | 'legal' | 'education' | 'health' | 'mobility' | 'trade';

export type Industry = { id: IndustryId; emoji: string; label: string; short: string };

export const INDUSTRIES: Industry[] = [
  { id: 'tech', emoji: '💻', label: 'Tech & IT', short: 'Tech' },
  { id: 'ai', emoji: '🤖', label: 'AI & Artificial Intelligence', short: 'AI' },
  { id: 'saas', emoji: '🚀', label: 'SaaS', short: 'SaaS' },
  { id: 'ecommerce', emoji: '🛒', label: 'E-commerce', short: 'E-commerce' },
  { id: 'apps', emoji: '📱', label: 'Apps & Mobile', short: 'Apps' },
  { id: 'fintech', emoji: '💰', label: 'Finance & Fintech', short: 'Fintech' },
  { id: 'marketing', emoji: '📈', label: 'Marketing & Growth', short: 'Marketing' },
  { id: 'design', emoji: '🎨', label: 'Design & Creation', short: 'Design' },
  { id: 'business', emoji: '🏢', label: 'Entrepreneurship & Business', short: 'Business' },
  { id: 'startups', emoji: '🏗️', label: 'Startups', short: 'Startups' },
  { id: 'web3', emoji: '🌐', label: 'Web3 & Blockchain', short: 'Web3' },
  { id: 'realestate', emoji: '🏠', label: 'Real Estate', short: 'Real estate' },
  { id: 'retail', emoji: '🛍️', label: 'Retail & Fashion', short: 'Retail' },
  { id: 'food', emoji: '🍽️', label: 'Food & Hospitality', short: 'Food' },
  { id: 'media', emoji: '🎥', label: 'Content & Media', short: 'Media' },
  { id: 'creator', emoji: '📸', label: 'Influence & Creator Economy', short: 'Creators' },
  { id: 'legal', emoji: '⚖️', label: 'Legal & Consulting', short: 'Legal' },
  { id: 'education', emoji: '🧠', label: 'Education', short: 'Education' },
  { id: 'health', emoji: '🏥', label: 'Health & Wellness', short: 'Health' },
  { id: 'mobility', emoji: '🚗', label: 'Mobility & Automotive', short: 'Mobility' },
  { id: 'trade', emoji: '🌍', label: 'Import / Export & International Business', short: 'Import / Export' },
];

export const INDUSTRY: Record<IndustryId, Industry> = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i])) as Record<IndustryId, Industry>;

export type RoleId = 'entrepreneur' | 'freelancer' | 'employee' | 'investor' | 'founder';

export const ROLES: { id: RoleId; label: string }[] = [
  { id: 'founder', label: 'Founder' },
  { id: 'entrepreneur', label: 'Entrepreneur' },
  { id: 'freelancer', label: 'Freelancer' },
  { id: 'employee', label: 'Employee' },
  { id: 'investor', label: 'Investor' },
];

export const ROLE_LABEL: Record<RoleId, string> = Object.fromEntries(ROLES.map((r) => [r.id, r.label])) as Record<RoleId, string>;

export type IntentId = 'meet' | 'cofounder' | 'clients' | 'investors' | 'partners' | 'freelancers' | 'suppliers' | 'grow' | 'ideas' | 'opportunities' | 'job';

export type Intent = { id: IntentId; emoji: string; label: string; /** "you're both looking for …" */ both: string };

export const INTENTS: Intent[] = [
  { id: 'meet', emoji: '🤝', label: 'Meet people', both: 'meeting people' },
  { id: 'cofounder', emoji: '🚀', label: 'Find a cofounder', both: 'a cofounder' },
  { id: 'clients', emoji: '💼', label: 'Find clients', both: 'clients' },
  { id: 'investors', emoji: '💰', label: 'Find investors', both: 'investors' },
  { id: 'partners', emoji: '🤝', label: 'Find business partners', both: 'business partners' },
  { id: 'freelancers', emoji: '🧑‍💻', label: 'Find freelancers', both: 'freelancers' },
  { id: 'suppliers', emoji: '📦', label: 'Find suppliers', both: 'suppliers' },
  { id: 'grow', emoji: '📈', label: 'Grow my business', both: 'growth' },
  { id: 'ideas', emoji: '💡', label: 'Exchange ideas', both: 'new ideas' },
  { id: 'opportunities', emoji: '🎯', label: 'Find opportunities', both: 'opportunities' },
  { id: 'job', emoji: '🔎', label: 'Find a job', both: 'a job' },
];

export const INTENT: Record<IntentId, Intent> = Object.fromEntries(INTENTS.map((i) => [i.id, i])) as Record<IntentId, Intent>;

/** The "looking for" filter: the goals people search others by. */
export const LOOKING_FILTERS: { id: IntentId; label: string }[] = [
  { id: 'cofounder', label: 'Looking for a cofounder' },
  { id: 'clients', label: 'Looking for clients' },
  { id: 'partners', label: 'Looking for partners' },
  { id: 'investors', label: 'Looking for investors' },
  { id: 'job', label: 'Looking for a job' },
  { id: 'suppliers', label: 'Looking for suppliers' },
];

/** Skills offered as one-tap suggestions in the profile editor. */
export const SKILL_SUGGESTIONS = [
  'Product', 'Sales', 'Fundraising', 'Growth', 'SEO', 'Paid ads', 'Branding', 'UI/UX', 'React', 'Python', 'AI/ML', 'Data',
  'Finance', 'Legal', 'Operations', 'Hiring', 'Content', 'Video', 'Social media', 'Partnerships', 'Supply chain', 'Real estate',
];

export const MAX_INDUSTRIES = 3;
export const MAX_SKILLS = 12;
