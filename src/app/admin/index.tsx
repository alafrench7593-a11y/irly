import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { isAdmin, isModerator, loadDashboard, useStaffRole, type Dashboard } from '@/features/admin/api';
import { adminStyles, NoAccess, Stat } from '@/features/admin/ui';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Back office home: live counts from the server and the doors to each tool.
 * Doors follow the caller's role; the server checks it again on every call.
 */
export default function AdminHome() {
  const t = useTheme();
  const role = useStaffRole();
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    loadDashboard()
      .then((x) => {
        setD(x);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, []);
  useEffect(() => {
    if (isModerator(role)) load();
  }, [role, load]);

  return (
    <Page overline="IRLY" title="Back office" subtitle={role ? tx('Your role: {role}', { role: tx(ROLE_LABEL[role]) }) : undefined}>
      <View style={adminStyles.body}>
        {role === undefined ? (
          <ActivityIndicator color={t.c.text} />
        ) : !isModerator(role) ? (
          <NoAccess />
        ) : (
          <>
            {error ? (
              <View style={{ gap: space[2] }}>
                <Text variant="body" tone="secondary">
                  {tx(error)}
                </Text>
                <Button label="Try again" variant="secondary" onPress={load} />
              </View>
            ) : !d ? (
              <ActivityIndicator color={t.c.text} />
            ) : (
              <View style={adminStyles.row}>
                <Stat icon="flag" label="New reports" value={d.new} alert={d.new > 0} onPress={() => router.push('/admin/reports?status=open')} />
                <Stat icon="flame" label="High priority, open" value={d.high} alert={d.high > 0} onPress={() => router.push('/admin/reports?priority=high')} />
                <Stat icon="eye" label="Under review" value={d.reviewing} onPress={() => router.push('/admin/reports?status=reviewing')} />
                <Stat icon="question" label="Waiting for information" value={d.need_info} onPress={() => router.push('/admin/reports?status=need_info')} />
                <Stat icon="calendar" label="Reports in 7 days" value={d.week} />
                <Stat icon="lock" label="Active suspensions and bans" value={d.sanctions} />
                <Stat icon="users" label="Members" value={d.members} />
              </View>
            )}
            <View style={{ gap: 8, marginTop: space[2] }}>
              <Button label="Reports inbox" icon="flag" full onPress={() => router.push('/admin/reports')} />
              <Button label="Members and sanctions" icon="users" variant="secondary" full onPress={() => router.push('/admin/members')} />
              {isAdmin(role) ? <Button label="Audit log" icon="file" variant="secondary" full onPress={() => router.push('/admin/audit')} /> : null}
              {role === 'owner' ? <Button label="Team and roles" icon="shield" variant="secondary" full onPress={() => router.push('/admin/team')} /> : null}
              {isAdmin(role) ? <Button label="Profile verifications" icon="scanFace" variant="ghost" full onPress={() => router.push('/admin/verifications')} /> : null}
              {isAdmin(role) ? <Button label="News sources" icon="news" variant="ghost" full onPress={() => router.push('/admin/news')} /> : null}
            </View>
          </>
        )}
      </View>
    </Page>
  );
}

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', moderator: 'Moderator', content: 'Content' } as const;
