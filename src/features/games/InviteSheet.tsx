import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
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

type Step = 'menu' | 'community' | 'live';

/**
 * « Invite players »: a post in one of the host's communities, the same post
 * on the Live, or a link. One sheet, three steps. A private game's link
 * carries its code; a public game's link opens its table. The server decides
 * who may post where and who may join; a second tap never posts twice (the
 * button is held while sending, and the server gives back the same post).
 */
export function InviteSheet({ room, visible, onClose }: { room: Room; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const communities = useMyCommunityOptions();
  const [step, setStep] = useState<Step>('menu');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [done, setDone] = useState<string[]>([]);
  // An IRLY Girl game goes to IRLY Girl communities, a Mixte game to the others (the server checks again).
  const mine = useMemo(() => {
    const q = query.trim().toLowerCase();
    return communities.filter((c) => c.girlOnly === (room.space === 'irly_girl')).filter((c) => !q || `${c.groupOf ?? ''} ${c.name}`.toLowerCase().includes(q));
  }, [communities, query, room.space]);
  const close = () => {
    setStep('menu');
    setQuery('');
    onClose();
  };
  const link = () => {
    const url = room.code ? JOIN_URL + room.code : ROOM_URL + room.id;
    const message = room.code ? tx('Join my Loup-Garou game on IRLY with the code {code}: {url}', { code: room.code, url }) : tx('Join my Loup-Garou game on IRLY: {url}', { url });
    Share.share({ message }).catch(() => undefined);
  };
  const publish = (community: { id: string; name: string }) => {
    if (busy) return;
    const live = step === 'live';
    setBusy(true);
    shareGame(room.id, community.id, live)
      .then(() => {
        setDone((d) => [...d, `${step}:${community.id}`]);
        toast(tx(live ? 'Your game is shared on the Live and in the community.' : 'Your game is shared in the community.'), 'check');
        close();
      })
      .catch((e: unknown) => toast(e instanceof Error ? tx(e.message) : tx('Try again'), 'x', 'live'))
      .finally(() => setBusy(false));
  };
  return (
    <Sheet
      visible={visible}
      onClose={close}
      scroll
      title={tx(step === 'menu' ? 'Invite players' : step === 'live' ? 'Share on the Live' : 'Share in a community')}
      subtitle={step === 'menu' ? undefined : tx(step === 'live' ? 'The post shows in the community and, for 24 hours, on the Live.' : 'Members of the community will see the game and can join it.')}
    >
      {step === 'menu' ? (
        <View style={styles.list} testID="invite-menu">
          {room.code ? (
            <View style={styles.code}>
              <Text style={styles.codeLabel}>{tx('Code of this private game')}</Text>
              <Text style={styles.codeText} selectable>
                {room.code}
              </Text>
            </View>
          ) : null}
          <Row icon="heartHandshake" label={tx('Share in a community')} onPress={() => setStep('community')} testID="share-community" />
          <Row icon="megaphone" label={tx('Share on the Live')} onPress={() => setStep('live')} testID="share-live" />
          <Row icon="share" label={tx('Send a link')} onPress={link} testID="share-link" />
        </View>
      ) : (
        <View style={styles.list}>
          <Pressable onPress={() => setStep('menu')} accessibilityRole="button" accessibilityLabel={tx('Back')} style={styles.back}>
            <Icon name="arrowLeft" size={16} color={DX.gold} />
            <Text style={styles.backText}>{tx('Back')}</Text>
          </Pressable>
          {communities.length > 4 ? (
            <TextInput value={query} onChangeText={setQuery} placeholder={tx('Search a community')} placeholderTextColor="#8A8172" autoCorrect={false} style={styles.search} accessibilityLabel={tx('Search a community')} testID="share-search" />
          ) : null}
          {mine.length ? (
            mine.map((c) => {
              const shared = done.includes(`${step}:${c.id}`);
              return (
                <Pressable key={c.id} onPress={() => publish(c)} disabled={busy} accessibilityRole="button" accessibilityLabel={c.name} accessibilityState={{ disabled: busy, selected: shared }} style={[styles.community, shared ? styles.shared : null, busy ? styles.busy : null]} testID="share-pick">
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{c.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.communityName} numberOfLines={1}>
                    {c.groupOf ? `${c.groupOf} · ${c.name}` : c.name}
                  </Text>
                  <Icon name={shared ? 'check' : 'chevronRight'} size={18} color={DX.gold} />
                </Pressable>
              );
            })
          ) : communities.length ? (
            <Text style={styles.empty}>{tx('No community matches.')}</Text>
          ) : (
            <>
              <Text style={styles.empty}>{tx('You are not in a community yet. Join one, then share your game there.')}</Text>
              <Pressable
                onPress={() => {
                  close();
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
      )}
    </Sheet>
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
      style={styles.community}
      testID={testID}
    >
      <Icon name={icon} size={18} color={DX.goldLight} />
      <Text style={styles.communityName}>{label}</Text>
      <Icon name="chevronRight" size={18} color={DX.goldDark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  code: { alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(226,182,83,0.35)' },
  codeLabel: { color: '#B9AF9C', fontSize: 13 },
  codeText: { color: DX.goldLight, fontSize: 28, fontWeight: '800', letterSpacing: 6 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  backText: { color: DX.gold, fontSize: 14, fontWeight: '600' },
  search: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(226,182,83,0.35)', color: DX.ivory, paddingHorizontal: 14, fontSize: 16 },
  community: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(226,182,83,0.35)' },
  shared: { borderColor: DX.gold, backgroundColor: 'rgba(226,182,83,0.12)' },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(226,182,83,0.18)' },
  badgeText: { color: DX.goldLight, fontSize: 15, fontWeight: '800' },
  communityName: { flex: 1, fontSize: 15, fontWeight: '600', color: DX.goldLight },
  empty: { color: '#B9AF9C', fontSize: 14, lineHeight: 20 },
  busy: { opacity: 0.5 },
});
