import { useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { IrlyMark } from '@/brand/IrlyMark';
import { Text } from '@/components/ui/Text';
import { font } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { FrameContext, type Frame } from '@/components/layout/frame';
import { LayoutContext, sizeClassFor, type Layout } from '@/components/layout/responsive';
import { AmbientBackdrop } from '@/components/layout/AmbientBackdrop';

export { FrameContext, useFrame, type Frame } from '@/components/layout/frame';

const PHONE_WIDTH = 430;
/** Desktop web keeps the phone preview from this width (marketing preview). */
const WEB_FRAME_MIN = 1200;

/** Web only: `?frame=0` turns the phone preview off, to see the adaptive layouts at any width. */
const webFrameOff = Platform.OS === 'web' && typeof window !== 'undefined' && /[?&]frame=0\b/.test(window.location?.search ?? '');

/**
 * Responsive shell.
 * - On iOS and Android the app always fills its window, whatever its size:
 *   a small iPhone, a Pro Max, the outer or inner screen of a folding
 *   phone. The size class (components/layout/responsive) then picks the
 *   layout: phone layout under 700 pt, side rail and two panes above.
 * - On the web, tablets and narrow windows get the same adaptive app.
 *   Desktop browsers (1200 px and more) keep the phone preview in a centred
 *   column with the destination's light around it, unless `?frame=0`.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const t = useTheme();
  const framed = Platform.OS === 'web' && width >= WEB_FRAME_MIN && !webFrameOff;
  const night = t.mode === 'night';
  const ink = night ? '#FFFFFF' : '#0A0A0A';
  const frame = useMemo<Frame>(
    () => ({ width: framed ? PHONE_WIDTH : width, height, framed }),
    [framed, width, height],
  );

  const surfaceW = framed ? PHONE_WIDTH : width;
  const layoutValue = useMemo<Layout>(() => {
    const sizeClass = sizeClassFor(surfaceW);
    return { windowWidth: surfaceW, windowHeight: height, sizeClass, landscape: width > height, rail: sizeClass === 'expanded' };
  }, [surfaceW, height, width]);

  if (!framed) {
    return (
      <LayoutContext.Provider value={layoutValue}>
        <FrameContext.Provider value={frame}>
          <View style={[styles.fill, { backgroundColor: t.c.bg }]}>{children}</View>
        </FrameContext.Provider>
      </LayoutContext.Provider>
    );
  }

  return (
    <LayoutContext.Provider value={layoutValue}>
    <FrameContext.Provider value={frame}>
      <View style={[styles.fill, styles.row]}>
        <AmbientBackdrop />
        {width > 1100 ? (
          <View style={styles.aside} pointerEvents="none">
            <IrlyMark size={64} state="idle" lensColor={t.c.brand} />
            <Text style={[styles.asideTitle, { color: ink }]}>Find someone{'\n'}to do something with.</Text>
            <Text style={[styles.asideBody, { color: night ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,10,0.7)' }]}>Connect. Relocate. Belong.</Text>
            <Text style={[styles.asideNote, { color: night ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,10,0.45)' }]}>
              {Platform.OS === 'web' ? 'Web preview · built with Expo, runs on iOS and Android' : ''}
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.phone,
            {
              width: PHONE_WIDTH,
              backgroundColor: t.c.bg,
              borderColor: night ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,10,0.08)',
              boxShadow: night ? '0px 30px 90px rgba(0,0,0,0.7)' : '0px 30px 80px rgba(10,10,10,0.18)',
            },
          ]}
        >
          {children}
        </View>
      </View>
    </FrameContext.Provider>
    </LayoutContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', overflow: 'hidden' },
  phone: { overflow: 'hidden', borderLeftWidth: 1, borderRightWidth: 1 },
  aside: { position: 'absolute', left: 64, top: 0, bottom: 0, justifyContent: 'center', gap: 18, maxWidth: 360 },
  asideTitle: { fontFamily: font.serif, fontSize: 44, lineHeight: 48 },
  asideBody: { fontFamily: font.bold, fontSize: 16, letterSpacing: 0.4 },
  asideNote: { fontFamily: font.medium, fontSize: 13 },
});
