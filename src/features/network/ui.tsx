import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { DEMO } from '@/config/app';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { isAvatar } from '@/features/avatar/avatar';
import { IrlyAvatar } from '@/features/avatar/IrlyAvatar';
import { removeFriend } from '@/features/server/social';
import { openDirect } from '@/features/server/engage';
import { useT, useTg } from '@/i18n';
import { initials } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { SelectionLayers, useSelection } from '@/motion/Selection';
import { ease } from '@/motion/tokens';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { NetworkScope } from '@/theme/flavor';
import { useAppSpace } from '@/state/appSpace';
import { useStore } from '@/state/store';
import { proConnect, rememberPro } from './api';
import { demoConnect, demoDisconnect } from './demo';
import { matchSentence, roundDistance, type ProMatch, type ProProfile } from './match';
import { stateIn, usePressLight, useScreenFocused } from './motion';
import { agreeOf, INDUSTRY, ROLE_LABEL, skillLabel } from './taxonomy';
import { AccentFill, layered, NetworkPane, useNetworkTone } from './tone';

export const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** "Dubai Marina · Dubai", or the city alone when there is no neighbourhood. */
export function placeOf(p: Pick<ProProfile, 'cityId' | 'areaId'>): string {
  const city = CITIES[p.cityId as CityId];
  if (!city) return p.cityId;
  return p.areaId ? `${areaName(city, p.areaId)} · ${city.name}` : city.name;
}

// The demonstration build answers from this tab's memory (demo.ts), never the server.
const connect = DEMO ? demoConnect : proConnect;
const disconnect = DEMO ? demoDisconnect : removeFriend;

/**
 * Connect → Requested → Connected (Message). An incoming request shows
 * Accept. Every state change is optimistic and rolls back on failure; the
 * button is busy while the server answers and never sends twice. Each new
 * state fades in where the old one was.
 */
