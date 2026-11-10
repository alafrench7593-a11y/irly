import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { t as tx } from '@/i18n';
import { BACKGROUND, PORTRAIT } from './art';
import { DX, serif, useDubaiFonts } from './theme';

/** The Dubaï mode's door in the games hub: its scene, and the way to its 20 cards. */
export const DubaiTile = memo(function DubaiTile() {
  const router = useRouter();
  const fonts = useDubaiFonts();
  return (
    <Pressable onPress={() => router.push('/games/dubai')} accessibilityRole="button" accessibilityLabel={tx('Open the Dubai mode')} style={styles.tile}>
      <Image source={BACKGROUND.home} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(11,9,7,0.05)', 'rgba(11,9,7,0.6)', 'rgba(11,9,7,0.95)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.faces}>
        {(['influencer', 'escroc', 'emirati', 'golden_visa'] as const).map((id) => (
          <View key={id} style={styles.face}>
            <Image source={PORTRAIT[id]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
          </View>
        ))}
      </View>
      <View style={styles.bottom}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, serif(fonts, '900')]}>{tx('Dubai mode').toUpperCase()}</Text>
          <Text style={styles.sub}>{tx('Expats vs Escrocs · 20 characters')}</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{tx('Enter')}</Text>
          <Icon name="chevronRight" size={16} color={DX.goldLight} />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: { height: 190, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: DX.gold, justifyContent: 'flex-end' },
  faces: { position: 'absolute', top: 14, right: 14, flexDirection: 'row' },
  face: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: DX.gold, marginLeft: -10 },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', padding: 16, gap: 10 },
  title: { color: DX.goldLight, fontSize: 22, letterSpacing: 1 },
  sub: { color: DX.ivory, fontSize: 13, marginTop: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: DX.gold, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(142,27,34,0.85)' },
  ctaText: { color: DX.goldLight, fontWeight: '700', fontSize: 13 },
});
