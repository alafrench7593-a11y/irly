import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
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
import { MatchHost } from '@/features/match/IrlyMatch';
import { usePush } from '@/features/push/push';
import { useStore } from '@/state/store';
import { useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 250, fade: true });

// Web (phone browsers): an input is ~200 px wide by default and does not
// shrink in a flex row, so narrow fields overflowed under their neighbours
// and could not be tapped on iPhone. Inputs also keep 16 px text so iOS
// Safari does not zoom in on focus.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const css = document.createElement('style');
  css.textContent = 'input,textarea{min-width:0;max-width:100%;font-size:16px}';
  document.head.appendChild(css);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
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
          animation: 'default',
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
        <Stack.Screen name="share" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="a/[id]" options={{ animation: 'fade_from_bottom' }} />
        {/* The face flies from the bubble into the profile while the page fades in. */}
        <Stack.Screen name="person/[id]" options={{ animation: 'fade' }} />
        <Stack.Screen name="story" options={{ animation: 'fade', contentStyle: { backgroundColor: '#050506' } }} />
        <Stack.Screen name="girl/profile" options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: girl.bg } }} />
      </Stack>
      <HeroHost />
      <FlightHost />
      <MatchHost />
      <CreateHost />
      <DestinationTransition />
      <AppIntro />
      <ToastHost />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
