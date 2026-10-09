import { Page } from '@/components/layout/Page';
import { SettingsSections } from '@/features/settings/SettingsSections';

/** Settings on their own screen: the gear in the tab bar. */
export default function Preferences() {
  return (
    <Page title="Settings">
      <SettingsSections />
    </Page>
  );
}
