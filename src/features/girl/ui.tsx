import { LinearGradient } from 'expo-linear-gradient';
import { memo, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Chip, GirlFieldFrame } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { enter } from '@/motion/enter';
import { font, radius, type GirlGlassVariant, type GlassLevel } from '@/theme/tokens';
import { girl, girlType } from './theme';

/*
 * IRLY Girl's glass, in roles (tokens: girlGlass). Every Girl surface is one
 * of these, so the screens read as one material:
 * - card: content panes (GCard, GlassFill, GlassLayer)
 * - chip: chips, filters and small round controls
 * - field: text fields (GField, the shared Field)
 * - bar: floating and navigation bars
 * - sheet: sheets and modals (the shared Sheet), over a dimmed plum backdrop
 * - plum: secondary buttons and contrast panels (pearl text on dark plum)
 * The primary action is not glass: a luminous rose lacquer (GButton).
 */

/**
 * IRLY Girl's frosted glass, laid under a control's content: the shared
 * Glass of the design system (blur, nacre rim, top light, sheen; a dense tint
 * on Android). `variant` picks its role; `dark` is for controls placed on a
 * photo, where white text needs a smoked pane. The parent sets the shape
 * (borderRadius) and keeps its own shadow, so the glass never clips it; the
 * parent also sets `zIndex: 0`, so the glass (at -1) stays under its
 * content, icons included, on web too.
 */
export const GlassFill = memo(function GlassFill({ dark, level = 'regular', variant, radius: r }: { dark?: boolean; level?: GlassLevel; variant?: GirlGlassVariant; radius: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1, borderRadius: r, overflow: 'hidden' }]}>
      <Glass light={!dark} dark={dark} level={level} variant={variant} style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
    </View>
  );
});

/**
 * Motion of IRLY Girl, one vocabulary for every screen: cards rise in a
 * stagger, lists re-flow on a spring when their content changes, a
 * confirmation pops. With « Reduce motion » nothing travels: `rise` and
 * `pop` are undefined (the element simply appears) and lists jump.
 */
export function useGirlMotion() {
  const reduced = useReducedMotion();
  return {
    reduced,
    rise: (index = 0, base = 0) => (reduced ? undefined : enter.rise(Math.min(index, 6), base)),
    pop: (index = 0, base = 0) => (reduced ? undefined : enter.pop(index, base)),
    fade: (index = 0, base = 0) => (reduced ? undefined : enter.fade(index, base)),
    layout: reduced ? undefined : GIRL_LAYOUT,
  };
}
const GIRL_LAYOUT = LinearTransition.springify(420).dampingRatio(0.9);

/**
 * A pane of IRLY Girl glass that rises into place: the shared GlassCard in
 * the Girl flavor (nacre rim, top light, soft plum shadow). `index` staggers
 * a list; `onPress` makes the whole card sink a little under the finger.
 */
export function GCard({ children, index = 0, onPress, style, padding = 16, accessibilityLabel }: { children: ReactNode; index?: number; onPress?: () => void; style?: StyleProp<ViewStyle>; padding?: number; accessibilityLabel?: string }) {
  const m = useGirlMotion();
  return (
    <Animated.View entering={m.rise(index)}>
      <GlassCard padding={padding} onPress={onPress} accessibilityLabel={accessibilityLabel} style={[{ boxShadow: girl.shadowSoft }, style]}>
        {children}
      </GlassCard>
    </Animated.View>
  );
}

/** Chip of IRLY Girl: the shared Chip (pearl glass at rest; chosen, a spring bump and a plum flood with a crossfade). */
export const GChip = memo(function GChip({
  label,
  selected,
  onPress,
  icon,
  small,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  small?: boolean;
}) {
  return <Chip label={label} icon={icon} selected={selected} onPress={onPress} size={small ? 'sm' : 'md'} />;
});

/**
 * Button of IRLY Girl: the shared Button, so it has the same press depth,
 * haptics, loading and morph as IRLY Mixte. In the Girl flavor the primary
 * is a luminous rose lacquer with its glow, the secondary a pane of dark
 * plum glass with pearl text, danger is bordeaux. While `loading` (or
 * `disabled`) it takes no tap, so a slow answer never sends twice.
 */
export function GButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <Button label={label} onPress={onPress} icon={icon} variant={variant} disabled={disabled} loading={loading} haptic="press" style={style} />;
}

