import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppFrame } from '@/components/layout/AppFrame';
import { ToastHost } from '@/components/ui/Toast';
import { CreateHost } from '@/features/create/CreateHost';
import { girl } from '@/features/girl/theme';
import { DestinationTransition } from '@/features/destination/DestinationTransition';
import { HeroHost } from '@/features/hero/HeroHost';
import { AppIntro } from '@/features/intro/AppIntro';
import { FlightHost } from '@/features/flight/FlightHost';
import { PhotoViewerHost } from '@/features/photo/PhotoViewerHost';
import { DemoBadge } from '@/features/demo/DemoBadge';
import { MatchHost } from '@/features/match/IrlyMatch';
import { usePush } from '@/features/push/push';
import { ReportHost } from '@/features/moderation/ReportSheet';
import { UnreadSync } from '@/features/server/chat';
import { BellSync } from '@/features/server/social';
import { FaceSync } from '@/features/server/faces';
import { SyncBridge } from '@/features/server/sync';
import { OfflineBar } from '@/features/server/OfflineBar';
import { useStore } from '@/state/store';
import { useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 250, fade: true });

// Web (phone browsers): an input is ~200 px wide by default and does not
// shrink in a flex row, so narrow fields overflowed under their neighbours
// and could not be tapped on iPhone. Inputs also keep 16 px text so iOS
// Safari does not zoom in on focus. Inputs are positioned so they paint
// above the glass pane laid behind them (an absolutely positioned layer
// would otherwise cover, and blur, the typed text).
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const css = document.createElement('style');
  css.textContent = 'input,textarea{min-width:0;max-width:100%;font-size:16px;position:relative}';
  document.head.appendChild(css);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    // IRLY Girl's editorial titles (bundled, SIL OFL).
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  const hydrated = useStore((s) => s.hydrated);
  const ready = (fontsLoaded || Boolean(fontError)) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ReducedMotionConfig mode={ReduceMotion.System} />
        {ready ? <App /> : <View style={[styles.root, { backgroundColor: '#000000' }]} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App() {
  const t = useTheme();
  usePush();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.c.bg).catch(() => undefined);
  }, [t.c.bg]);

  return (
    <AppFrame>
      <StatusBar style={t.isDay ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.c.bg },
          // One push transition on every platform (iOS feel on Android and web too),
          // and the back swipe follows the finger.
          animation: 'ios_from_right',
          animationMatchesGesture: true,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="match" options={{ animation: 'slide_from_bottom' }} />
        {/* IRLY Girl: its own universe; the screen fades and GirlIntro morphs. */}
        <Stack.Screen name="girl/index" options={{ animation: 'fade', contentStyle: { backgroundColor: girl.bg } }} />
        <Stack.Screen name="girl/onboarding" options={{ animation: 'slide_from_bottom', contentStyle: { backgroundColor: girl.bg } }} />
        <Stack.Screen name="girl/moving" options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: girl.bg } }} />
        <Stack.Screen name="comments" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="post/new" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="share" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="a/[id]" options={{ animation: 'fade_from_bottom' }} />
        {/* The face flies from the bubble into the profile while the page fades in. */}
        <Stack.Screen name="person/[id]" options={{ animation: 'fade' }} />
        <Stack.Screen name="story" options={{ animation: 'fade', contentStyle: { backgroundColor: '#050506' } }} />
        <Stack.Screen name="girl/new-community" options={{ animation: 'slide_from_bottom', contentStyle: { backgroundColor: girl.bg } }} />
        <Stack.Screen name="c/[id]" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
        <Stack.Screen name="girl/profile" options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: girl.bg } }} />
      </Stack>
      <HeroHost />
      <FlightHost />
      <PhotoViewerHost />
      <MatchHost />
      <ReportHost />
      <SyncBridge />
      <UnreadSync />
      <BellSync />
      <FaceSync />
      <CreateHost />
      <DestinationTransition />
      <AppIntro />
      <ToastHost />
      <OfflineBar />
      <DemoBadge />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
