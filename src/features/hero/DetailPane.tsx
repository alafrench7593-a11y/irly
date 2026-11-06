import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaneEmpty } from '@/components/layout/SplitView';
import { Badge, IconButton } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Backdrop } from '@/components/visual/Backdrop';
import { Photo } from '@/components/visual/Photo';
import { t as tx } from '@/i18n';
import { motion } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';
import { DetailBody, DetailCTA, getHeader } from './details';
import { openHero, type HeroItem, type HeroKind } from './heroStore';

const COVER = 340;

/**
 * A card's detail in the right pane of a list + detail screen (wide
 * screens): the same header, body and action as the full-screen card
 * (HeroHost), without the grow-from-the-card transition since the list
 * stays beside it. The action (Going / Maybe) is pinned at the bottom of
 * the pane, always in reach however long the detail.
 *
 * A link to another card (`/hero/<kind>/<id>`) goes to `onOpen` (the
 * screen shows it in this pane when it is one of its own), else opens
 * full screen; any other link is a page.
 */
export function DetailPane({ item, onOpen = (next) => openHero(next) }: { item: HeroItem; onOpen?: (item: HeroItem) => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const header = getHeader(item);
  const key = `${item.kind}:${item.id}`;

  // Another card starts at its top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [key]);

  const go = useCallback(
    (href: string) => {
      const m = href.match(/^\/hero\/(\w+)\/(.+)$/);
      if (m) onOpen({ kind: m[1] as HeroKind, id: m[2] });
      else router.push(href as never);
    },
    [onOpen, router],
  );

  if (!header) return <PaneEmpty icon="search" title="This is no longer available" />;

  return (
    <View style={styles.root}>
      {/* The pane sits on its own photo, blurred and pushed back (as the full-screen card). */}
      <Backdrop visual={header.visual} light={header.light} dim={0.6} />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 200 + insets.bottom }}>
        <View style={styles.cover}>
          <Photo visual={header.visual} light={header.light} scrim="strong" width={1200} style={StyleSheet.absoluteFill} recyclingKey={key} />
          <View style={styles.headerText}>
            <View style={styles.overlineRow}>
              <Icon name={header.overlineIcon} size={14} color="#FFFFFF" />
              <Text variant="overline" tone="onDark">
                {header.overline}
              </Text>
              {header.verified ? <Badge kind="verified" onDark /> : null}
              {header.pick ? <Badge kind="pick" onDark /> : null}
            </View>
            <Text variant="displayL" tone="onDark" numberOfLines={3}>
              {header.title}
            </Text>
            <Text variant="body" color="rgba(255,255,255,0.82)" numberOfLines={2}>
              {header.meta}
            </Text>
          </View>
        </View>
        <Animated.View key={key} entering={reduced ? undefined : FadeIn.duration(motion.normal)}>
          <DetailBody item={item} go={go} />
        </Animated.View>
      </ScrollView>

      <View style={[styles.chrome, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton
          icon="share"
          label="Share"
          variant="glass"
          onPress={() => {
            Share.share({ message: tx('{title} on IRLY', { title: `${header.title} · ${header.meta}` }) }).catch(() => undefined);
          }}
        />
      </View>

      <View style={styles.cta}>
        <Glass style={[styles.ctaGlass, { paddingBottom: Math.max(insets.bottom, space[4]) }]} intensity={50}>
          <DetailCTA key={key} item={item} go={go} />
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  cover: { height: COVER, overflow: 'hidden', justifyContent: 'flex-end' },
  headerText: { padding: space.gutter, paddingBottom: space[7], gap: 8 },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chrome: { position: 'absolute', right: space.gutter, flexDirection: 'row', gap: 8 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  ctaGlass: {
    paddingTop: space[4],
    paddingHorizontal: space.gutter,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
});
