import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Chip, IconButton } from '@/components/ui/Controls';
import { GlassCard } from '@/components/ui/GlassCard';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { adminStyles } from '@/features/admin/ui';
import { saveContact } from '@/features/crm/api';
import { CATEGORIES, CATEGORY_LABEL, contactName, STAGES, today, type Category, type Contact, type Stage } from '@/features/crm/model';
import { crmStyles, CrmGate, CrmLoad, Filter, shortDate, useCrm, useTeam } from '@/features/crm/ui';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The sales pipeline as columns, one per stage. A card moves one stage
 * left or right with its arrows; the server logs every move
 * (crm_stage_history). Tap a card to open the contact.
 */
export default function Pipeline() {
  return (
    <Page overline="CRM" title="Sales pipeline" subtitle="Move a prospect with its arrows. Every move is kept in its history.">
      <View style={adminStyles.body}>
        <CrmGate>
          <Board />
        </CrmGate>
      </View>
    </Page>
  );
}

function Board() {
  const { data, error, reload } = useCrm();
  const team = useTeam();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [owner, setOwner] = useState('all');
  // Moves shown at once, before the server answers; undone if it refuses.
  const [moved, setMoved] = useState<Record<string, Stage>>({});
  const [moving, setMoving] = useState<string | null>(null);
  const contacts = data?.contacts.map((c) => (moved[c.id] ? { ...c, stage: moved[c.id] } : c)) ?? null;

  const move = (c: Contact, to: Stage) => {
    if (moving) return;
    setMoving(c.id);
    const before = moved;
    setMoved({ ...moved, [c.id]: to });
    saveContact({ id: c.id, stage: to })
      .then(() => toast(tx('Moved to {stage}', { stage: tx(STAGES.find((s) => s.value === to)!.label) }), 'check', 'brand'))
      .catch((e) => {
        setMoved(before);
        toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live');
      })
      .finally(() => setMoving(null));
  };

  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {() => {
        const live = (contacts ?? []).filter((c) => !c.archived_at && (category === 'all' || c.category === category) && (owner === 'all' || (owner === 'none' ? !c.owner_id : c.owner_id === owner)));
        return (
          <>
            <Text variant="label">Type of contact</Text>
            <Filter options={CATEGORIES} value={category} onChange={setCategory} />
            {team.length ? (
              <>
                <Text variant="label">Person in charge</Text>
                <View style={crmStyles.wrap}>
                  <Chip size="sm" label="All" selected={owner === 'all'} onPress={() => setOwner('all')} />
                  <Chip size="sm" label="Nobody" selected={owner === 'none'} onPress={() => setOwner('none')} />
                  {team.map((m) => (
                    <Chip key={m.user_id} size="sm" raw label={m.first_name ?? '—'} selected={owner === m.user_id} onPress={() => setOwner(m.user_id)} />
                  ))}
                </View>
              </>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.board}>
              {STAGES.map((s, i) => {
                const cards = live.filter((c) => c.stage === s.value);
                return (
                  <View key={s.value} style={styles.column}>
                    <Text variant="label" raw>
                      {tx(s.label)} · {cards.length}
                    </Text>
                    {cards.map((c) => (
                      <Card key={c.id} c={c} busy={moving === c.id} prev={i > 0 ? STAGES[i - 1].value : null} next={i < STAGES.length - 1 ? STAGES[i + 1].value : null} onMove={move} />
                    ))}
                    {cards.length ? null : (
                      <Text variant="caption" tone="tertiary">
                        Empty
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </>
        );
      }}
    </CrmLoad>
  );
}

function Card({ c, prev, next, onMove, busy }: { c: Contact; prev: Stage | null; next: Stage | null; onMove: (c: Contact, to: Stage) => void; busy: boolean }) {
  const t = useTheme();
  const late = c.next_follow_up !== null && c.next_follow_up < today();
  return (
    <GlassCard level="regular" padding={12} onPress={() => router.push(`/admin/crm/contact?id=${c.id}`)} accessibilityLabel={contactName(c)} style={busy ? { opacity: 0.5 } : null}>
      <View style={styles.card}>
      <Text variant="bodyS" raw numberOfLines={2}>
        {contactName(c)}
      </Text>
      <Text variant="caption" tone="secondary" raw numberOfLines={1}>
        {tx(CATEGORY_LABEL[c.category])}
        {c.company ? ` · ${c.company}` : ''}
      </Text>
      {c.next_follow_up ? (
        <Text variant="caption" tone={late ? 'live' : 'tertiary'} raw>
          {tx('Follow up on {d}', { d: shortDate(c.next_follow_up) })}
        </Text>
      ) : null}
      <View style={[styles.arrows, { borderTopColor: t.c.overlay }]}>
        {prev ? <IconButton icon="chevronLeft" size={30} onPress={() => onMove(c, prev)} label="Move back one stage" /> : <View style={{ width: 30 }} />}
        {next ? <IconButton icon="chevronRight" size={30} onPress={() => onMove(c, next)} label="Move forward one stage" /> : null}
      </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  board: { gap: space[2], paddingBottom: space[2], alignItems: 'flex-start' },
  column: { width: 230, gap: 8 },
  card: { gap: 4 },
  arrows: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, marginTop: 4 },
});
