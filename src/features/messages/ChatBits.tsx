import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { duration, spring } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { CommunityRole } from './communityChat';
import type { PinLength } from './communitySpace';
import { QUICK_REACTIONS, type ReactionChip } from './reactions';

/** The words of a community role on a badge; members have none. */
const ROLE_LABEL: Partial<Record<CommunityRole, string>> = { owner: 'Creator', co_admin: 'Co-admin', moderator: 'Moderator' };

/** Créateur, Co-admin or Modérateur next to a sender's name in a community chat. */
export const RoleBadge = memo(function RoleBadge({ role }: { role: CommunityRole | undefined }) {
  const t = useTheme();
  const label = role ? ROLE_LABEL[role] : undefined;
  if (!label) return null;
  return (
    <View style={[styles.badge, { backgroundColor: t.c.brandSoft, borderColor: t.c.line }]}>
      {role === 'owner' ? <Icon name="star" size={10} color={t.c.brand} strokeWidth={2.4} /> : <Icon name="shield" size={10} color={t.c.steel} strokeWidth={2.4} />}
      <Text variant="caption" color={role === 'owner' ? t.c.brand : t.c.steel} style={styles.badgeText}>
        {label}
      </Text>
    </View>
  );
});

/** What a quote shows of a message: its text, « Photo », or that it is gone. */
export function quoteText(q: { text: string; photo: boolean; gone?: boolean }): string {
  if (q.gone) return tx('Message unavailable');
  if (q.photo) return tx('📷 Photo');
  return q.text;
}

/**
 * The message a bubble answers, inside the bubble. Tap: back to the original
 * when it is in the loaded part of the chat.
 */
export function QuoteInBubble({ name, text, mine, onPress }: { name: string; text: string; mine: boolean; onPress?: () => void }) {
  const t = useTheme();
  const fg = mine ? t.c.onBrand : t.c.text;
  return (
    <PressableScale
      haptic={onPress ? 'select' : false}
      scaleTo={0.98}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.quote, { backgroundColor: mine ? 'rgba(127,127,127,0.18)' : t.c.brandSoft, borderLeftColor: mine ? t.c.onBrand : t.c.brand }]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={tx('Message from {name}: go to it', { name })}
    >
      <Text variant="caption" color={fg} numberOfLines={1} style={{ fontWeight: '700' }} raw>
        {name}
      </Text>
      <Text variant="bodyS" color={fg} numberOfLines={2} style={{ opacity: 0.85 }} raw>
        {text}
      </Text>
    </PressableScale>
  );
}

/** Above the composer while answering: who and what, and a cross to stop. */
export function ReplyBar({ name, text, onClose }: { name: string; text: string; onClose: () => void }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.springify(spring.snappy.duration).dampingRatio(spring.snappy.dampingRatio)} exiting={reduced ? undefined : FadeOut.duration(duration.fast)} style={[styles.replyBar, { borderLeftColor: t.c.brand }]}>
      <GlassLayer radius={radius.md} level="thin" />
      <Icon name="message" size={16} color={t.c.textSecondary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {tx('Replying to {name}', { name })}
        </Text>
        <Text variant="bodyS" numberOfLines={1} raw>
          {text}
        </Text>
      </View>
      <PressableScale haptic="select" scaleTo={0.88} onPress={onClose} hitSlop={8} style={styles.replyClose} accessibilityLabel="Cancel the reply">
        <Icon name="x" size={16} color={t.c.text} />
      </PressableScale>
    </Animated.View>
  );
}

