import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
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
  // Each field: what you typed, else the server's value, else this phone's copy (never blanked by a slow load).
  const [server, setServer] = useState<{ first_name: string | null; bio: string | null; country: string | null; username: string | null } | null>(null);
  const [nameEdit, setName] = useState<string>();
  const [bioEdit, setBio] = useState<string>();
  const [countryEdit, setCountry] = useState<string>();
  const [usernameEdit, setUsername] = useState<string>();
  const name = nameEdit ?? server?.first_name ?? profile.name;
  const bio = bioEdit ?? (server ? (server.bio ?? '') : (profile.bio ?? ''));
  const country = countryEdit ?? server?.country ?? profile.country ?? '';
  const savedUsername = server?.username ?? null;
  const username = usernameEdit ?? savedUsername ?? '';
  const [languages, setLanguages] = useState<string[]>(profile.languages ?? []);
  const [interests, setInterests] = useState<Interest[]>(profile.interests);
  const [cityId, setCityId] = useState<CityId>(currentCity);
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [check, setCheck] = useState<{ for: string; free: boolean } | null>(null);

  // The server's current values (name, bio, country, @username).
  useEffect(() => {
    if (!supabase || !account) return;
    let alive = true;
    supabase.rpc('my_profile').then(({ data }) => {
      const r = ((data as { first_name: string | null; bio: string | null; country: string | null; username: string | null }[] | null) ?? [])[0];
      if (alive && r) setServer(r);
    });
    return () => {
      alive = false;
    };
  }, [account]);

  // Availability, checked on the server as you type (after a short pause).
  const wanted = username.trim().toLowerCase();
  const wellFormed = /^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/.test(wanted);
  const changedHandle = Boolean(account) && wanted !== (savedUsername ?? '');
  useEffect(() => {
    if (!changedHandle || !wellFormed || !supabase) return;
    let alive = true;
    const h = setTimeout(() => {
      supabase?.rpc('username_available', { p_username: wanted }).then(({ data, error }) => alive && !error && setCheck({ for: wanted, free: Boolean(data) }));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [wanted, wellFormed, changedHandle]);
  const handle: 'idle' | 'checking' | 'free' | 'taken' | 'invalid' = !changedHandle || !wanted ? 'idle' : !wellFormed ? 'invalid' : check?.for === wanted ? (check.free ? 'free' : 'taken') : 'checking';

  const errors = {
    name: name.trim() ? null : tr('Add your first name'),
    languages: languages.length ? null : tr('Pick at least one language'),
    username: handle === 'taken' ? tr('This username is taken') : handle === 'invalid' ? tr('Usernames: 3 to 24 characters, letters, numbers, dots and underscores') : null,
  };
  const valid = !errors.name && !errors.languages && !errors.username && handle !== 'checking';

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
        ...(changedHandle ? { username: wanted } : {}),
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

        {account ? (
          <Section title="Username" error={errors.username}>
            <Field
              value={username}
              onChangeText={(v: string) => setUsername(v.replace(/\s/g, '').toLowerCase())}
              maxLength={24}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="yourname"
              icon="user"
              accessibilityLabel={tr('Username')}
            />
            <Text variant="caption" tone={handle === 'free' ? 'positive' : 'tertiary'}>
              {handle === 'checking'
                ? tr('Checking…')
                : handle === 'free'
                  ? tr('@{name} is available', { name: username.trim().toLowerCase() })
                  : username
                    ? `@${username.trim().toLowerCase()}`
                    : tr('Optional. Others can find and mention you with it.')}
            </Text>
          </Section>
        ) : null}

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
          Gender and age are set at signup. To change them, write to us from Settings → Help &amp; contact.
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
