import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Divider, SectionHeader } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { APP, DEMO } from '@/config/app';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { deleteServerAccount, exportMyData, signOut, useAccount } from '@/features/auth/account';
import { DestinationSheet } from '@/features/destination/DestinationSheet';
import { a11y, LANGS, t as tx, useLangStore } from '@/i18n';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { wipeLocal } from '@/state/wipe';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Settings, in one place (the gear on your profile and in the tab bar):
 * my account, privacy, notifications, security, language & preferences,
 * IRLY features, help, legal. Every row opens a screen or does something
 * real; nothing here only looks like a setting.
 */
export function SettingsSections() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const langSetting = useLangStore((s) => s.setting);
  const setLang = useLangStore((s) => s.set);
  const cityId = useCityId();
  const city = CITIES[cityId];
  const dest = DESTINATIONS[city.destinationId];
  const hapticsOn = useStore((s) => s.hapticsOn);
  const setHaptics = useStore((s) => s.setHaptics);
  const setAppearance = useStore((s) => s.setAppearance);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [destSheet, setDestSheet] = useState(false);
  const downloadData = async () => {
    if (!account) {
      router.push('/account');
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      await exportMyData();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not prepare your data. Try again.', 'x', 'live');
    } finally {
      setExporting(false);
    }
  };

  const [langSheet, setLangSheet] = useState(false);
  const version = Constants.expoConfig?.version ?? '';
  return (
    <>
      <Section index={8} title="My account">
        {account ? (
          <>
            <SettingLink icon="send" label="Email" value={account.email ?? '—'} onPress={() => router.push('/account')} />
            <Divider inset={16} />
            <SettingLink icon="user" label="Edit profile" value="Photo, name, @username, bio" onPress={() => router.push('/edit-profile')} />
            <Divider inset={16} />
            <SettingLink icon="file" label="Download my data" value={exporting ? 'Preparing…' : 'A copy of what IRLY stores'} onPress={downloadData} />
            <Divider inset={16} />
            <SettingLink
              icon="arrowLeft"
              label="Log out"
              onPress={() => {
                signOut().catch(() => undefined);
                wipeLocal();
                router.replace('/welcome');
              }}
            />
            <Divider inset={16} />
            <SettingLink icon="x" label="Delete account" danger onPress={() => setConfirmDelete(true)} />
          </>
        ) : (
          <>
            <SettingLink icon="user" label="Sign in or create an account" value="To share your profile" onPress={() => router.push('/account')} />
            <Divider inset={16} />
            <SettingLink icon="user" label="Edit profile" value="On this phone" onPress={() => router.push('/edit-profile')} />
          </>
        )}
      </Section>

      <Section index={9} title="Privacy">
        <SettingLink icon="eye" label="Who sees what" value="Profile, messages, live" onPress={() => router.push('/settings')} />
        <Divider inset={16} />
        <SettingLink icon="pin" label="Location" value="Neighbourhood at most" onPress={() => router.push('/settings')} />
        <Divider inset={16} />
        <SettingLink icon="x" label="Blocked members" onPress={() => router.push('/blocked')} />
      </Section>

      <Section index={10} title="Notifications">
        <SettingLink icon="bell" label="Notifications" value="In the app and on your phone" onPress={() => router.push('/settings')} />
      </Section>

      <Section index={11} title="Security">
        <SettingLink icon="lock" label="Sign-in & password" value={account ? 'Change your password' : 'Sign in first'} onPress={() => router.push('/account')} />
        <Divider inset={16} />
        <SettingLink icon="shield" label="Account compromised?" value="What to do" onPress={() => router.push('/support')} />
      </Section>

      <Section index={12} title="Language & preferences">
        <SettingLink icon="languages" label="Language" value={LANGS.find((l) => l.id === langSetting)?.label} onPress={() => setLangSheet(true)} />
        <Divider inset={16} />
        <SettingLink
          icon={t.mode === 'night' ? 'moon' : 'sun'}
          label="Appearance"
          value={t.mode === 'night' ? 'Dark' : 'Light'}
          onPress={() => setAppearance(t.mode === 'night' ? 'day' : 'night')}
        />
        <Divider inset={16} />
        <View style={[styles.settingRow]}>
          <Icon name="zap" size={18} color={t.c.text} />
          <Text variant="titleS" style={{ flex: 1 }}>
            Haptic feedback
          </Text>
          <Switch
            value={hapticsOn}
            onValueChange={setHaptics}
            trackColor={{ true: t.c.brand, false: t.c.overlay }}
            thumbColor="#FFFFFF"
            accessibilityLabel={a11y('Haptic feedback')}
          />
        </View>
        <Divider inset={16} />
        <SettingLink icon="globe" label="Destination" value={`${tx(dest.shortName)} · ${tx(city.name)}`} onPress={() => setDestSheet(true)} />
      </Section>

      <Section index={13} title="IRLY">
        <SettingLink icon="calendar" label="Calendar" value="Everything you're going to" onPress={() => router.push('/calendar')} />
        <Divider inset={16} />
        <SettingLink icon="bookmark" label="Saved" value="Plans, places, people" onPress={() => router.push('/saved')} />
        <Divider inset={16} />
        <SettingLink icon="briefcase" label="Professional profile" value="Networking" onPress={() => router.push('/network/profile')} />
        <Divider inset={16} />
        <SettingLink icon="heartHandshake" label="IRLY Girl" value="Women only" onPress={() => router.push('/girl')} />
        <Divider inset={16} />
        <SettingLink icon="sparkles" label="Assistant" value="Ask or speak" onPress={() => router.push('/assistant')} />
        <Divider inset={16} />
        <SettingLink icon="orbit" label="What is IRLY?" value="Five scenes, 15 seconds" onPress={() => router.push('/story')} />
        {DEMO ? (
          <>
            <Divider inset={16} />
            <SettingLink icon="palette" label="IRLY Design System" value="Tokens & components" onPress={() => router.push('/design-system')} />
          </>
        ) : null}
      </Section>

      <Section index={14} title="Help & support">
        <SettingLink icon="message" label="Help center & FAQ" onPress={() => router.push('/support')} />
        <Divider inset={16} />
        <SettingLink icon="send" label="Contact support" value={APP.supportEmail} onPress={() => Linking.openURL(`mailto:${APP.supportEmail}`)} />
        <Divider inset={16} />
        <SettingLink icon="wrench" label="Report a problem" onPress={() => router.push('/support?kind=problem' as never)} />
        <Divider inset={16} />
        <SettingLink icon="flag" label="Report a member" value="Safety" onPress={() => router.push('/support?kind=safety' as never)} />
        <Divider inset={16} />
        <SettingLink icon="users" label="Community Guidelines" onPress={() => router.push('/legal/guidelines')} />
      </Section>

      <Section index={15} title="Legal">
        <SettingLink icon="shield" label="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
        <Divider inset={16} />
        <SettingLink icon="file" label="Terms of Use" onPress={() => router.push('/legal/terms')} />
        <Divider inset={16} />
        <SettingLink icon="users" label="Community Guidelines" onPress={() => router.push('/legal/guidelines')} />
        <Divider inset={16} />
        <View style={styles.settingRow}>
          <Icon name="idCard" size={18} color={t.c.text} />
          <Text variant="titleS" style={{ flex: 1 }}>
            Version
          </Text>
          <Text variant="bodyS" tone="tertiary">
            {version}
          </Text>
        </View>
      </Section>

      <Section index={16} title="Follow IRLY">
        <SettingLink icon="camera" label="Instagram" value="@irlyofficial" onPress={() => Linking.openURL(APP.instagram)} />
        <Divider inset={16} />
        <SettingLink icon="music" label="TikTok" value="@irlyofficial" onPress={() => Linking.openURL(APP.tiktok)} />
      </Section>

      <Sheet visible={langSheet} onClose={() => setLangSheet(false)} title="Language">
        <View style={{ paddingHorizontal: space.gutter }}>
          {LANGS.map((l, n) => (
            <View key={l.id}>
              {n ? <Divider /> : null}
              <PressableScale
                haptic="select"
                onPress={() => {
                  setLang(l.id);
                  setLangSheet(false);
                }}
                style={styles.settingRow}
                accessibilityRole="radio"
                accessibilityState={{ selected: langSetting === l.id }}
              >
                <Text variant="titleS" style={{ flex: 1 }} raw>
                  {l.id === 'auto' ? tx('Same as my phone') : l.label}
                </Text>
                {langSetting === l.id ? <Icon name="check" size={18} color={t.c.text} /> : null}
              </PressableScale>
            </View>
          ))}
        </View>
      </Sheet>
      <DestinationSheet visible={destSheet} onClose={() => setDestSheet(false)} />
      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your IRLY account?"
        subtitle="This cannot be undone."
      >
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          <Text variant="body" tone="secondary">
            Your profile, photos, professional and IRLY Girl profiles, messages, posts, comments, connections, matches and notifications are deleted from IRLY’s
            servers, and you are signed out on this phone. Communities you own pass to another member. Content already reported to moderators is kept for review.
          </Text>
          <Text variant="caption" tone="tertiary">
            Want a copy first? Use “Download my data”.
          </Text>
          <Button
            label="Delete my account"
            full
            haptic="warning"
            variant="danger"
            loading={deleting}
            onPress={async () => {
              if (deleting) return;
              setDeleting(true);
              try {
                // Server first: if it fails, nothing is wiped and the member can retry.
                await deleteServerAccount();
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Could not delete your account. Try again.', 'x', 'live');
                setDeleting(false);
                return;
              }
              setDeleting(false);
              wipeLocal();
              setConfirmDelete(false);
              toast('Your account has been deleted', 'check', 'live');
              router.replace('/welcome');
            }}
          />
          <Button label="Cancel" variant="ghost" full onPress={() => setConfirmDelete(false)} />
        </View>
      </Sheet>
    </>
  );
}

function Section({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Animated.View entering={enter.rise(index)} style={styles.section}>
      <SectionHeader title={title} />
      <View style={[styles.group, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>{children}</View>
    </Animated.View>
  );
}

export function SettingLink({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.98}
      onPress={onPress}
      style={styles.settingRow}
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <Icon name={icon} size={18} color={danger ? t.c.critical : t.c.text} />
      <Text variant="titleS" color={danger ? t.c.critical : undefined} style={{ flex: 1 }}>
        {label}
      </Text>
      {value ? (
        <Text variant="bodyS" tone="tertiary" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  value: { maxWidth: '48%', textAlign: 'right' },
  section: { marginBottom: space[8] },
  group: { marginHorizontal: space.gutter, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 56 },
});
