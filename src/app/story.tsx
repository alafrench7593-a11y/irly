import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { DotField } from '@/brand/DotField';
import { IrlyStory, STORY_VERSION } from '@/features/onboarding/IrlyStory';
import { useStore } from '@/state/store';

/** « What is IRLY? » from Profile: the onboarding story, replayed. */
export default function Story() {
  const router = useRouter();
  // ?scene=2&hold=1 opens one scene and stays (the website's screenshots).
  const { scene, hold } = useLocalSearchParams<{ scene?: string; hold?: string }>();
  const markStorySeen = useStore((st) => st.markStorySeen);
  useEffect(() => {
    if (hold !== '1') markStorySeen(STORY_VERSION);
  }, [hold, markStorySeen]);
  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { opacity: 0.4 }]} pointerEvents="none">
        <DotField />
      </View>
      <IrlyStory scene={scene ? Number(scene) - 1 : 0} hold={hold === '1'} onDone={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050506', overflow: 'hidden' },
});
