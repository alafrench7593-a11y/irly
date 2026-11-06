import { NotFound } from '@/components/layout/NotFound';

/**
 * Help & Questions was built on the Help community's groups; communities have
 * no groups since 2026-11-06 (migration 20261109000000), so its old links say
 * it is not available (its questions and answers are kept on the server).
 */
export default function HelpScreen() {
  return <NotFound title="Help & Questions is no longer available" />;
}
