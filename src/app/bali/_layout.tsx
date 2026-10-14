import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { DESTINATIONS, destinationOpen } from '@/data/destinations';
import { SoonPill } from '@/features/soon/SoonPill';
import { supabase } from '@/lib/supabase';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { useStore } from '@/state/store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Bali is coming soon: every Bali page (guides, quiz, areas, links from
 * elsewhere) shows this instead, with the one real action: be told when it opens.
 */
export default function BaliLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const asked = useStore((s) => !!s.waitlist.bali);
  const joinWaitlist = useStore((s) => s.joinWaitlist);
  const t = useTheme();
  if (destinationOpen('bali')) return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg } }} />;
  const bali = DESTINATIONS.bali;

  const notify = async () => {
    if (asked) return;
    if (supabase) {
      const { error } = await supabase.rpc('set_service_interest', { p_service: 'dest_bali', p_on: true });
      if (error) {
        // Only a missing sign-in asks to sign in; anything else is said as it is.
        if (/sign in required|jwt/i.test(error.message)) toast('Sign in to be told when it opens', 'user', 'brand');
        else toast(error.message, 'x', 'live');
        return;
      }
    }
    joinWaitlist('bali');
    haptic('success');
    toast("We'll tell you when IRLY Bali opens", 'bell', 'brand');
  };

  return (
    <Photo visual={{ photo: bali.photo }} light={bali.light} scrim="full" style={[styles.root, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 }]} width={1200} drift>
      <Animated.View entering={enter.fade(0)}>
        <SoonPill />
      </Animated.View>
      <Animated.View entering={enter.rise(1)} style={{ gap: space[3] }}>
        <Text variant="displayL" color="#FFFFFF">
          IRLY Bali is coming soon
        </Text>
        <Text variant="body" color="rgba(255,255,255,0.8)">
          We are preparing Bali. IRLY is open in the Emirates today.
        </Text>
      </Animated.View>
      <View style={{ flex: 1 }} />
      <Animated.View entering={enter.rise(2)} style={{ gap: space[3] }}>
        <Button label={asked ? 'You will be told' : 'Tell me when it opens'} icon="bell" full onPress={notify} disabled={asked} />
        <Button label="Back" variant="secondary" full onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Animated.View>
    </Photo>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space[5], gap: space[5] },
});
