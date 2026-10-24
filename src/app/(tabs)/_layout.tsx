import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/navigation/TabBar';
import { useTheme } from '@/theme/useTheme';

/**
 * The same tabs in IRLY and in IRLY Girl: the bar and every tab wear
 * the look of the app space (the root layout sets the flavor).
 */
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Tabs slide a little and cross-fade (`shift`): you feel the direction.
        animation: 'shift',
        sceneStyle: { backgroundColor: t.c.bg },
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
