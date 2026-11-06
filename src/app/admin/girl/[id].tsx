import { useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Divider, Segmented } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { adminStyles, Card, Loadable, NoAccess, useLoad } from '@/features/admin/ui';
import { ModerationBanner } from '@/features/girl/ModerationBanner';
import { girlViewChat, girlViewCommunity, useGirlModeration, type GirlViewMessage, type GirlViewPage } from '@/features/girl/moderation';
import { t as tx } from '@/i18n';
import { cityWhen, timeAgo } from '@/lib/time';
import { useTheme } from '@/theme/useTheme';

/** A crash here shows Try again and a way home, not a blank screen (components/layout/ErrorScreen). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} retry={retry} where="admin" />;
}

const ago = (ms: number) => timeAgo(Math.max(0, Math.round((Date.now() - ms) / 60000)));
type Tab = 'posts' | 'members' | 'activities' | 'chat';

/** One IRLY Girl community, read-only, for the safety moderator: posts, members, activities (and IRLY's own chat). */
export default function GirlModerationCommunity() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const allowed = useGirlModeration();
  if (allowed === undefined) return <Page title="Moderation view"><ActivityIndicator color={t.c.text} /></Page>;
  if (!allowed) return <Page title="Moderation view"><View style={adminStyles.body}><NoAccess /></View></Page>;
  return <Community id={id ?? ''} />;
}

function Community({ id }: { id: string }) {
  const t = useTheme();
  const { data: p, error, reload } = useLoad<GirlViewPage>(() => girlViewCommunity(id), id);
  const [tab, setTab] = useState<Tab>('posts');
  if (error || !p) {
    return (
      <Page title="Moderation view">
        <View style={adminStyles.body}>
          <ModerationBanner />
          {error ? (
            <>
              <Text variant="body" tone="secondary">
                {tx(error)}
              </Text>
              <Button label="Try again" variant="secondary" onPress={reload} />
            </>
          ) : (
            <ActivityIndicator color={t.c.text} />
          )}
        </View>
      </Page>
    );
  }
  const c = p.community;
  return (
    <Page overline="IRLY Girl" title={c.name}>
      <View style={adminStyles.body}>
        <ModerationBanner />
        {c.tagline ? (
          <Text variant="body" tone="secondary" raw>
            {c.tagline}
          </Text>
        ) : null}
        <Text variant="caption" tone="tertiary" raw>
          {[c.official ? tx('IRLY Community') : null, c.cityId, tx('{n} members', { n: c.members })].filter(Boolean).join(' · ')}
        </Text>
        <Segmented
          options={[
            { value: 'posts', label: tx('Posts') },
            { value: 'members', label: tx('Members') },
            { value: 'activities', label: tx('Activities') },
            ...(c.official ? [{ value: 'chat' as const, label: tx('Chat') }] : []),
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'posts' ? (
          p.posts.length ? (
            p.posts.map((x, i) => (
              <Card key={x.id} index={i}>
                <Text variant="titleS" raw>
                  {x.asIrly ? 'IRLY' : x.firstName}
                </Text>
                <Text variant="caption" tone="tertiary" raw>
                  {[ago(x.createdAt), x.pinned ? tx('Pinned') : null, x.media ? tx('{n} photos or videos', { n: x.media }) : null, `♥ ${x.likes}`, `💬 ${x.comments}`].filter(Boolean).join(' · ')}
                </Text>
                {x.body ? (
                  <Text variant="body" raw>
                    {x.body}
                  </Text>
                ) : null}
              </Card>
            ))
          ) : (
            <Text variant="body" tone="secondary">
              No posts yet.
            </Text>
          )
        ) : null}
        {tab === 'members' ? (
          <Card>
            {p.members.length ? (
              p.members.map((m, i) => (
                <View key={m.userId} style={{ gap: 2 }}>
                  {i ? <Divider /> : null}
                  <Text variant="bodyS" raw>
                    {m.firstName}
                    {m.role !== 'member' ? ` · ${tx(m.role === 'owner' ? 'Creator' : m.role === 'co_admin' ? 'Co-admin' : 'Moderator')}` : ''}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="body" tone="secondary">
                No members to show yet
              </Text>
            )}
          </Card>
        ) : null}
        {tab === 'activities' ? (
          p.activities.length ? (
            p.activities.map((a, i) => (
              <Card key={a.id} index={i}>
                <Text variant="titleS" raw>
                  {a.title}
                </Text>
                <Text variant="caption" tone="tertiary" raw>
                  {[cityWhen(a.startsAt, c.cityId ?? 'dubai'), `${a.going} ${tx('going')}`, a.cancelled ? tx('Cancelled') : null].filter(Boolean).join(' · ')}
                </Text>
              </Card>
            ))
          ) : (
            <Text variant="body" tone="secondary">
              No activities in the last 30 days.
            </Text>
          )
        ) : null}
        {tab === 'chat' ? <Chat id={c.id} /> : null}
      </View>
    </Page>
  );
}

/** IRLY's own community chat, its last 50 messages (read only when this tab opens: one more journal line). */
function Chat({ id }: { id: string }) {
  const { data, error, reload } = useLoad<GirlViewMessage[]>(() => girlViewChat(id), `chat-${id}`);
  return (
    <Loadable data={data} error={error} retry={reload} empty="No messages yet.">
      {(list) => (
        <Card>
          {list.map((m, i) => (
            <View key={m.id} style={{ gap: 2 }}>
              {i ? <Divider /> : null}
              <Text variant="caption" tone="tertiary" raw>
                {m.firstName} · {ago(m.createdAt)}
              </Text>
              <Text variant="bodyS" raw>
                {m.body ?? tx('Photo')}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </Loadable>
  );
}
