import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { NotFound } from '@/components/layout/NotFound';
import { Page } from '@/components/layout/Page';
import { Text } from '@/components/ui/Text';
import { LEGAL_REQUIRED } from '@/config/app';
import { LEGAL, LEGAL_FR, type LegalDoc } from '@/content/legal';
import { dateLocale, useLang, useT } from '@/i18n';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Privacy Policy, Terms of Use and Community Guidelines (Settings → Legal &
 * support). The texts are drafts pending legal review, written in English
 * and in French (src/content/legal.ts); each language shows its own text.
 */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const tr = useT();
  const t = useTheme();
  const lang = useLang();
  const d = (lang === 'fr' ? LEGAL_FR : LEGAL)[doc as LegalDoc];
  if (!d) return <NotFound title="This page does not exist" />;
  // Missing legal information stands out, so nobody mistakes a draft for a final text.
  const mark = (s: string) =>
    s.split(LEGAL_REQUIRED).flatMap((part, i) =>
      i === 0
        ? [part]
        : [
            <Text key={i} variant="body" color={t.c.live} raw style={{ fontWeight: '700' }}>
              {lang === 'fr' ? '[INFORMATION JURIDIQUE REQUISE]' : LEGAL_REQUIRED}
            </Text>,
            part,
          ],
    );
  return (
    <Page overline="Legal" title={d.title} subtitle={tr('Version {v} · updated {date}', { v: d.version, date: new Date(`${d.updated}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) })}>
      <View style={styles.body}>
        <Text variant="body" tone="secondary" raw>
          {mark(d.intro)}
        </Text>
        {d.sections.map((s) => (
          <View key={s.title} style={{ gap: 8 }}>
            <Text variant="titleM" accessibilityRole="header" raw>
              {s.title}
            </Text>
            {s.body.map((p, i) => (
              <Text key={i} variant="body" tone="secondary" raw>
                {mark(p)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[6] },
});
