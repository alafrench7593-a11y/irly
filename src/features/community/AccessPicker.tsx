import { StyleSheet, View } from 'react-native';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { QUESTION_MAX, QUESTIONS_MAX, type CommunityAccessMode } from './applications';

/**
 * How a community is joined: open (anyone eligible joins at once), or
 * private, by application (its team accepts each member). With up to three
 * questions asked to applicants. Used when creating a community and in
 * « Manage → Settings ».
 */
export function AccessPicker({ access, onAccess, questions, onQuestions, disabled }: { access: CommunityAccessMode; onAccess: (a: CommunityAccessMode) => void; questions: string[]; onQuestions: (q: string[]) => void; disabled?: boolean }) {
  const slots = Array.from({ length: QUESTIONS_MAX }, (_, i) => questions[i] ?? '');
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.wrap}>
        <Chip size="sm" icon="globe" label={tx('Open to all')} selected={access === 'open'} onPress={() => !disabled && onAccess('open')} />
        <Chip size="sm" icon="lock" label={tx('Private · By application')} selected={access === 'application'} onPress={() => !disabled && onAccess('application')} />
      </View>
      <Text variant="bodyS" tone="secondary">
        {access === 'application'
          ? 'Everyone eligible sees the community’s page. Its posts, chat, activities and members are for accepted members only: people ask to join, and the team accepts or refuses.'
          : 'Anyone eligible joins at once and reads everything.'}
      </Text>
      {access === 'application' ? (
        <View style={{ gap: 8 }}>
          <Text variant="label">Questions for applicants (optional)</Text>
          <Text variant="caption" tone="tertiary">
            Up to three. Applicants always write a short message too.
          </Text>
          {slots.map((q, i) => (
            <Field
              key={i}
              value={q}
              editable={!disabled}
              onChangeText={(v) => {
                const next = [...slots];
                next[i] = v.slice(0, QUESTION_MAX);
                onQuestions(next);
              }}
              maxLength={QUESTION_MAX}
              placeholder={tx('Question {n}', { n: i + 1 })}
              accessibilityLabel={tx('Question {n}', { n: i + 1 })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
