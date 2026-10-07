import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { APP, isMissing } from '@/config/app';
import { useAccount } from '@/features/auth/account';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Kind = 'problem' | 'question' | 'safety' | 'privacy';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'problem', label: 'Report a problem' },
  { id: 'question', label: 'Ask a question' },
  { id: 'safety', label: 'Safety concern' },
  { id: 'privacy', label: 'Privacy request' },
];

const FAQ: { q: string; a: string }[] = [
  { q: 'How do I report or block someone?', a: 'Open their profile or your chat with them and tap the shield button. In a chat you can also long-press a message to report it.' },
  { q: 'How do I change my profile?', a: 'Profile → Edit profile. Your professional profile is in Profile → Professional.' },
  { q: 'Who can see me?', a: 'Settings → Privacy & notifications: choose who can find your profile, who sees your live posts and activities, and how precise your location is (neighbourhood, city or hidden).' },
  { q: 'How do I get a copy of my data or delete my account?', a: 'Profile → Download my data, and Profile → Delete account. Deleting removes your account and data from IRLY’s servers.' },
  { q: 'Someone is in danger', a: 'Contact local emergency services first. Then report the profile in the app or write to us below with "Safety concern".' },
];

/** Help, contact and "Report a problem" (Settings → Support). */
export default function Support() {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const account = useAccount();
  const [kind, setKind] = useState<Kind>('problem');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const send = async () => {
    if (!supabase || !account) {
      router.push('/account');
      return;
    }
    if (body.trim().length < 5) {
      toast(tr('Tell us a little more (a few words at least)'), 'x', 'live');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('support_requests').insert({
      user_id: account.userId,
      kind,
      body: body.trim().slice(0, 2000),
      contact: account.email ?? null,
      app_version: Constants.expoConfig?.version ?? null,
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    });
    setBusy(false);
    if (error) {
      toast(/slow down/i.test(error.message) ? tr('You sent several messages already. Try again in an hour.') : tr('Could not send. Check your connection and try again.'), 'x', 'live');
      return;
    }
    setBody('');
    toast(tr('Sent. Thank you, we will look at it'), 'check', 'positive');
  };

  const email = kind === 'privacy' ? APP.privacyEmail : kind === 'safety' ? APP.safetyEmail : APP.supportEmail;

  return (
    <Page overline="Settings" title="Help & support" subtitle="Answers to common questions, and a way to reach the IRLY team.">
      <View style={styles.body}>
        <View style={{ gap: 8 }}>
          {FAQ.map((f, i) => (
            <View key={f.q} style={[styles.faq, { backgroundColor: t.c.surface }]}>
              <Text variant="titleS" onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button">
                {f.q}
              </Text>
              {open === i ? (
                <Text variant="body" tone="secondary">
                  {f.a}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <Text variant="overline" tone="tertiary">
            Write to us
          </Text>
          <View style={styles.wrap}>
            {KINDS.map((k) => (
              <Chip key={k.id} size="sm" label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />
            ))}
          </View>
          <Field value={body} onChangeText={setBody} multiline maxLength={2000} placeholder="What happened, on which screen" accessibilityLabel={tr('Your message')} />
          <Button label={account ? 'Send' : 'Sign in to send'} icon="send" full loading={busy} onPress={send} />
          <Text variant="caption" tone="tertiary">
            {isMissing(email) ? tr('Email contact: {email}', { email }) : tr('Or email {email}', { email })}
          </Text>
          {!isMissing(email) ? <Button label="Open email" variant="ghost" onPress={() => Linking.openURL(`mailto:${email}`)} /> : null}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[7] },
  faq: { padding: 14, gap: 8, borderRadius: radius.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
