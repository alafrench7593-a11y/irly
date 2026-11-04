import type { ErrorBoundaryProps } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/navigation/TabBar';
import { useTheme } from '@/theme/useTheme';
import { RAIL_SPACE, ScreenColumn, useLayout, WIDE_TABS } from '@/components/layout/responsive';
import { ErrorScreen } from '@/components/layout/ErrorScreen';

/** A crash here shows Try again and a way home, not a blank screen (components/layout/ErrorScreen). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} retry={retry} where="tabs" />;
}

/**
 * The same tabs in IRLY and in IRLY Girl: the bar and every tab wear
 * the look of the app space (the root layout sets the flavor).
 */
export default function TabsLayout() {
  const t = useTheme();
  // Expanded (wide window): the bar becomes a rail on the left, pages start after it.
  const { rail } = useLayout();
  const inset = rail ? RAIL_SPACE : 0;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenLayout={({ children, route }) => (
        <ScreenColumn wide={WIDE_TABS.has(route.name)} inset={inset}>
          {children}
        </ScreenColumn>
      )}
      screenOptions={{
        headerShown: false,
        // Tabs slide a little and cross-fade (`shift`): you feel the direction.
        animation: 'shift',
        sceneStyle: { backgroundColor: t.c.bg, paddingLeft: inset },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="live" options={{ title: 'IRL' }} />
      {/* Map: opened from the top left of every tab root, not from the bar. */}
      <Tabs.Screen name="map" options={{ title: 'Map', href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Messages: opened from the header of every tab root, not a tab. */}
      <Tabs.Screen name="messages" options={{ title: 'Messages', href: null }} />
      {/* Real-life plans: reached from Home and Discover, no longer a tab. */}
      <Tabs.Screen name="social" options={{ title: 'Plans', href: null }} />
    </Tabs>
  );
}
