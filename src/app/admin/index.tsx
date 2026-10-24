import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import {
  isAdmin,
  isContentStaff,
  isModerator,
  loadDashboard,
  loadOverview,
  loadOverviewMore,
  loadSpaces,
  SPACE_LABEL,
  type Dashboard,
  type Overview,
  type OverviewMore,
  type SpaceRow,
} from '@/features/admin/api';
import { ACTION_LABEL } from '@/features/admin/labels';
import { adminStyles, ago, Card, NoAccess, Stat, useAdminRole, useLoad } from '@/features/admin/ui';
import { t as tx } from '@/i18n';
import { girlPalette, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Back office home: real counts from the server (admins see the whole
 * overview, moderators their inbox counts) and the doors to each section.
 * Doors follow the caller's role; the server checks it again on every call.
 */
export default function AdminHome() {
  const t = useTheme();
  const role = useAdminRole();
  const admin = isAdmin(role);
  const staff = Boolean(role);

  return (
    <Page overline="IRLY" title="Back office" subtitle={role ? tx('Your role: {role}', { role: tx(ROLE_LABEL[role]) }) : undefined}>
      <View style={adminStyles.body}>
        {role === undefined ? (
          <ActivityIndicator color={t.c.text} />
        ) : !staff ? (
          <NoAccess />
        ) : (
          <>
            {admin ? <AdminOverview /> : isModerator(role) ? <ModeratorCounts /> : null}
            <SpacesOverview />
            <Text variant="label" style={{ marginTop: space[2] }}>
              Sections
            </Text>
            <View style={{ gap: 8 }}>
              <Button label="Users" icon="users" variant="secondary" full onPress={() => router.push('/admin/members')} />
              <Button label="Communities" icon="network" variant="secondary" full onPress={() => router.push('/admin/communities')} />
              <Button label="Activities and posts" icon="layers" variant="secondary" full onPress={() => router.push('/admin/content')} />
              <Button label="Photos" icon="image" variant="secondary" full onPress={() => router.push('/admin/photos')} />
              {isContentStaff(role) ? <Button label="IRLY news" icon="megaphone" variant="secondary" full onPress={() => router.push('/admin/actu')} /> : null}
              {isContentStaff(role) ? <Button label="Official communities" icon="star" variant="secondary" full onPress={() => router.push('/admin/official')} /> : null}
              {isContentStaff(role) ? <Button label="Home layout" icon="layers" variant="secondary" full onPress={() => router.push('/admin/home-layout')} /> : null}
              {isContentStaff(role) ? <Button label="Banners & visuals" icon="image" variant="secondary" full onPress={() => router.push('/admin/banners')} /> : null}
              {isModerator(role) ? <Button label="Reports" icon="flag" variant="secondary" full onPress={() => router.push('/admin/reports')} /> : null}
              {admin ? <Button label="Moderation log" icon="file" variant="secondary" full onPress={() => router.push('/admin/audit')} /> : null}
              {admin ? <Button label="Admin settings" icon="settings" variant="secondary" full onPress={() => router.push('/admin/settings')} /> : null}
              {role === 'owner' ? <Button label="Team and roles" icon="shield" variant="ghost" full onPress={() => router.push('/admin/team')} /> : null}
              {admin ? <Button label="Profile verifications" icon="scanFace" variant="ghost" full onPress={() => router.push('/admin/verifications')} /> : null}
              {admin ? <Button label="News sources" icon="news" variant="ghost" full onPress={() => router.push('/admin/news')} /> : null}
            </View>
          </>
        )}
      </View>
    </Page>
  );
}

function Failed({ error, retry }: { error: string; retry: () => void }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="body" tone="secondary">
        {tx(error)}
      </Text>
      <Button label="Try again" variant="secondary" onPress={retry} />
    </View>
  );
}

