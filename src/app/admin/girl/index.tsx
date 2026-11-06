import { router, type ErrorBoundaryProps } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Text } from '@/components/ui/Text';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { adminStyles, Card, Loadable, NoAccess, useLoad } from '@/features/admin/ui';
import { ModerationBanner } from '@/features/girl/ModerationBanner';
import { girlViewActivities, girlViewCommunities, useGirlModeration, type GirlViewActivity, type GirlViewCommunity } from '@/features/girl/moderation';
import { t as tx } from '@/i18n';
import { cityWhen } from '@/lib/time';
import { useTheme } from '@/theme/useTheme';

/** A crash here shows Try again and a way home, not a blank screen (components/layout/ErrorScreen). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} retry={retry} where="admin" />;
}

/**
 * IRLY Girl, moderation view: for the one safety moderator the owner
 * designated. Read-only; the server writes each opening to the staff journal
 * and refuses everyone else (the door below only shows for that person).
 */
export default function GirlModerationHome() {
  const t = useTheme();
  const allowed = useGirlModeration();
  return (
    <Page overline="IRLY Girl" title="Moderation view">
      <View style={adminStyles.body}>
        {allowed === undefined ? <ActivityIndicator color={t.c.text} /> : allowed ? <Lists /> : <NoAccess />}
      </View>
    </Page>
  );
}

function Lists() {
  const communities = useLoad<GirlViewCommunity[]>(girlViewCommunities, 'girl-view-communities');
  const activities = useLoad<GirlViewActivity[]>(girlViewActivities, 'girl-view-activities');
  return (
    <>
      <ModerationBanner />
      <Text variant="label">Communities</Text>
      <Loadable data={communities.data} error={communities.error} retry={communities.reload} empty="No IRLY Girl community.">
        {(list) =>
          list.map((c, i) => (
            <Card key={c.id} index={i} onPress={() => router.push(`/admin/girl/${c.id}`)} accessibilityLabel={c.name}>
              <Text variant="titleS" raw>
                {c.name}
              </Text>
              <Text variant="caption" tone="tertiary" raw>
                {[c.official ? tx('IRLY Community') : null, c.cityId, tx('{n} members', { n: c.members }), c.retired ? tx('Retired') : null].filter(Boolean).join(' · ')}
              </Text>
            </Card>
          ))
        }
      </Loadable>
      <Text variant="label">Activities</Text>
      <Loadable data={activities.data} error={activities.error} retry={activities.reload} empty="No IRLY Girl activity coming up.">
        {(list) =>
          list.map((a, i) => (
            <Card key={a.id} index={i}>
              <Text variant="titleS" raw>
                {a.title}
              </Text>
              <Text variant="caption" tone="tertiary" raw>
                {[cityWhen(a.startsAt, 'dubai'), a.community, `${a.going} ${tx('going')}`, a.cancelled ? tx('Cancelled') : null].filter(Boolean).join(' · ')}
              </Text>
            </Card>
          ))
        }
      </Loadable>
    </>
  );
}
