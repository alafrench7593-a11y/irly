import { Redirect } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedRef, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Page } from '@/components/layout/Page';
import { SectionHeader } from '@/components/ui/Controls';
import { CITIES } from '@/data/destinations';
import { GirlGate } from '@/features/girl/access';
import { MOM_DOOR } from '@/features/girl/doors';
import { MomsView } from '@/features/girl/MomsView';
import { GirlPortals } from '@/features/home/Portals';
import { useAppSpace } from '@/state/appSpace';
import { useCityId } from '@/state/store';
import { layout } from '@/theme/tokens';

/**
 * IRLY Mom Community: a page of IRLY Girl, reached only from inside IRLY Girl.
 * Opened from IRLY (Mixte), or by a link, it goes through the IRLY Girl gate
 * first (the server's women-only check, then the switch to IRLY Girl), which
 * brings the member back here.
 */
export default function MomCommunityScreen() {
  const inGirl = useAppSpace() === 'girl';
  const cityId = useCityId();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // « Plan it » and « See communities » bring their section into view, under the header.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const base = useRef(0);
  const section = (name: string, y: number) => {
    if (name === 'goPlan' || name === 'goCommunities') scrollRef.current?.scrollTo({ y: Math.max(0, base.current + y - insets.top - layout.headerHeight), animated: !reduced });
  };
  if (!inGirl) return <Redirect href={MOM_DOOR} />;
  return (
    <Page overline="IRLY Girl" title="IRLY Mom Community" scrollRef={scrollRef}>
      <GirlGate moms>
        <View onLayout={(e) => (base.current = e.nativeEvent.layout.y)}>
          <MomsView cityId={cityId} onSection={section} />
        </View>
        {/* Your spaces: back to IRLY Girl, or to IRLY. */}
        <View style={{ gap: 12, marginTop: 24 }}>
          <SectionHeader overline="Women only · Not dating" title="Your spaces" />
          <GirlPortals light={CITIES[cityId].light} onMomPage />
        </View>
      </GirlGate>
    </Page>
  );
}
