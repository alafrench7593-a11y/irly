import { StyleSheet } from 'react-native';
import { useFrame } from '@/components/layout/frame';
import { space } from '@/theme/tokens';

/**
 * A community page on a wide screen. From SPLIT (the width the page has),
 * who the community is (cover, name, members, Join, its tools) sits in a
 * column on the left and its posts and activities on the right: the feed
 * keeps a phone-like reading width and Join stays in sight beside it.
 * Under SPLIT a single column (centred on a tablet), as on a phone: two
 * columns there would leave the feed narrower than a phone.
 */
export const COMMUNITY_SPLIT = 900;

/** Width of the left column, page gutters included. */
export const COMMUNITY_SIDE = 380;

export function useCommunitySplit(): boolean {
  return useFrame().width >= COMMUNITY_SPLIT;
}

export const communitySplit = StyleSheet.create({
  // The page's blocks one under the other (phone): the spacing they always had.
  stack: { gap: space[5] },
  split: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: 1200, alignSelf: 'center' },
  left: { width: COMMUNITY_SIDE, gap: space[5] },
  right: { flex: 1, minWidth: 0, maxWidth: 760, gap: space[5] },
});