function AdminOverview() {
  const t = useTheme();
  const { data: o, error, reload } = useLoad<Overview>(loadOverview, 'overview');
  if (error) return <Failed error={error} retry={reload} />;
  if (!o) return <ActivityIndicator color={t.c.text} />;
  return (
    <>
      <Text variant="label">Members</Text>
      <View style={adminStyles.row}>
        <Stat index={0} icon="users" label="Members" value={o.users} onPress={() => router.push('/admin/members')} />
        <Stat index={1} icon="userPlus" label="New in 7 days" value={o.new_7d} />
        <Stat index={2} icon="userPlus" label="New in 30 days" value={o.new_30d} />
        <Stat index={3} icon="activity" label="Active in 30 days" value={o.active_30d} />
        {o.signins_30d !== null ? <Stat index={4} icon="key" label="Signed in, 30 days" value={o.signins_30d} /> : null}
      </View>
      <Text variant="caption" tone="tertiary">
        Active: posted, messaged, created or joined something in the last 30 days.
      </Text>
      <Text variant="label">Content</Text>
      <View style={adminStyles.row}>
        <Stat index={0} icon="network" label="Communities" value={o.communities} onPress={() => router.push('/admin/communities')} />
        <Stat index={1} icon="calendar" label="Activities (upcoming)" value={`${o.activities} (${o.activities_upcoming})`} onPress={() => router.push('/admin/content')} />
        <Stat index={2} icon="message" label="Community posts" value={o.posts} onPress={() => router.push('/admin/content?kind=community_post')} />
        <Stat index={3} icon="video" label="Lives online" value={o.lives} />
      </View>
      <Text variant="label">Moderation</Text>
      <View style={adminStyles.row}>
        <Stat index={0} icon="flag" label="New reports" value={o.reports_open} alert={o.reports_open > 0} onPress={() => router.push('/admin/reports?status=open')} />
        <Stat index={1} icon="eye" label="In review" value={o.reports_review} onPress={() => router.push('/admin/reports?status=reviewing')} />
        <Stat index={2} icon="question" label="Action needed" value={o.reports_action} alert={o.reports_action > 0} onPress={() => router.push('/admin/reports?status=need_info')} />
        <Stat index={3} icon="flame" label="Important reports, 7 days" value={o.important_7d} />
        <Stat index={4} icon="lock" label="Suspended members" value={o.suspended} />
        <Stat index={5} icon="x" label="Banned members" value={o.banned} />
        <Stat index={6} icon="layers" label="Hidden by the team" value={o.hidden} onPress={() => router.push('/admin/content?filter=hidden')} />
        {o.email_failed ? <Stat index={7} icon="send" label="Report emails failed" value={o.email_failed} alert onPress={() => router.push('/admin/settings')} /> : null}
      </View>
      <MoreCounts />
      <Card>
        <Text variant="label">Recent moderation actions</Text>
        {o.recent.length ? (
          o.recent.map((r, i) => (
            <View key={i} style={{ gap: 2 }}>
              {i ? <Divider /> : null}
              <Text variant="caption" tone="tertiary" raw>
                {ago(r.at)} · {r.by}
              </Text>
              <Text variant="bodyS" raw>
                {tx(ACTION_LABEL[r.action] ?? r.action)}
                {r.target ? ` · ${r.target}` : ''}
              </Text>
            </View>
          ))
        ) : (
          <Text variant="bodyS" tone="secondary">
            Nothing yet.
          </Text>
        )}
        <Button label="Moderation log" size="sm" variant="ghost" onPress={() => router.push('/admin/audit')} />
      </Card>
    </>
  );
}

/** Handled reports and the errors members saw, 7 days (admins). */
function MoreCounts() {
  const { data: m } = useLoad<OverviewMore>(loadOverviewMore, 'overview_more');
  if (!m) return null;
  return (
    <>
      <View style={adminStyles.row}>
        <Stat index={0} icon="check" label="Reports handled, 7 days" value={m.reports_closed_7d} onPress={() => router.push('/admin/reports?status=actioned')} />
        <Stat index={1} icon="x" label="Rejected, 7 days" value={m.reports_dismissed_7d} onPress={() => router.push('/admin/reports?status=dismissed')} />
        <Stat index={2} icon="flame" label="Errors members saw, 7 days" value={m.errors_7d} alert={m.errors_7d > 0} />
      </View>
      {m.errors_top.length ? (
        <Card>
          <Text variant="label">Most frequent errors (7 days)</Text>
          {m.errors_top.map((e, i) => (
            <Text key={i} variant="caption" tone="secondary" raw>
              {e.code}
              {e.place ? ` · ${e.place}` : ''} · {e.n}
            </Text>
          ))}
        </Card>
      ) : null}
    </>
  );
}

/** Each space at a glance: communities, upcoming activities, reports waiting (whole team). */
function SpacesOverview() {
  const t = useTheme();
  const { data, error, reload } = useLoad<SpaceRow[]>(loadSpaces, 'spaces');
  if (error) return <Failed error={error} retry={reload} />;
  if (!data) return null;
  return (
    <>
      <Text variant="label" style={{ marginTop: space[2] }}>
        By space
      </Text>
      {data.map((r, i) => (
        <Card key={r.space} index={i} onPress={() => router.push(`/admin/content?space=${r.space}`)} accessibilityLabel={tx(SPACE_LABEL[r.space])}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SPACE_DOT[r.space] ?? t.c.text }} />
            <Text variant="titleS">{SPACE_LABEL[r.space]}</Text>
          </View>
          <Text variant="caption" tone="secondary" raw>
            {tx('{n} communities', { n: r.communities })} · {tx('{n} upcoming activities', { n: r.activities_upcoming })} ·{' '}
            {tx('{n} new reports', { n: r.reports_open })} · {tx('{n} in review', { n: r.reports_review })}
          </Text>
        </Card>
      ))}
    </>
  );
}

// A dot so the space being managed is never in doubt: Mixte grey, Girl its rose, Maman peach (no global colour changes).
const SPACE_DOT: Record<string, string> = { mixte: '#8E8E93', girl: girlPalette.brand, mom: '#E7A07A' };

function ModeratorCounts() {
  const t = useTheme();
  const { data: d, error, reload } = useLoad<Dashboard>(loadDashboard, 'dashboard');
  if (error) return <Failed error={error} retry={reload} />;
  if (!d) return <ActivityIndicator color={t.c.text} />;
  return (
    <View style={adminStyles.row}>
      <Stat index={0} icon="flag" label="New reports" value={d.new} alert={d.new > 0} onPress={() => router.push('/admin/reports?status=open')} />
      <Stat index={1} icon="flame" label="High priority, open" value={d.high} alert={d.high > 0} onPress={() => router.push('/admin/reports?priority=high')} />
      <Stat index={2} icon="eye" label="In review" value={d.reviewing} onPress={() => router.push('/admin/reports?status=reviewing')} />
      <Stat index={3} icon="question" label="Action needed" value={d.need_info} onPress={() => router.push('/admin/reports?status=need_info')} />
      <Stat index={4} icon="calendar" label="Reports in 7 days" value={d.week} />
      <Stat index={5} icon="lock" label="Active suspensions and bans" value={d.sanctions} />
    </View>
  );
}

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', moderator: 'Moderator', content: 'Content' } as const;
