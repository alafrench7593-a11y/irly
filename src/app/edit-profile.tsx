import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { CharCount } from '@/components/ui/CharCount';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { INTERESTS } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { LANGUAGES } from '@/data/languages';
import type { CityId, Interest } from '@/data/types';
import { updateMyProfile, useAccount } from '@/features/auth/account';
import { AppearanceChoice } from '@/features/avatar/AvatarBuilder';
import { useT } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { useCityId, useStore } from '@/state/store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Edit profile: appearance (photo or IRLY avatar), first name, age, bio, where you live, languages and
 * interests. Saved on the server (what others see) and on this phone.
 * Gender is set at signup (IRLY Girl access) and changes through support.
 */
export default function EditProfile() {
  const tr = useT();
  const router = useRouter();
  const account = useAccount();
  const profile = useStore((s) => s.profile);
  const currentCity = useCityId();
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [country, setCountry] = useState(profile.country ?? '');
  const [languages, setLanguages] = useState<string[]>(profile.languages ?? []);
  const [interests, setInterests] = useState<Interest[]>(profile.interests);
  const [cityId, setCityId] = useState<CityId>(currentCity);
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const errors = {
    name: name.trim() ? null : tr('Add your first name'),
    languages: languages.length ? null : tr('Pick at least one language'),
  };
  const valid = !errors.name && !errors.languages;

  const save = async () => {
    setTried(true);
    if (!valid || busy) {
      haptic('warning');
      return;
    }
    setBusy(true);
    try {
      await updateMyProfile({
        name: name.trim(),
        bio: bio.trim(),
        country: country.trim(),
        languages,
        interests,
        ...(cityId !== currentCity ? { cityId } : {}),
        ...(photo ? { photoUri: photo } : {}),
      });
      haptic('success');
      toast(tr('Profile saved'), 'check', 'positive');
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Could not save. Check your connection and try again.'), 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Page overline="Profile" title="Edit profile" subtitle={account ? tr('What other members see.') : tr('Saved on this phone. Sign in to share it with other members.')}>
      <View style={styles.form}>
        <Section title="Appearance">
          <AppearanceChoice
            value={photo ?? profile.photoUri}
            onChange={setPhoto}
            gender={profile.gender}
            photoWidth={768}
            photoHint="A real photo of you, face visible."
          />
        </Section>

        <Section title="First name" error={tried ? errors.name : null}>
          <Field value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" accessibilityLabel={tr('First name')} />
        </Section>

        <Section title="Age">
          <Text variant="body" raw>
            {profile.age ? String(profile.age) : '—'}
          </Text>
          <Text variant="caption" tone="tertiary">
            Your age is set at signup (IRLY is for adults only). To correct it, contact support.
          </Text>
        </Section>

        <Section title="Bio">
          <Field value={bio} onChangeText={setBio} maxLength={300} multiline placeholder="What you do, what you are up for" accessibilityLabel={tr('Bio')} />
          <CharCount length={bio.length} max={300} />
        </Section>

        <Section title="Country of origin">
          <Field value={country} onChangeText={setCountry} maxLength={56} accessibilityLabel={tr('Country of origin')} />
        </Section>

        <Section title="City">
          <View style={styles.wrap}>
            {(Object.keys(CITIES) as CityId[]).map((id) => (
              <Chip key={id} size="sm" label={CITIES[id].name} selected={cityId === id} onPress={() => setCityId(id)} />
            ))}
          </View>
        </Section>

        <Section title="Languages" error={tried ? errors.languages : null}>
          <View style={styles.wrap}>
            {LANGUAGES.map((l) => (
              <Chip key={l} size="sm" label={l} selected={languages.includes(l)} onPress={() => setLanguages((x) => toggle(x, l))} />
            ))}
          </View>
        </Section>

        <Section title="Interests">
          <View style={styles.wrap}>
            {(Object.keys(INTERESTS) as Interest[]).map((i) => (
              <Chip key={i} size="sm" icon={INTERESTS[i].icon} label={INTERESTS[i].label} selected={interests.includes(i)} onPress={() => setInterests((x) => toggle(x, i))} />
            ))}
          </View>
        </Section>

        <Button label="Save" icon="check" full loading={busy} onPress={save} />
        <Text variant="caption" tone="tertiary" align="center">
          Gender and age are set at signup. To change them, write to us from Profile → Help &amp; contact.
        </Text>
      </View>
    </Page>
  );
}

function Section({ title, error, children }: { title: string; error?: string | null; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Text variant="overline" tone="tertiary">
        {title}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" color={t.c.live}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: space.gutter, gap: space[6] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