/**
 * Text field of IRLY Girl for a form's own inputs (one line or several): the
 * Girl field frame (field glass, nacre focus ring, bordeaux shake when
 * `invalid`, a tick when `valid`) around a plain TextInput.
 */
export function GField({ invalid, valid, style, onFocus, onBlur, multiline, containerStyle, ...rest }: TextInputProps & { invalid?: boolean; valid?: boolean; containerStyle?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <GirlFieldFrame focused={focused} invalid={invalid} valid={valid} multiline={multiline} style={containerStyle}>
      <TextInput
        placeholderTextColor={girl.inkFaint}
        selectionColor={girl.rose}
        multiline={multiline}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, multiline ? styles.multi : null, style]}
      />
    </GirlFieldFrame>
  );
}

export function GSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text variant="titleS" color={girl.ink} style={girlType.card}>
          {title}
        </Text>
        {hint ? (
          <Text variant="bodyS" color={girl.inkSoft}>
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The round well an icon sits in: a pearl bead with a nacre sheen (rose
 * icon), or plum with a pearl icon (`plum`), or bordeaux-tinted for errors.
 */
export const GIconWell = memo(function GIconWell({ icon, size = 44, tone = 'pearl' }: { icon: IconName; size?: number; tone?: 'pearl' | 'plum' | 'error' }) {
  const colors = tone === 'plum' ? girl.plumGradient : tone === 'error' ? (['#FBE9EE', '#F6D6E0'] as const) : (['#FFFFFF', '#F6E1E8'] as const);
  const fg = tone === 'plum' ? girl.pearl : tone === 'error' ? girl.bordeaux : girl.rose;
  return (
    <View style={[styles.well, { width: size, height: size, borderRadius: size / 2, boxShadow: tone === 'plum' ? girl.shadowPlum : '0px 4px 10px rgba(122,31,61,0.10)' }]}>
      <LinearGradient colors={colors} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2, zIndex: -1 }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wellRim, { borderRadius: size / 2, borderColor: tone === 'plum' ? 'rgba(255,205,226,0.25)' : 'rgba(255,255,255,0.9)' }]} />
      <Icon name={icon} size={Math.round(size * 0.44)} color={fg} />
    </View>
  );
});

/**
 * An empty, loading-failed or error state of IRLY Girl, in one shape: a card
 * of glass that rises in, an icon well (bordeaux for errors), a serif title,
 * a line of explanation and its actions. Errors announce themselves to
 * screen readers.
 */
export function GNotice({ icon, title, body, tone = 'empty', children, style }: { icon: IconName; title?: string; body?: string; tone?: 'empty' | 'error'; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const m = useGirlMotion();
  return (
    <Animated.View entering={m.rise(0)} style={[styles.notice, style]} accessibilityLiveRegion={tone === 'error' ? 'polite' : undefined}>
      <GlassFill radius={radius.xl} />
      <GIconWell icon={icon} tone={tone === 'error' ? 'error' : 'pearl'} />
      {title ? (
        <Text variant="titleM" color={girl.ink} align="center" style={girlType.card}>
          {title}
        </Text>
      ) : null}
      {body ? (
        <Text variant="bodyS" color={girl.inkSoft} align="center">
          {body}
        </Text>
      ) : null}
      {children}
    </Animated.View>
  );
}

export function Wrap({ children }: { children: ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

/** "92% match" pill: pearl on plum (on a photo: plum on pearl). */
export function ScorePill({ score, onDark }: { score: number; onDark?: boolean }) {
  return (
    <View style={[styles.score, { backgroundColor: onDark ? 'rgba(255,248,251,0.94)' : girl.plum }]}>
      <Icon name="sparkles" size={13} color={onDark ? girl.rose : '#F4B3CF'} />
      <Text variant="label" color={onDark ? girl.plum : girl.pearl}>
        {score}% match
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: 'flex-start' },
  input: { flex: 1, minWidth: 0, width: '100%', minHeight: 50, color: girl.ink, fontFamily: font.medium, fontSize: 16, paddingVertical: 0, outlineWidth: 0 },
  multi: { minHeight: 92, textAlignVertical: 'top' },
  well: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 0 },
  wellRim: { borderWidth: 1 },
  notice: { alignItems: 'center', gap: 10, padding: 22, borderRadius: radius.xl, zIndex: 0, boxShadow: girl.shadowSoft },
});
