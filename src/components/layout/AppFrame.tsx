import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { IrlyMark } from '@/brand/IrlyMark';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { useStore } from '@/state/store';
import { font } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Frame = { width: number; height: number; framed: boolean };

const FrameContext = createContext<Frame>({ width: 390, height: 844, framed: false });

/** Size of the app surface. Use instead of the window size. */
export function useFrame(): Frame {
  return useContext(FrameContext);
}

const PHONE_WIDTH = 430;
const TABLET_BREAKPOINT = 700;

/**
 * Responsive shell.
 * - Phones (and narrow browser windows): the app fills the screen.
 * - Tablets and desktop web: the app keeps its phone proportions in a
 *   centred column, the destination's light fills the rest of the screen.
 *   IRLY is designed mobile-first; wider layouts reuse the same screens.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const t = useTheme();
  const cityId = useStore((s) => s.cityId);
  const city = cityId ? CITIES[cityId] : null;
  const framed = width >= TABLET_BREAKPOINT;
  const frame = useMemo<Frame>(
    () => ({ width: framed ? PHONE_WIDTH : width, height, framed }),
    [framed, width, height],
  );

  if (!framed) {
    return (
      <FrameContext.Provider value={frame}>
        <View style={[styles.fill, { backgroundColor: t.c.bg }]}>{children}</View>
      </FrameContext.Provider>
    );
  }

  return (
    <FrameContext.Provider value={frame}>
      <View style={[styles.fill, styles.row]}>
        <Photo visual={{ photo: city?.photo ?? 'emirates' }} light={city?.light ?? 'dubai'} blur={28} width={1600} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(246,246,244,0.7)' }]} />
        {width > 1100 ? (
          <View style={styles.aside} pointerEvents="none">
            <IrlyMark size={64} state="idle" lensColor={t.c.brand} />
            <Text style={styles.asideTitle}>Find someone{'\n'}to do something with.</Text>
            <Text style={styles.asideBody}>Connect. Relocate. Belong.</Text>
            <Text style={styles.asideNote}>
              {Platform.OS === 'web' ? 'Web preview · built with Expo, runs on iOS and Android' : ''}
            </Text>
          </View>
        ) : null}
        <View style={[styles.phone, { width: PHONE_WIDTH, backgroundColor: t.c.bg, boxShadow: '0px 30px 80px rgba(10,10,10,0.18)' }]}>
          {children}
        </View>
      </View>
    </FrameContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', overflow: 'hidden' },
  phone: { overflow: 'hidden', borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(10,10,10,0.08)' },
  aside: { position: 'absolute', left: 64, top: 0, bottom: 0, justifyContent: 'center', gap: 18, maxWidth: 360 },
  asideTitle: { fontFamily: font.serif, fontSize: 44, lineHeight: 48, color: '#0A0A0A' },
  asideBody: { fontFamily: font.bold, fontSize: 16, color: 'rgba(10,10,10,0.7)', letterSpacing: 0.4 },
  asideNote: { fontFamily: font.medium, fontSize: 13, color: 'rgba(10,10,10,0.45)' },
});
