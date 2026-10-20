import { Page } from '@/components/layout/Page';
import { GirlHeaderMark } from '@/features/girl/GirlMark';
import { SettingsSections } from '@/features/settings/SettingsSections';
import { SpaceFlavor } from '@/theme/space';
import { useTheme } from '@/theme/useTheme';

/** Settings on their own screen: the gear in the tab bar. */
export default function PreferencesRoute() {
  // Opened from IRLY Girl, the page wears the Girl look (cosmetic only, see theme/space).
  return (
    <SpaceFlavor>
      <Preferences />
    </SpaceFlavor>
  );
}

function Preferences() {
  const t = useTheme();
  return (
    <Page title="Settings" right={t.flavor === 'girl' ? <GirlHeaderMark size={14} /> : undefined}>
      <SettingsSections />
    </Page>
  );
}
