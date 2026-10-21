import { useGirlAccess } from '@/features/girl/access';
import { useStore } from '@/state/store';

/**
 * Whether to show the doors into IRLY Girl (portals, the women-only doors,
 * the IRLY Girl community switch, the IRLY Girl category). A woman's profile
 * on this phone, unless the server said IRLY Girl is closed for this account
 * (suspended after reports, or not a woman's account): the same access check
 * as GirlGate, so a suspended member no longer sees doors the server refuses.
 * While the answer is on its way, or signed out (asked to sign in at the
 * door), the profile on this phone decides.
 */
export function useGirlEntry(): boolean {
  const woman = useStore((s) => s.profile.gender === 'woman');
  const { access } = useGirlAccess();
  return woman && access !== 'suspended' && access !== 'not_eligible';
}
