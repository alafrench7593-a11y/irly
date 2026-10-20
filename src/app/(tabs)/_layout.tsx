import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { TabBar } from '@/components/navigation/TabBar';
import { Flavor } from '@/theme/flavor';
import { useSpace } from '@/theme/space';
import { useTheme } from '@/theme/useTheme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={(props) => <SpaceTabBar {...props} />}
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
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Messages: opened from the header of every tab root, not a tab. */}
      <Tabs.Screen name="messages" options={{ title: 'Messages', href: null }} />
      {/* Real-life plans: reached from Home and Discover, no longer a tab. */}
      <Tabs.Screen name="social" options={{ title: 'Plans', href: null }} />
    </Tabs>
  );
}

/**
 * Over the Messages list opened from IRLY Girl, the bar wears the Girl look
 * like the list itself; on every other tab (and from Home) it stays Mixte.
 * Cosmetic only (see theme/space).
 */
function SpaceTabBar(props: BottomTabBarProps) {
  const space = useSpace();
  const onMessages = props.state.routes[props.state.index]?.name === 'messages';
  return (
    <Flavor value={onMessages ? space : 'mixte'}>
      <TabBar {...props} />
    </Flavor>
  );
}