export function ConnectAction({
  pro,
  onChange,
  size = 'sm',
  full,
}: {
  pro: Pick<ProProfile, 'userId' | 'firstName' | 'connection' | 'gender'>;
  onChange: (c: ProProfile['connection']) => void;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
}) {
  const router = useRouter();
  const tr = useT();
  const tg = useTg();
  // « {name} et toi êtes connectées » when you are both women.
  const girl = useAppSpace() === 'girl';
  const iAmWoman = useStore((s) => s.profile.gender === 'woman');
  const both = iAmWoman && agreeOf(pro, girl) === 'woman' ? 'woman' : 'man';
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  // State lags a fast double tap; the ref does not, so each action (and each chat push) runs once.
  const inFlight = useRef(false);
  const run = async (next: ProProfile['connection'], work: () => Promise<unknown>, done: string) => {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    const before = pro.connection;
    setBusy(true);
    onChange(next);
    try {
      const r = await work();
      // They had already asked you: Connect accepted their request.
      const accepted = r === 'accepted';
      // Accept on a request withdrawn meanwhile only sent yours: a request, never shown as a connection.
      const onlySent = r === 'pending' && next === 'connected';
      if (accepted) onChange('connected');
      else if (onlySent) onChange('requested');
      haptic('success');
      toast(tg(accepted ? 'You and {name} are connected' : onlySent ? 'Request sent to {name}' : done, both, { name: pro.firstName }), 'check', 'brand');
    } catch (e) {
      onChange(before);
      haptic('error');
      toast(e instanceof Error ? e.message : tr('Could not connect'), 'x', 'live');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (pro.connection === 'connected') {
    body = (
      <Button
        label="Message"
        icon="message"
        size={size}
        full={full}
        loading={busy}
        onPress={async () => {
          if (inFlight.current) return;
          if (DEMO) return toast(tr('Chats with example people are not available in the demo'), 'message', 'brand');
          inFlight.current = true;
          setBusy(true);
          try {
            const conv = await openDirect(pro.userId);
            router.push(`/messages/${conv}`);
          } catch (e) {
            toast(e instanceof Error ? e.message : tr('Could not open the chat'), 'x', 'live');
          } finally {
            setBusy(false);
            setTimeout(() => {
              inFlight.current = false;
            }, 700);
          }
        }}
      />
    );
  } else if (pro.connection === 'incoming') {
    body = (
      <View style={{ flexDirection: 'row', gap: 8, alignSelf: full ? 'stretch' : 'auto' }}>
        <View style={{ flex: 2 }}>
          <Button label="Accept" icon="check" size={size} full loading={busy} onPress={() => run('connected', () => connect(pro.userId), 'You and {name} are connected')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Decline" variant="secondary" size={size} full disabled={busy} onPress={() => run('none', () => disconnect(pro.userId), 'Request from {name} declined')} />
        </View>
      </View>
    );
  } else if (pro.connection === 'requested') {
    body = (
      <Button
        label="Requested"
        icon="clock"
        variant="secondary"
        size={size}
        full={full}
        loading={busy}
        accessibilityHint={tr('Tap to withdraw the request')}
        onPress={() => run('none', () => disconnect(pro.userId), 'Request to {name} withdrawn')}
      />
    );
  } else {
    body = <Button label="Connect" icon="plus" size={size} full={full} loading={busy} onPress={() => run('requested', () => connect(pro.userId), 'Request sent to {name}')} />;
  }
  return (
    <Animated.View key={pro.connection} entering={reduced ? undefined : stateIn} style={full ? styles.stretch : null}>
      {body}
    </Animated.View>
  );
}

/**
 * "92%" in a pill of the accent (violet gradient in IRLY Girl, silver in
 * IRLY). `inverted` sits on a contrast panel.
 */
export function MatchPill({ percent, inverted, small }: { percent: number; inverted?: boolean; small?: boolean }) {
  const t = useTheme();
  const tone = useNetworkTone();
  const box = [styles.pill, small ? styles.pillSmall : null];
  if (inverted) {
    const bg = tone.isGirl ? '#FFFFFF' : t.c.bg;
    const fg = tone.isGirl ? tone.accent : t.c.text;
    return (
      <View style={[box, { backgroundColor: bg }]}>
        <Icon name="sparkles" size={12} color={fg} />
        <Text variant="label" color={fg} raw>
          {`${percent}%`}
        </Text>
      </View>
    );
  }
  return (
    <View style={[box, layered, { overflow: 'hidden', boxShadow: tone.glow }]} accessibilityLabel={`${percent}%`}>
      <AccentFill colors={tone.gradient} />
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']} locations={[0, 0.6]} style={[StyleSheet.absoluteFill, styles.under]} />
      <Icon name="sparkles" size={small ? 11 : 12} color={tone.onAccent} />
      <Text variant="label" color={tone.onAccent} raw style={small ? { fontSize: 12 } : undefined}>
        {`${percent}%`}
      </Text>
    </View>
  );
}

export function IndustryTags({ ids, max = 3 }: { ids: ProProfile['industries']; max?: number }) {
  const t = useTheme();
  const tr = useT();
  return (
    <View style={styles.tags}>
      {ids.slice(0, max).map((id) => (
        <View key={id} style={[styles.tag, { borderColor: t.c.line }]}>
          <Text variant="caption" raw>
            {`${INDUSTRY[id].emoji} ${tr(INDUSTRY[id].short)}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A member's portrait at a fixed size (no layout jump while it loads): the
 * Network gradient with her initials first, then her photo dissolving in
 * once it has loaded (or her IRLY avatar). `placeholder` is a photo already
 * on the phone (the small copy a card showed), drawn at once under `uri`.
 * Never a stock picture: no photo stays initials.
 */
export const Portrait = memo(function Portrait({
  name,
  uri,
  placeholder,
  width,
  height,
  radius: r,
  lift = 0,
}: {
  name: string;
  uri?: string | null;
  placeholder?: string | null;
  width: number | '100%';
  height: number;
  radius: number;
  /** Raises the initials (and avatar) above the centre, clear of text laid at the bottom. */
  lift?: number;
}) {
  const tone = useNetworkTone();
  const reduced = useReducedMotion();
  const shown = useSharedValue(0);
  const [failed, setFailed] = useState<string | null>(null);
  const avatar = uri && isAvatar(uri) ? uri : null;
  const photo = uri && !avatar && failed !== uri ? uri : null;
  const under = placeholder && placeholder !== photo && !isAvatar(placeholder) ? placeholder : null;
  const fade = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: 1.035 - 0.035 * shown.value }] }));
  const onLoad = useCallback(() => {
    shown.set(reduced ? 1 : withTiming(1, { duration: 420, easing: ease.enter }));
  }, [shown, reduced]);
  const size = Math.min(typeof width === 'number' ? width : height, height);
  return (
    <View style={[styles.portrait, { width, height, borderRadius: r }]}>
      <LinearGradient colors={tone.surface.portrait} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.center, { paddingBottom: lift * 2 }]}>
        <RNText allowFontScaling={false} style={{ fontFamily: font.heavy, fontSize: Math.round(size * 0.34), letterSpacing: -0.5, color: tone.surface.initials }}>
          {initials(name)}
        </RNText>
      </View>
      {avatar ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { paddingBottom: lift * 2 }]}>
          <IrlyAvatar config={avatar} size={Math.round(size * (lift ? 0.6 : 0.86))} />
        </View>
      ) : null}
      {under ? <Image source={{ uri: under }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : null}
      {photo ? (
        <Animated.View style={[StyleSheet.absoluteFill, fade]}>
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoad={onLoad}
            onError={() => setFailed(photo)}
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      ) : null}
    </View>
  );
});

/**
 * A professional in the Discover list: a pane of Network glass led by her
 * portrait. Who (photo, role, name, job and company), where (neighbourhood,
 * rounded distance), what she builds, two domains and three skills (yours
 * first) and why you match (the goals you share are in that sentence), then
 * Connect and the profile. Pressing it sinks the pane a touch under a soft light; opening
 * hands the card's data and photo to the profile, which opens on them.
 */
export const ProCard = memo(function ProCard({
  pro,
  photo,
  match,
  mine,
  onConnection,
}: {
  pro: ProProfile;
  photo?: string;
  match: ProMatch | null;
  /** Your own professional profile, for what you share. */
  mine?: ProProfile | null;
  onConnection: (userId: string, c: ProProfile['connection']) => void;
}) {
  const t = useTheme();
  const tone = useNetworkTone();
  const tr = useT();
  const tg = useTg();
  const who = agreeOf(pro, useAppSpace() === 'girl');
  const router = useRouter();
  const { press, onPressIn, onPressOut } = usePressLight();
  const where = [placeOf(pro), match?.distanceKm != null ? roundDistance(match.distanceKm) : null].filter(Boolean).join(' · ');
  const sharedSkill = (s: string) => Boolean(mine?.skills.some((x) => x.toLowerCase() === s.toLowerCase()));
  const skills = [...pro.skills].sort((a, b) => Number(sharedSkill(b)) - Number(sharedSkill(a))).slice(0, 3);
  const open = () => {
    rememberPro(pro, photo);
    router.push(`/network/${pro.userId}`);
  };
  const change = useCallback((c: ProProfile['connection']) => onConnection(pro.userId, c), [onConnection, pro.userId]);
  const profile = <SoftButton label="View profile" onPress={open} />;
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.975}
      onPress={open}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityLabel={[pro.firstName, pro.jobTitle, pro.company].filter(Boolean).join(', ')}
      style={[styles.card, { boxShadow: tone.surface.shadow }]}
    >
      <NetworkPane radius={radius.xl} press={press} />
      <View style={styles.head}>
        <View>
          <Portrait name={pro.firstName} uri={photo} width={PORTRAIT_W} height={PORTRAIT_H} radius={radius.lg} />
          {match ? (
            <View style={styles.pillOnPhoto}>
              <MatchPill percent={match.percent} small />
            </View>
          ) : null}
        </View>
        <View style={styles.who}>
          <Text variant="overline" color={tone.isGirl ? tone.accent : t.c.textSecondary} numberOfLines={1} raw>
            {tg(ROLE_LABEL[pro.role], who)}
          </Text>
          <Text variant="titleM" numberOfLines={1} raw>
            {pro.firstName}
          </Text>
          <Text variant="bodyS" numberOfLines={2} raw style={{ color: t.c.text }}>
            {pro.company ? `${pro.jobTitle} · ${pro.company}` : pro.jobTitle}
          </Text>
          <View style={[styles.whereRow, { marginTop: 'auto' }]}>
            <Icon name="pin" size={12} color={t.c.textTertiary} />
            <Text variant="caption" tone="tertiary" numberOfLines={1} raw style={{ flexShrink: 1 }}>
              {where}
            </Text>
          </View>
        </View>
      </View>

      {pro.project ? (
        <Text variant="bodyS" tone="secondary" numberOfLines={2} raw>
          {pro.project}
        </Text>
      ) : null}
      <View style={styles.tags}>
        {pro.industries.slice(0, 2).map((id) => (
          <View key={id} style={[styles.tag, { borderColor: tone.surface.chipLine, backgroundColor: tone.surface.chip }]}>
            <Text variant="caption" numberOfLines={1} raw>
              {`${INDUSTRY[id].emoji} ${tr(INDUSTRY[id].short)}`}
            </Text>
          </View>
        ))}
        {skills.map((s) => {
          const shared = sharedSkill(s);
          return (
            <View key={s} style={[styles.tag, { maxWidth: '100%', borderColor: shared ? tone.accent : t.c.line, backgroundColor: shared ? tone.accent : 'transparent' }]}>
              {shared ? <Icon name="check" size={11} color={tone.onAccent} strokeWidth={2.6} /> : null}
              <Text variant="caption" color={shared ? tone.onAccent : t.c.textSecondary} numberOfLines={1} raw>
                {skillLabel(s, tr)}
              </Text>
            </View>
          );
        })}
      </View>
      {match ? (
        <View style={[styles.why, { backgroundColor: tone.soft, borderColor: tone.softLine }]}>
          <Text variant="caption" numberOfLines={3} raw style={{ color: t.c.textSecondary }}>
            <Text variant="caption" style={{ fontFamily: font.heavy }} raw color={tone.isGirl ? tone.accent : t.c.text}>
              {tr('{n}% match', { n: match.percent })}
            </Text>
            {` — ${matchSentence(match, tr, tg, who)}`}
          </Text>
        </View>
      ) : null}
      {pro.connection === 'incoming' ? (
        // Accept and Decline need the width: the profile goes underneath.
        <View style={{ gap: 8, marginTop: space[1] }}>
          <View style={[styles.incoming, { backgroundColor: tone.soft }]}>
            <Icon name="sparkles" size={12} color={tone.accent} />
            <Text variant="caption" tone="secondary">
              Wants to connect with you
            </Text>
          </View>
          <ConnectAction pro={pro} onChange={change} full />
          {profile}
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <ConnectAction pro={pro} onChange={change} full />
          </View>
          {profile}
        </View>
      )}
    </PressableScale>
  );
});

const PORTRAIT_W = 104;
const PORTRAIT_H = 130;

/** The quiet action next to the main one (View profile): a soft pill of the accent. */
export function SoftButton({ label, icon = 'chevronRight', onPress }: { label: string; icon?: IconName; onPress: () => void }) {
  const t = useTheme();
  const tone = useNetworkTone();
  const fg = tone.isGirl ? tone.accent : t.c.text;
  return (
    <PressableScale haptic="select" scaleTo={0.95} onPress={onPress} accessibilityLabel={label} style={[styles.soft, { backgroundColor: tone.soft, borderColor: tone.softLine }]}>
      <Text variant="label" color={fg} numberOfLines={1}>
        {label}
      </Text>
      <Icon name={icon} size={15} color={fg} strokeWidth={2.2} />
    </PressableScale>
  );
}

/**
 * The glint that sweeps loading placeholders: one value per placeholder
 * group, running only while the screen is focused and never with « Reduce
 * motion ». Cancelled when the group unmounts.
 */
export function useGlint(): SharedValue<number> {
  const reduced = useReducedMotion();
  const focused = useScreenFocused();
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduced || !focused) {
      cancelAnimation(x);
      return;
    }
    x.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(x);
  }, [x, reduced, focused]);
  return x;
}

/** One block of a loading placeholder, in the Network colours. */
export const Shimmer = memo(function Shimmer({ glint, width = '100%', height, radius: r = 8, style }: { glint: SharedValue<number>; width?: number | `${number}%`; height: number; radius?: number; style?: object }) {
  const tone = useNetworkTone();
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: `${-100 + glint.value * 200}%` }] }));
  return (
    <View style={[{ width, height, borderRadius: r, overflow: 'hidden', backgroundColor: tone.surface.skeleton }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, band]}>
        <LinearGradient colors={['rgba(255,255,255,0)', tone.surface.glint, 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
});

/** A professional card while the list loads: the same geometry, so nothing jumps when it arrives. */
export const ProCardSkeleton = memo(function ProCardSkeleton() {
  const tone = useNetworkTone();
  const glint = useGlint();
  return (
    <View style={[styles.card, { boxShadow: tone.surface.shadow }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <NetworkPane radius={radius.xl} />
      <View style={styles.head}>
        <Shimmer glint={glint} width={PORTRAIT_W} height={PORTRAIT_H} radius={radius.lg} />
        <View style={[styles.who, { gap: 10, paddingTop: 2 }]}>
          <Shimmer glint={glint} width="34%" height={9} radius={5} />
          <Shimmer glint={glint} width="58%" height={18} radius={7} />
          <Shimmer glint={glint} width="86%" height={12} radius={6} />
          <Shimmer glint={glint} width="48%" height={10} radius={5} style={{ marginTop: 'auto' }} />
        </View>
      </View>
      <Shimmer glint={glint} width="92%" height={12} radius={6} />
      <View style={styles.tags}>
        {[64, 78, 56].map((w) => (
          <Shimmer key={w} glint={glint} width={w} height={26} radius={13} />
        ))}
      </View>
      <View style={styles.actions}>
        <Shimmer glint={glint} height={34} radius={17} style={{ flex: 1 }} />
        <Shimmer glint={glint} width={96} height={34} radius={17} />
      </View>
    </View>
  );
});

/**
 * A filter of Network: a pill of quiet glass at rest (no live blur, rails
 * hold many), flooded with the accent when chosen (violet in IRLY Girl, ink
 * in IRLY), with the shared selection moment.
 */
export const FilterChip = memo(function FilterChip({
  label,
  selected,
  onPress,
  icon,
  raw,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  /** The label is already in the reader's language (a word agreeing with someone): shown as is. */
  raw?: boolean;
}) {
  const t = useTheme();
  const tone = useNetworkTone();
  const { p, sweep, outer } = useSelection(selected);
  const content = (fg: string) => (
    <>
      {icon ? <Icon name={icon} size={14} color={fg} strokeWidth={2.2} /> : null}
      <Text variant="label" color={fg} numberOfLines={1} raw={raw}>
        {label}
      </Text>
    </>
  );
  return (
    <Animated.View style={outer}>
      <PressableScale haptic="select" scaleTo={0.94} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label}>
        <SelectionLayers
          p={p}
          sweep={sweep}
          fill={tone.accent}
          radius={CHIP_H / 2}
          base={<View style={[styles.chip, { backgroundColor: tone.surface.chip, borderColor: tone.surface.chipLine }]}>{content(t.c.text)}</View>}
          chosen={<View style={[styles.chip, { borderColor: 'transparent' }]}>{content(tone.onAccent)}</View>}
        />
      </PressableScale>
    </Animated.View>
  );
});

const CHIP_H = 36;

/**
 * A full state of a Network list (signed out, can't reach IRLY, no one
 * matches, no one yet): a pane with its mark in rings of the accent, what
 * happened, what to do. Fades in where the list would be.
 */
export function NetworkState({ icon, title, body, children, error }: { icon: IconName; title: string; body?: string; children?: ReactNode; error?: boolean }) {
  const t = useTheme();
  const tone = useNetworkTone();
  return (
    <Animated.View entering={stateIn} style={[styles.state, { boxShadow: tone.surface.shadow }]} accessibilityLiveRegion="polite">
      <NetworkPane radius={radius.xl} />
      <View style={[styles.ring3, { borderColor: tone.softLine }]}>
        <View style={[styles.ring2, { borderColor: tone.softLine, backgroundColor: tone.soft }]}>
          <View style={[styles.mark, layered, { overflow: 'hidden', boxShadow: error ? undefined : tone.glow }]}>
            {error ? <View style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: t.c.overlay }]} /> : <AccentFill colors={tone.gradient} />}
            <Icon name={icon} size={20} color={error ? t.c.textSecondary : tone.onAccent} />
          </View>
        </View>
      </View>
      <Text variant="titleM" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="bodyS" tone="secondary" align="center" style={{ maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {children ? <View style={styles.stateActions}>{children}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: 'stretch' },
  soft: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 34, paddingLeft: 14, paddingRight: 10, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  under: { zIndex: -1 },
  card: { padding: 16, gap: 12, borderRadius: radius.xl, overflow: 'hidden' },
  head: { flexDirection: 'row', gap: 14 },
  who: { flex: 1, gap: 3, minHeight: PORTRAIT_H },
  pillOnPhoto: { position: 'absolute', left: 6, bottom: 6 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 10, borderRadius: radius.pill },
  pillSmall: { height: 24, paddingHorizontal: 8, gap: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: 'center' },
  why: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  incoming: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: radius.pill },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space[1] },
  portrait: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: CHIP_H, paddingHorizontal: 14, borderRadius: CHIP_H / 2, borderWidth: StyleSheet.hairlineWidth * 2 },
  state: { alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22, borderRadius: radius.xl, overflow: 'hidden' },
  ring3: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  ring2: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  stateActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
});

/** The way into professional networking, from the Networking category, Business and your profile. */
/** The door to IRLY Network: already in Network's colours (violet in IRLY Girl, silver in IRLY). */
export function NetworkDoor({ style }: { style?: object }) {
  return (
    <NetworkScope>
      <NetworkDoorCard style={style} />
    </NetworkScope>
  );
}

function NetworkDoorCard({ style }: { style?: object }) {
  const tone = useNetworkTone();
  const tr = useT();
  const router = useRouter();
  const { press, onPressIn, onPressOut } = usePressLight();
  const arrow = useAnimatedStyle(() => ({ transform: [{ translateX: press.value * 4 }] }));
  const bloom = useAnimatedStyle(() => ({ opacity: 0.55 + press.value * 0.45 }));
  // IRLY Girl: the deep violet panel; IRLY: the silver (or ink) panel. Same door, own identity.
  const fg = tone.onPanel;
  return (
    <PressableScale
      haptic="tap"
      scaleTo={0.98}
      onPress={() => router.push('/network')}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={tr('Professionals: meet founders, freelancers and investors')}
      style={[doorStyles.door, layered, { overflow: 'hidden', boxShadow: tone.isGirl ? tone.glow : tone.surface.shadow }, style]}
    >
      <AccentFill colors={tone.panel} />
      {/* Lacquer: light pooled along the top, a thin bright rim, a glow in the corner that warms under the finger. */}
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={[StyleSheet.absoluteFill, doorStyles.under]} />
      <Animated.View pointerEvents="none" style={[doorStyles.corner, bloom]}>
        <LinearGradient colors={[tone.isGirl ? 'rgba(201,182,255,0.42)' : 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, doorStyles.rim, { borderRadius: radius.xl }]} />
      <View style={[doorStyles.icon, { borderColor: fg }]}>
        <Icon name="network" size={20} color={fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="overline" color={fg} style={{ opacity: 0.7 }}>
          Networking
        </Text>
        <Text variant="titleM" color={fg}>
          Professionals
        </Text>
        <Text variant="bodyS" color={fg} style={{ opacity: 0.78 }} numberOfLines={2}>
          Founders, freelancers, investors. See your match, connect, meet IRL.
        </Text>
      </View>
      <Animated.View style={arrow}>
        <Icon name="arrowRight" size={20} color={fg} />
      </Animated.View>
    </PressableScale>
  );
}

const doorStyles = StyleSheet.create({
  door: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.xl },
  under: { zIndex: -1 },
  corner: { position: 'absolute', top: 0, right: 0, width: '60%', height: '100%', zIndex: -1 },
  rim: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', zIndex: 1 },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
