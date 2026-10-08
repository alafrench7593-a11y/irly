import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/state/store';
import { AppleLogo, GoogleG } from '@/brand/ProviderLogos';
import { t as tx, a11y } from '@/i18n';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import {
  authMessage,
  completeFromUrl,
  sendCode,
  sendPasswordReset,
  sendPhoneCode,
  signInWithPassword,
  signInWithProvider,
  signOut,
  signUpWithPassword,
  updatePassword,
  useAccount,
  verifyCode,
  verifyPhoneCode,
} from '@/features/auth/account';
import { APP } from '@/config/app';
import { track } from '@/lib/analytics';
import { enabledProviders, hasBackend } from '@/lib/supabase';
import { wipeLocal } from '@/state/wipe';
import { haptic } from '@/motion/haptics';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?\d[\d\s-]{7,16}$/;

type Mode = 'choose' | 'email' | 'link' | 'code' | 'forgot' | 'phone' | 'phoneCode' | 'reset';

/**
 * Your IRLY account: Apple, Google, email (password or a sign-in link) or
 * phone. Sessions persist and refresh on their own; signing in publishes the
 * signup profile so matches, chats and plans are real and shared.
 */

const handledUrls = new Set<string>();
export default function AccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const onboarded = useStore((s) => s.onboarded);
  const cityId = useStore((s) => s.cityId);
  const params = useLocalSearchParams<{ reset?: string; from?: string }>();
  const fromOnboarding = params.from === 'onboarding';
  const [mode, setMode] = useState<Mode>(params.reset ? 'reset' : 'choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = Linking.useURL();
  // Only offer Apple / Google when they are switched on in Supabase.
  const [providers, setProviders] = useState<{ apple: boolean; google: boolean; phone: boolean } | null>(null);
  useEffect(() => {
    enabledProviders().then(setProviders);
  }, []);

  // Coming back from an email link or Apple/Google in the app.
  useEffect(() => {
    // Linking.useURL() returns the launch link on every visit: handle each link once
    // (replaying it signed people back in after Sign out, or reused a spent token).
    if (!url || handledUrls.has(url)) return;
    handledUrls.add(url);
    // An expired or already-used link comes back as #error=…&error_description=…
    const failed = url?.match(/[#?&]error_description=([^&]+)/);
    if (failed) {
      toast(decodeURIComponent(failed[1].replace(/\+/g, ' ')), 'x', 'live');
      return;
    }
    if (url && url.includes('access_token')) {
      completeFromUrl(url)
        .then((ok) => {
          if (!ok) return;
          if (url.includes('type=recovery') || url.includes('reset=1')) setMode('reset');
          else toast("You're signed in", 'check', 'positive');
        })
        .catch((e) => toast(authMessage(e), 'x', 'live'));
    }
  }, [url]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(authMessage(e), 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const done = (how: string) => {
    haptic('success');
    track(creating ? 'SIGNUP' : 'LOGIN', { method: how });
    toast("You're signed in", 'check', 'positive');
    if (fromOnboarding) router.replace('/(tabs)');
    else if (router.canGoBack()) router.back();
  };

  const input = [styles.input, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }];
  const validEmail = EMAIL.test(email.trim());

  if (!hasBackend) {
    return (
      <Page title="Account" subtitle="Accounts aren't available in this version of IRLY.">
        <View />
      </Page>
    );
  }

  if (account && mode === 'reset') {
    return (
      <Page overline="IRLY account" title="New password" subtitle="Choose a new password for your account.">
        <View style={styles.body}>
          <TextInput value={password} onChangeText={setPassword} placeholder={tx('New password (8+ characters)')} placeholderTextColor={t.c.textTertiary} secureTextEntry autoComplete="new-password" textContentType="newPassword" style={input} accessibilityLabel={a11y('New password')} />
          <Button
            label="Save password"
            icon="check"
            full
            loading={busy}
            disabled={password.length < 8}
            onPress={() =>
              act(async () => {
                await updatePassword(password);
                toast('Password updated', 'check', 'positive');
                setMode('choose');
                setPassword('');
              })
            }
          />
        </View>
      </Page>
    );
  }

  if (account) {
    return (
      <Page overline="Signed in" title="Your account" subtitle={account.email}>
        <View style={styles.body}>
          <View style={[styles.note, { backgroundColor: t.c.surface }]}>
            <Icon name="check" size={18} color={t.c.positive} />
            <Text variant="body" style={{ flex: 1 }}>
              Your profile, matches, chats and sessions are saved on the IRLY server.
            </Text>
          </View>
          {onboarded && cityId ? (
            <Button label="Continue to IRLY" icon="arrowRight" full onPress={() => router.replace('/(tabs)')} />
          ) : (
            <>
              <Text variant="body" tone="secondary">
                One more step: finish your profile so people can find you.
              </Text>
              <Button label="Finish my profile" icon="arrowRight" full onPress={() => router.replace('/welcome')} />
            </>
          )}
          <Button label="Change password" variant="secondary" icon="key" onPress={() => setMode('reset')} />
          <Button
            label="Sign out"
            variant="secondary"
            icon="arrowLeft"
            onPress={async () => {
              await signOut();
              // Same as Log out on the profile: the next account must not inherit this profile.
              wipeLocal();
              toast('Signed out', 'check', 'brand');
              router.replace('/welcome');
            }}
          />
        </View>
      </Page>
    );
  }

  const titles: Record<Mode, [string, string]> = {
    choose: ['Join IRLY', fromOnboarding ? 'Create your account to save your profile and meet people for real.' : 'Find someone to do something with.'],
    email: [creating ? 'Create your account' : 'Sign in with email', creating ? 'Email and a password. We send a link to confirm it’s you.' : 'Welcome back.'],
    link: ['Email me a link', 'No password: we email you a sign-in link.'],
    code: ['Check your email', tx('Sent to {email}. Open the link on this device, or enter the 6-digit code if the email shows one.', { email: email.trim() })],
    forgot: ['Forgot your password?', 'We email you a link to choose a new one.'],
    phone: ['Sign in with your phone', 'We text you a 6-digit code.'],
    phoneCode: ['Enter the code', tx('Sent to {phone}.', { phone: phone.trim() })],
    reset: ['New password', 'Open the reset link from your email on this device first.'],
  };

  return (
    <Page overline="IRLY account" title={titles[mode][0]} subtitle={titles[mode][1]}>
      <Animated.View key={mode} entering={FadeIn.duration(220)} style={styles.body}>
        {mode === 'choose' ? (
          <>
            {providers?.apple && Platform.OS !== 'android' ? <Button label="Continue with Apple" variant="inverse" leading={(c) => <AppleLogo size={18} color={c} />} full onPress={() => act(() => signInWithProvider('apple'))} /> : null}
            {/* App Store rule 4.8: on iPhone, Google sign-in is only offered next to Sign in with Apple. */}
            {providers?.google && (Platform.OS !== 'ios' || providers.apple) ? <Button label="Continue with Google" leading={() => <GoogleG size={18} />} full variant="secondary" loading={busy} onPress={() => act(() => signInWithProvider('google'))} /> : null}
            <Button label="Continue with email" icon="send" full variant="secondary" onPress={() => setMode('email')} />
            {providers?.phone ? <Button label="Continue with phone" icon="message" full variant="secondary" onPress={() => setMode('phone')} /> : null}
          </>
        ) : null}

        {mode === 'email' ? (
          <>
            <TextInput value={email} onChangeText={setEmail} placeholder={tx('you@email.com')} placeholderTextColor={t.c.textTertiary} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" style={input} accessibilityLabel={a11y('Email')} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={tx(creating ? 'Password (8+ characters)' : 'Password')}
              placeholderTextColor={t.c.textTertiary}
              secureTextEntry
              autoComplete={creating ? 'new-password' : 'current-password'}
              textContentType={creating ? 'newPassword' : 'password'}
              onSubmitEditing={() => undefined}
              style={input}
              accessibilityLabel={a11y('Password')}
            />
            <Button
              label={creating ? 'Create account' : 'Sign in'}
              icon="check"
              full
              loading={busy}
              disabled={!validEmail || password.length < (creating ? 8 : 1)}
              onPress={() =>
                act(async () => {
                  if (creating) {
                    const confirm = await signUpWithPassword(email, password);
                    if (confirm) {
                      track('SIGNUP', { method: 'password' });
                      toast('Check your inbox to confirm your email', 'send', 'brand');
                      setMode('code');
                      return;
                    }
                    done('password');
                  } else {
                    await signInWithPassword(email, password);
                    done('password');
                  }
                })
              }
            />
            <Button label={creating ? 'I already have an account' : 'Create an account'} variant="ghost" onPress={() => setCreating(!creating)} />
            {!creating ? <Button label="Forgot password?" variant="ghost" onPress={() => setMode('forgot')} /> : null}
            <Button label="Email me a sign-in link instead" variant="ghost" onPress={() => setMode('link')} />
          </>
        ) : null}

        {mode === 'link' || mode === 'forgot' ? (
          <>
            <TextInput value={email} onChangeText={setEmail} placeholder={tx('you@email.com')} placeholderTextColor={t.c.textTertiary} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" style={input} accessibilityLabel={a11y('Email')} />
            <Button
              label={mode === 'link' ? 'Email me a sign-in link' : 'Send reset link'}
              icon="send"
              full
              loading={busy}
              disabled={!validEmail}
              onPress={() =>
                act(async () => {
                  if (mode === 'link') {
                    await sendCode(email);
                    setMode('code');
                  } else {
                    await sendPasswordReset(email);
                    toast('Email sent. Open the link to choose a new password', 'send', 'brand');
                    setMode('email');
                  }
                  haptic('success');
                })
              }
            />
          </>
        ) : null}

        {mode === 'code' ? (
          <>
            <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder={tx('123456')} placeholderTextColor={t.c.textTertiary} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" style={[input, styles.code]} accessibilityLabel={a11y('6-digit code')} />
            <Button label="Sign in" icon="check" full loading={busy} disabled={code.length < 6} onPress={() => act(async () => (await verifyCode(email, code), done('email_code')))} />
            <Button label="Send a new email" variant="ghost" onPress={() => act(() => sendCode(email))} />
          </>
        ) : null}

        {mode === 'phone' ? (
          <>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+971 50 123 4567" placeholderTextColor={t.c.textTertiary} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" style={input} accessibilityLabel={a11y('Phone number')} />
            <Button
              label="Text me a code"
              icon="send"
              full
              loading={busy}
              disabled={!PHONE.test(phone.trim())}
              onPress={() =>
                act(async () => {
                  await sendPhoneCode(phone);
                  setMode('phoneCode');
                })
              }
            />
          </>
        ) : null}

        {mode === 'phoneCode' ? (
          <>
            <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder={tx('123456')} placeholderTextColor={t.c.textTertiary} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" style={[input, styles.code]} accessibilityLabel={a11y('6-digit code')} />
            <Button label="Sign in" icon="check" full loading={busy} disabled={code.length < 6} onPress={() => act(async () => (await verifyPhoneCode(phone, code), done('phone')))} />
          </>
        ) : null}

        {mode !== 'choose' ? <Button label="Other ways to sign in" variant="ghost" icon="arrowLeft" onPress={() => setMode('choose')} /> : null}
        {fromOnboarding && mode === 'choose' ? <Button label="Not now" variant="ghost" onPress={() => router.replace('/(tabs)')} /> : null}

        <Text variant="caption" tone="tertiary">
          {tx('By continuing you confirm you are {age} or older and accept the', { age: APP.minimumAge })}{' '}
          <Text variant="caption" style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/legal/terms')} accessibilityRole="link">
            Terms of Use
          </Text>
          {', '}
          <Text variant="caption" style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/legal/guidelines')} accessibilityRole="link">
            Community Guidelines
          </Text>
          {tx(' and ')}
          <Text variant="caption" style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/legal/privacy')} accessibilityRole="link">
            Privacy Policy
          </Text>
          {tx('. You can delete your account anytime in Profile.')}
        </Text>
      </Animated.View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: 12 },
  input: { height: 56, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 16, fontFamily: font.medium, fontSize: 17 },
  code: { letterSpacing: 8, fontSize: 24, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: radius.lg },
});
