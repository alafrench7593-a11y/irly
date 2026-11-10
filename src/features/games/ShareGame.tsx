import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { useMyCommunityOptions } from '@/features/server/activities';
import { t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import type { Room } from './api';
import { shareGame } from './share';
import { DX } from './werewolf/dubai/theme';

const ROOM_URL = 'https://getirly.com/app/games/';
const JOIN_URL = 'https://getirly.com/app/games/join?code=';

/**
 * The host invites: a post in one of their communities, the same post on the
 * Live, or a link. A private game's link carries its code; a public game's
 * link opens its table. The server decides who may post where and who may
 * join: nothing here opens a door by itself.
 */
export function ShareGame({ room }: { room: Room }) {
  const router = useRouter();
  const communities = useMyCommunityOptions();
  const [picking, setPicking] = useState<null | 'community' | 'live'>(null);
  const [busy, setBusy] = useState(false);
  // An IRLY Girl game goes to IRLY Girl communities, a Mixte game to the others (the server checks again).
  const mine = communities.filter((c) => c.girlOnly === (room.space === 'irly_girl'));
  const link = () => {
    const url = room.code ? JOIN_URL + room.code : ROOM_URL + room.id;
    const message = room.code ? tx('Join my Loup-Garou game on IRLY with the code {code}: {url}', { code: room.code, url }) : tx('Join my Loup-Garou game on IRLY: {url}', { url });
    Share.share({ message }).catch(() => undefined);
  };
  const publish = (community: { id: string; name: string }) => {
    if (busy) return;
    const live = picking === 'live';
    setBusy(true);
    shareGame(room.id, community.id, live)
      .then(() => {
        setPicking(null);
        toast(tx(live ? 'Shared on the Live and in {name}' : 'Shared in {name}', { name: community.name }), 'check');
      })
      .catch((e: unknown) => toast(e instanceof Error ? tx(e.message) : tx('Try again'), 'x', 'live'))
      .finally(() => setBusy(false));
  };
  return (
    <View style={styles.box} testID="share-game">
      <Row icon="heartHandshake" label={tx('Share in a community')} onPress={() => setPicking('community')} testID="share-community" />
      <Row icon="megaphone" label={tx('Share on the Live')} onPress={() => setPicking('live')} testID="share-live" />
      <Row icon="share" label={tx('Send a link')} onPress={link} testID="share-link" />
      <Sheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        scroll
        title={tx(picking === 'live' ? 'Share on the Live' : 'Share in a community')}
        subtitle={tx(picking === 'live' ? 'The post shows in the community and, for 24 hours, on the Live.' : 'Members of the community will see the game and can join it.')}
      >
        <View style={styles.list}>
          {mine.length ? (
            mine.map((c) => (
              <Pressable key={c.id} onPress={() => publish(c)} disabled={busy} accessibilityRole="button" accessibilityLabel={c.name} style={[styles.community, busy ? styles.busy : null]} testID="share-pick">
                <Text style={styles.communityName} numberOfLines={1}>
                  {c.groupOf ? `${c.groupOf} · ${c.name}` : c.name}
                </Text>
                <Icon name="chevronRight" size={18} color={DX.gold} />
              </Pressable>
            ))
          ) : (
            <>
              <Text style={styles.empty}>{tx('You are not in a community yet. Join one, then share your game there.')}</Text>
              <Pressable
                onPress={() => {
                  setPicking(null);
                  router.push('/communities');
                }}
                accessibilityRole="button"
                style={styles.community}
              >
                <Text style={styles.communityName}>{tx('Find a community')}</Text>
                <Icon name="chevronRight" size={18} color={DX.gold} />
              </Pressable>
            </>
          )}
        </View>
      </Sheet>
    </View>
  );
}

function Row({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic('select');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.row}
      testID={testID}
    >
      <Icon name={icon} size={18} color={DX.goldLight} />
      <Text style={styles.rowText}>{label}</Text>
      <Icon name="chevronRight" size={18} color={DX.goldDark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(226,182,83,0.4)', backgroundColor: 'rgba(11,9,7,0.5)' },
  rowText: { flex: 1, color: DX.ivory, fontSize: 15, fontWeight: '600' },
  list: { gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  community: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(226,182,83,0.35)' },
  communityName: { flex: 1, fontSize: 15, fontWeight: '600', color: DX.goldLight },
  empty: { color: DX.muted, fontSize: 14, lineHeight: 20 },
  busy: { opacity: 0.5 },
});