/** Reactions under a bubble: one chip per emoji with its count; tap one to add or take back mine. */
export const ReactionChips = memo(function ReactionChips({ chips, mine, onToggle }: { chips: ReactionChip[] | undefined; mine: boolean; onToggle?: (emoji: string) => void }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  if (!chips?.length) return null;
  return (
    <Animated.View layout={reduced ? undefined : LinearTransition.springify(spring.snappy.duration)} style={[styles.chips, mine ? { justifyContent: 'flex-end' } : null]}>
      {chips.map((c) => (
        <Animated.View key={c.emoji} entering={reduced ? undefined : ZoomIn.springify(spring.fast.duration).dampingRatio(0.7)}>
          <PressableScale
            haptic="select"
            scaleTo={0.9}
            onPress={onToggle ? () => onToggle(c.emoji) : undefined}
            disabled={!onToggle}
            style={[styles.chip, { borderColor: c.mine ? t.c.brand : t.c.line, backgroundColor: c.mine ? t.c.brandSoft : 'transparent' }]}
            accessibilityRole="button"
            accessibilityState={{ selected: c.mine }}
            accessibilityLabel={c.mine ? tx('{emoji} {n}, yours: tap to take it back', { emoji: c.emoji, n: c.count }) : tx('{emoji} {n}: tap to react', { emoji: c.emoji, n: c.count })}
          >
            {c.mine ? null : <GlassLayer radius={radius.pill} level="thin" />}
            <Text variant="caption" raw>
              {c.emoji}
            </Text>
            <Text variant="caption" tone={c.mine ? 'primary' : 'secondary'} style={{ fontWeight: '700' }} raw>
              {String(c.count)}
            </Text>
          </PressableScale>
        </Animated.View>
      ))}
    </Animated.View>
  );
});

/**
 * The long-press menu of a message: a quick reaction row (when reactions
 * are possible here), then the actions given as children.
 */
