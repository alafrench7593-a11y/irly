import { CharCount } from '@/components/ui/CharCount';
import { t as tx, a11y } from '@/i18n';
import { useRouter } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { LANGUAGES } from '@/data/languages';
import { AppearanceChoice } from '@/features/avatar/AvatarBuilder';
import { StepShell } from '@/features/onboarding/StepShell';
import { enter } from '@/motion/enter';
import { useCityId, useStore, type Gender } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';


const GENDERS: { id: Gender; label: string }[] = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'other', label: 'Other' },
];

/**
 * Your profile. A face (a real photo or an IRLY avatar), a short bio and
 * the basics are required: people say yes to meeting a face and a
 * sentence, not an empty card.
 */
export default function ProfileStep() {
  const t = useTheme();
  const router = useRouter();
  const city = CITIES[useCityId()];
  const profile = useStore((s) => s.profile);
  const update = useStore((s) => s.updateProfile);
  const languages = profile.languages ?? [];
  const bio = profile.bio ?? '';

  const ok =
    Boolean(profile.photoUri) &&
    (profile.age ?? 0) >= 18 &&
    bio.trim().length >= 10 &&
    Boolean(profile.country?.trim()) &&
    languages.length > 0 &&
    Boolean(profile.gender);

  return (
    <StepShell
      step={2}
      total={4}
      overline={`IRLY ${city.name}`}
      title="Your profile"
      subtitle="A photo or your avatar, and a few words. That is what makes people say yes to meeting."
      cta="Continue"
      canContinue={ok}
      onContinue={() => router.push('/onboarding/looking')}
    >
      <Animated.View entering={enter.rise(1, 80)} style={styles.photoRow}>
        <AppearanceChoice value={profile.photoUri} onChange={(photoUri) => update({ photoUri })} gender={profile.gender} />
      </Animated.View>

      <Animated.View entering={enter.rise(2, 80)} style={styles.block}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field
            containerStyle={{ width: 110 }}
            icon="calendar"
            placeholder={tx('Age')}
            keyboardType="number-pad"
            maxLength={2}
            value={profile.age ? String(profile.age) : ''}
            onChangeText={(v) => update({ age: Number(v.replace(/[^0-9]/g, '')) || undefined })}
            accessibilityLabel="Age"
          />
          <Field
            containerStyle={{ flex: 1 }}
            icon="globe"
            placeholder={tx('Country (e.g. France)')}
            value={profile.country ?? ''}
            onChangeText={(country) => update({ country })}
            autoCapitalize="words"
            accessibilityLabel="Country"
          />
        </View>
        {profile.age !== undefined && profile.age < 18 ? (
          <Text variant="caption" tone="critical">
            IRLY is for people 18 and over.
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={enter.rise(3, 80)} style={styles.block}>
        <Text variant="overline" tone="secondary">
          Bio · required
        </Text>
        <TextInput
          value={bio}
          onChangeText={(b) => update({ bio: b })}
          placeholder={tx('French in {city}\nEntrepreneur · Padel · Travel\nAlways down for coffee.', { city: city.name })}
          placeholderTextColor={t.c.textTertiary}
          multiline
          maxLength={160}
          style={[styles.bio, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
          accessibilityLabel={a11y('Short bio')}
        />
        <CharCount length={bio.trim().length} min={10} max={160} />
      </Animated.View>

      <Animated.View entering={enter.rise(4, 80)} style={styles.block}>
        <Text variant="overline" tone="secondary">
          Languages
        </Text>
        <View style={styles.wrap}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l}
              size="sm"
              label={l}
              selected={languages.includes(l)}
              onPress={() => update({ languages: languages.includes(l) ? languages.filter((x) => x !== l) : [...languages, l] })}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={enter.rise(5, 80)} style={[styles.block, { marginBottom: space[8] }]}>
        <Text variant="overline" tone="secondary">
          I am
        </Text>
        <View style={styles.wrap}>
          {GENDERS.map((g) => (
            <Chip key={g.id} size="sm" label={g.label} selected={profile.gender === g.id} onPress={() => update({ gender: g.id })} />
          ))}
        </View>
        <Text variant="caption" tone="tertiary">
          Women get access to IRLY Girl, a space reserved for women.
        </Text>
      </Animated.View>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  photoRow: { paddingHorizontal: space.gutter, marginBottom: space[6] },
  block: { paddingHorizontal: space.gutter, gap: 10, marginBottom: space[6] },
  bio: { minHeight: 104, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, fontFamily: font.medium, fontSize: 16, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
