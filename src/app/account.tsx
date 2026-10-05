import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import * as Linking from 'expo-linking';
import { completeFromUrl, sendCode, signOut, useAccount, verifyCode } from '@/features/auth/account';
import { haptic } from '@/motion/haptics';
import { hasBackend } from '@/lib/supabase';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Your IRLY account. Email + 6-digit code (no password to forget). Signing
 * in publishes your profile to the server, so matches, chats, sessions and
 * communities are real and shared with other members. Apple, Google and
 * phone sign-in plug into the same flow.
 */
export default function AccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const url = Linking.useURL();

  // Opened from the email link in the app (native): finish signing in.
  useEffect(() => {
    if (url && url.includes('access_token')) {
      completeFromUrl(url)
        .then((ok) => ok && toast("You're signed in. Your profile is live", 'check', 'positive'))
        .catch((e) => toast(e instanceof Error ? e.message : 'The link has expired', 'x', 'live'));
    }
  }, [url]);

  const send = async () => {
    if (!EMAIL.test(email.trim())) return toast('Enter a valid email address', 'x', 'live');
    setBusy(true);
    try {
      await sendCode(email);
      haptic('success');
      setStep('code');
      toast('Email sent. Check your inbox', 'send', 'brand');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send the code', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.trim().length < 6) return;
    setBusy(true);
    try {
      await verifyCode(email, code);
      haptic('success');
      toast("You're signed in. Your profile is live", 'check', 'positive');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Wrong or expired code', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }];

  if (!hasBackend) {
    return (
      <Page title="Account" subtitle="The IRLY server is not configured in this build." >
        <View />
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
          <Button
            label="Sign out"
            variant="secondary"
            icon="arrowLeft"
            onPress={async () => {
              await signOut();
              toast('Signed out', 'check', 'brand');
            }}
          />
        </View>
      </Page>
    );
  }

  return (
    <Page overline="IRLY account" title={step === 'email' ? 'Sign in' : 'Check your email'} subtitle={step === 'email' ? 'We email you a sign-in link. No password.' : `Sent to ${email.trim()}. Open the link on this device: you will be signed in here. If the email shows a 6-digit code, enter it below.`}>
      <Animated.View key={step} entering={FadeIn.duration(220)} style={styles.body}>
        {step === 'email' ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={t.c.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={send}
              style={input}
              accessibilityLabel="Email"
            />
            <Button label="Email me a sign-in link" icon="send" full loading={busy} disabled={!EMAIL.test(email.trim())} onPress={send} />
          </>
        ) : (
          <>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={t.c.textTertiary}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              onSubmitEditing={verify}
              style={[input, styles.code]}
              accessibilityLabel="6-digit code"
            />
            <Button label="Sign in" icon="check" full loading={busy} disabled={code.length < 6} onPress={verify} />
            <Button label="Use another email" variant="ghost" onPress={() => setStep('email')} />
            <Button label="Send a new email" variant="ghost" onPress={send} />
          </>
        )}
        <Text variant="caption" tone="tertiary">
          By signing in you agree to keep IRLY safe and respectful. You can delete your account anytime in Profile.
        </Text>
      </Animated.View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: 14 },
  input: { height: 56, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 16, fontFamily: font.medium, fontSize: 17 },
  code: { letterSpacing: 8, fontSize: 24, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: radius.lg },
});