export function MessageMenu({
  visible,
  onClose,
  subtitle,
  preview,
  reactions,
  picked,
  onReact,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  subtitle?: string;
  /** The message itself, a line, so the member sees what the menu is about. */
  preview?: string;
  reactions: boolean;
  /** Emojis I already put on this message. */
  picked?: string[];
  onReact?: (emoji: string) => void;
  children: ReactNode;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  return (
    <Sheet visible={visible} onClose={onClose} title="Message" subtitle={subtitle}>
      <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
        {preview ? (
          <Text variant="bodyS" tone="secondary" numberOfLines={2} raw style={{ marginBottom: 2 }}>
            {preview}
          </Text>
        ) : null}
        {reactions && onReact ? (
          <View style={styles.reactRow} accessibilityRole="toolbar" accessibilityLabel={tx('React')}>
            {QUICK_REACTIONS.map((e, i) => {
              const on = Boolean(picked?.includes(e));
              return (
                <Animated.View key={e} entering={visible && !reduced ? ZoomIn.springify(spring.fast.duration).dampingRatio(0.66).delay(i * 30) : undefined}>
                  <PressableScale
                    haptic="select"
                    scaleTo={0.84}
                    onPress={() => onReact(e)}
                    style={[styles.react, { borderColor: on ? t.c.brand : 'transparent', backgroundColor: on ? t.c.brandSoft : 'transparent' }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={tx('React with {emoji}', { emoji: e })}
                  >
                    {on ? null : <GlassLayer radius={24} level="thin" />}
                    <Text variant="titleM" raw>
                      {e}
                    </Text>
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        ) : null}
        {children}
      </View>
    </Sheet>
  );
}

/** A moderator removes someone's message: the reason is asked first (it goes to the community's journal). */
export function ModerationSheet({ visible, name, busy, onClose, onConfirm }: { visible: boolean; name?: string; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [openFor, setOpenFor] = useState(visible);
  if (visible !== openFor) {
    setOpenFor(visible);
    if (visible) setReason('');
  }
  const ready = reason.trim().length >= 3;
  return (
    <Sheet visible={visible} onClose={onClose} title="Delete (moderation)" subtitle={name ? tx('Message from {name}', { name }) : undefined} scroll>
      <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
        <Text variant="bodyS" tone="secondary">
          The message is removed for everyone. The reason is kept in the community’s journal.
        </Text>
        <Field placeholder="Reason (required)" value={reason} onChangeText={setReason} maxLength={300} multiline accessibilityLabel={tx('Reason')} />
        <Button label="Delete the message" icon="shield" variant="danger" full loading={busy} disabled={!ready || busy} onPress={() => ready && onConfirm(reason.trim())} />
        <Button label="Cancel" variant="secondary" full onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** A pinned message as the banner shows it. */
export type PinnedLine = { id: string; name: string; text: string };

/** How long one pin stays in the banner before the next one (several pins). */
const PIN_CYCLE_MS = 6000;

/**
 * The pinned messages at the top of a community chat: one at a time, the
 * next every few seconds; a tap goes to the message shown, then shows the
 * next one (as the member reads them in turn).
 */
export function PinnedBanner({ pins, onOpen }: { pins: PinnedLine[]; onOpen: (messageId: string) => void }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const count = pins.length;
  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), PIN_CYCLE_MS);
    return () => clearInterval(timer);
  }, [count]);
  if (!count) return null;
  const at = index % count;
  const pin = pins[at];
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.98}
      onPress={() => {
        onOpen(pin.id);
        if (count > 1) setIndex((at + 1) % count);
      }}
      style={[styles.pinned, { borderLeftColor: t.flavor === 'girl' ? t.c.brand : t.c.steel }]}
      accessibilityRole="button"
      accessibilityLabel={tx('Pinned message from {name}: go to it', { name: pin.name })}
    >
      <GlassLayer radius={radius.md} level="thin" />
      <Icon name="pinPost" size={16} color={t.flavor === 'girl' ? t.c.brand : t.c.steel} strokeWidth={2.2} />
      <Animated.View key={pin.id} entering={reduced ? undefined : FadeIn.duration(duration.fast)} style={{ flex: 1, minWidth: 0 }}>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {count > 1 ? tx('Pinned · {n}/{total}', { n: at + 1, total: count }) : tx('Pinned message')}
        </Text>
        <Text variant="bodyS" numberOfLines={1} raw>
          {`${pin.name}: ${pin.text}`}
        </Text>
      </Animated.View>
      <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
    </PressableScale>
  );
}

/** A moderator pins a message: for a day, a week, or until unpinned. */
export function PinSheet({ visible, busy, onClose, onPick }: { visible: boolean; busy: PinLength | null; onClose: () => void; onPick: (length: PinLength) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Pin the message" subtitle={tx('Shown at the top of the chat for everyone')}>
      <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
        <Button label="For 24 hours" icon="clock" full loading={busy === '24h'} disabled={busy !== null} onPress={() => onPick('24h')} />
        <Button label="For 7 days" icon="calendar" variant="secondary" full loading={busy === '7d'} disabled={busy !== null} onPress={() => onPick('7d')} />
        <Button label="Until I unpin it" icon="pinPost" variant="secondary" full loading={busy === 'none'} disabled={busy !== null} onPress={() => onPick('none')} />
        <Button label="Cancel" variant="ghost" full onPress={onClose} />
      </View>
    </Sheet>
  );
}

/**
 * Web: a right click opens the same menu as a long press (and not the
 * browser's). Phones: renders its children as they are.
 */
export function ContextMenuArea({ onMenu, children }: { onMenu: () => void; children: ReactNode }) {
  const ref = useRef<View>(null);
  const fn = useRef(onMenu);
  useEffect(() => {
    fn.current = onMenu;
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const handler = (e: Event) => {
      e.preventDefault();
      fn.current();
    };
    node.addEventListener('contextmenu', handler);
    return () => node.removeEventListener('contextmenu', handler);
  }, []);
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View ref={ref} style={{ maxWidth: '100%', flexShrink: 1 }}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, height: 18, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontSize: 10, lineHeight: 13, fontWeight: '700' },
  quote: { borderLeftWidth: 3, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6, gap: 1 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: space.gutter, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderLeftWidth: 3, overflow: 'hidden' },
  replyClose: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingHorizontal: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  reactRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 4 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 12, borderRadius: radius.md, borderLeftWidth: 3, overflow: 'hidden' },
  react: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, overflow: 'hidden' },
});
