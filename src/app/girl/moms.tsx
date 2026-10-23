import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { SectionHeader } from '@/components/ui/Controls';
import { CITIES } from '@/data/destinations';
import { GirlGate } from '@/features/girl/access';
import { MOM_DOOR } from '@/features/girl/doors';
import { MomsView } from '@/features/girl/MomsView';
import { GirlPortals } from '@/features/home/Portals';
import { useAppSpace } from '@/state/appSpace';
import { useCityId } from '@/state/store';

/**
 * IRLY Mom Community: a page of IRLY Girl, reached only from inside IRLY Girl.
 * Opened from IRLY (Mixte), or by a link, it goes through the IRLY Girl gate
 * first (the server's women-only check, then the switch to IRLY Girl), which
 * brings the member back here.
 */
export default function MomCommunityScreen() {
  const inGirl = useAppSpace() === 'girl';
  const cityId = useCityId();
  if (!inGirl) return <Redirect href={MOM_DOOR} />;
  return (
    <Page overline="IRLY Girl" title="IRLY Mom Community">
      <GirlGate moms>
        <MomsView cityId={cityId} />
        {/* Your spaces: back to IRLY Girl, or to IRLY. */}
        <View style={{ gap: 12, marginTop: 24 }}>
          <SectionHeader overline="Women only · Not dating" title="Your spaces" />
          <GirlPortals light={CITIES[cityId].light} onMomPage />
        </View>
      </GirlGate>
    </Page>
  );
}
