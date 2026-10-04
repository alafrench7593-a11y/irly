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
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppFrame } from '@/components/layout/AppFrame';
import { ToastHost } from '@/components/ui/Toast';
import { CreateHost } from '@/features/create/CreateHost';
import { DestinationTransition } from '@/features/destination/DestinationTransition';
import { HeroHost } from '@/features/hero/HeroHost';
import { useStore } from '@/state/store';
import { useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 250, fade: true });

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
      </Stack>
      <HeroHost />
      <CreateHost />
      <DestinationTransition />
      <ToastHost />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
