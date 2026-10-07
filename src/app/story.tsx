import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { DotField } from '@/brand/DotField';
import { IrlyStory } from '@/features/onboarding/IrlyStory';

/** « What is IRLY? » from Profile: the onboarding story, replayed. */
export default function Story() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { opacity: 0.4 }]} pointerEvents="none">
        <DotField />
      </View>
      <IrlyStory onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050506' },
});
