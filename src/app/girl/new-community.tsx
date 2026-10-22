import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CharCount } from "@/components/ui/CharCount";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { CATEGORIES } from "@/data/catalog/categories";
import { CITIES } from "@/data/destinations";
import type { CityId } from "@/data/types";
import { useAccount } from "@/features/auth/account";
import { GirlGate, safeBack } from "@/features/girl/access";
import { girlCommunityPhoto } from "@/features/girl/photos";
import { girl, girlType, GIRL_TINT } from "@/features/girl/theme";
import { GButton, GChip, GField, GIconWell, useGirlMotion, Wrap } from "@/features/girl/ui";
import { setCommunityCover } from "@/features/server/covers";
import { usePhotoSource } from "@/components/ui/PhotoSourceSheet";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { createServerCommunity } from "@/features/server/activities";
import { Photo } from "@/components/visual/Photo";
import { t as tx, a11y } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { PressableScale } from "@/motion/PressableScale";
import { useCityId } from "@/state/store";
import { font, radius, space } from "@/theme/tokens";
import { Flavor } from "@/theme/flavor";
import { GlassLayer } from "@/components/ui/GlassLayer";
import { Ambient } from "@/components/visual/Ambient";
import { LinearGradient } from "expo-linear-gradient";

const NAME_MIN = 3;
const NAME_MAX = 60;

/**
 * Create a community from inside IRLY Girl. One page, read top to bottom:
 * photo, name, description, category, city, who can join. The card at the
 * top is the community as others will see it, updated as you type.
 *
 * It is a real IRLY community (same table, same chat, same members as in the
 * rest of the app). "Women only" makes it an IRLY Girl community: the server
 * checks the creator's access and hides it from everyone without IRLY Girl.
 * Once created, the community opens: its page, its members, its chat.
 */
function GirlNewCommunityInner() {
  const { moms, city } = useLocalSearchParams<{
    moms?: string;
    city?: string;
  }>();
  return (
    <GirlGate moms={moms === "1"}>
      <Form
        moms={moms === "1"}
        start={city && city in CITIES ? (city as CityId) : undefined}
      />
    </GirlGate>
  );
}

function Form({ moms, start }: { moms: boolean; start?: CityId }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const account = useAccount();
  const current = useCityId();
  const here = start ?? current;
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  // Return on the name goes to the one-liner, then to About.
  const taglineRef = useRef<TextInput>(null);
  const aboutRef = useRef<TextInput>(null);
  const [about, setAbout] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [cityId, setCityId] = useState<CityId>(here);
  const [womenOnly, setWomenOnly] = useState(true);
  const [busy, setBusy] = useState<null | "create" | "photo">(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A second tap before the first answer must not send a second request.
  const sending = useRef(false);

  const city = CITIES[cityId];
  // The cities of the same destination, the ones people can pick in the app.
  const cities = useMemo(
    () =>
      (Object.values(CITIES) as (typeof city)[]).filter(
        (c) => c.destinationId === CITIES[here].destinationId,
      ),
    [here],
  );
  const trimmed = name.trim();
  const valid = trimmed.length >= NAME_MIN;
  const missingMoms = moms && womenOnly && valid && !/moms?|mamans?/i.test(trimmed);

  // Library or camera from the shared photo sheet; cropped 16:10 and sent with the community (setCommunityCover).
  const photos = usePhotoSource({ aspect: [16, 10], title: "Community photo", subtitle: "The picture women see first." });
  const choosePhoto = async () => {
    try {
      const picked = await photos.pick();
      if (picked) {
        // Phone photos are 5–10 MB: 1280 px wide is plenty for a card and a header (same as covers.pickPhoto).
        const small = await manipulateAsync(picked.uri, [{ resize: { width: 1280 } }], { compress: 0.75, format: SaveFormat.JPEG });
        haptic("select");
        setPhoto(small.uri);
      }
    } catch {
      toast(
        tx("Photos are not available. Check the access in Settings."),
        "image",
        "live",
      );
    }
  };

  const create = async () => {
    if (!valid || sending.current) return;
    if (!account) {
      router.push("/account");
      return;
    }
    sending.current = true;
    setError(null);
    setBusy("create");
    try {
      const { id } = await createServerCommunity({
        name: trimmed,
        cityId,
        tagline,
        description: about,
        categoryId: category,
        girlOnly: womenOnly,
      });
      // The photo goes up once the community exists; if it fails, the community stays and the photo can be added from its page.
      if (photo) {
        setBusy("photo");
        await setCommunityCover(id, photo).catch(() =>
          toast(
            tx(
              "Your community is live, but the photo did not upload. Add it from its page.",
            ),
            "image",
            "live",
          ),
        );
      }
      haptic("success");
      setDone(true);
      setTimeout(() => router.replace(`/c/${id}`), reduced ? 200 : 900);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tx(
              "The community could not be created. Check your connection and try again.",
            ),
      );
      haptic("error");
    } finally {
      sending.current = false;
      setBusy(null);
    }
  };

  if (done) {
    // Confirmation: the rose seal pops in (success haptic already played), then the name.
    return (
      <View style={[styles.root, styles.center]}>
        <Ambient variant="hero" />
        <Animated.View
          entering={reduced ? undefined : ZoomIn.springify().damping(14)}
          style={styles.doneBadge}
        >
          <LinearGradient
            colors={girl.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 36, zIndex: -1 }]}
          />
          <Icon name="check" size={30} color="#FFFFFF" strokeWidth={2.6} />
        </Animated.View>
        <Animated.View
          entering={reduced ? undefined : FadeInDown.delay(150)}
          style={{ alignItems: "center", gap: 6, paddingHorizontal: 32 }}
        >
          <Text variant="titleL" color={girl.ink} raw style={girlType.section}>
            {trimmed}
          </Text>
          <Text
            variant="bodyS"
            color={girl.inkSoft}
            style={{ textAlign: "center" }}
          >
            {tx("is live. You're its owner: opening it now.")}
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Ambient />
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <PressableScale
          haptic="tap"
          scaleTo={0.9}
          onPress={() => safeBack(router, "/girl")}
          accessibilityLabel={a11y("Back")}
          style={styles.round}
        >
          <GlassLayer radius={20} level="thin" />
          <Icon name="chevronLeft" size={20} color={girl.ink} />
        </PressableScale>
        <Text variant="label" color={girl.inkSoft}>
          {moms ? "IRLY Maman" : "IRLY Girl"}
        </Text>
        <View style={styles.round} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "web" ? undefined : "padding"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          <Animated.View
            entering={
              reduced ? undefined : FadeInDown.springify(520).dampingRatio(0.9)
            }
            style={styles.head}
          >
            <Text
              variant="displayM"
              color={girl.ink}
              raw
              style={girlType.display}
            >
              {tx("A new")}{" "}
              <Text
                variant="displayM"
                color={girl.rose}
                raw
                style={[girlType.display, girlType.accent]}
              >
                {tx("circle")}
              </Text>
            </Text>
            <Text variant="body" color={girl.inkSoft}>
              {tx(
                "A permanent group with its own chat. Women who join are in the chat straight away.",
              )}
            </Text>
          </Animated.View>

          {/* The community as others will see it. */}
          <PressableScale
            haptic="select"
            scaleTo={0.98}
            onPress={choosePhoto}
            accessibilityLabel={a11y(
              photo ? "Change the photo" : "Add a photo",
            )}
            style={styles.preview}
          >
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Photo
                pinned
                tint={GIRL_TINT}
                visual={{ photo: girlCommunityPhoto(trimmed || "girls") }}
                light="dubai"
                scrim="strong"
                style={StyleSheet.absoluteFill}
                width={800}
              />
            )}
            <View style={styles.previewShade} />
            <View style={styles.photoPill}>
              <Icon name="image" size={14} color={girl.ink} />
              <Text variant="caption" color={girl.ink}>
                {photo ? tx("Change photo") : tx("Add your photo")}
              </Text>
            </View>
            <View style={styles.previewText}>
              <Text variant="caption" color="rgba(255,255,255,0.9)">
                {womenOnly ? (moms ? "IRLY Maman" : "IRLY Girl") : "IRLY"} ·{" "}
                {city.name}
              </Text>
              <Text
                variant="titleL"
                color="#FFFFFF"
                raw
                numberOfLines={2}
                style={girlType.card}
              >
                {trimmed || tx("Your community")}
              </Text>
              {tagline.trim() ? (
                <Text
                  variant="bodyS"
                  color="rgba(255,255,255,0.92)"
                  raw
                  numberOfLines={1}
                >
                  {tagline.trim()}
                </Text>
              ) : null}
            </View>
          </PressableScale>

          <View style={styles.form}>
            <Field n="1" label={tx("Name")}>
              <GField
                value={name}
                onChangeText={(v) => {
                  setName(v.slice(0, NAME_MAX));
                  setError(null);
                }}
                invalid={Boolean(error)}
                valid={valid && !missingMoms}
                placeholder={
                  moms
                    ? tx("{city} Mamans", { city: city.name })
                    : tx("Sunrise runners {city}", { city: city.name })
                }
                maxLength={NAME_MAX}
                returnKeyType="next"
                submitBehavior="submit"
                blurOnSubmit={false}
                onSubmitEditing={() => taglineRef.current?.focus()}
                accessibilityLabel={a11y("Community name")}
              />
              <CharCount
                length={name.length}
                min={NAME_MIN}
                max={NAME_MAX}
                color={girl.inkSoft}
              />
              {missingMoms ? (
                <Text variant="caption" color={girl.bordeaux}>
                  {tx(
                    "Add “Maman” to the name so mothers find it in IRLY Maman.",
                  )}
                </Text>
              ) : null}
            </Field>

            <Field n="2" label={tx("In one line")}>
              <GField
                ref={taglineRef}
                value={tagline}
                onChangeText={(v) => setTagline(v.slice(0, 80))}
                placeholder={tx("Easy 5 km, then coffee")}
                maxLength={80}
                returnKeyType="next"
                submitBehavior="submit"
                blurOnSubmit={false}
                onSubmitEditing={() => aboutRef.current?.focus()}
                accessibilityLabel={a11y("Tagline")}
              />
            </Field>

            <Field n="3" label={tx("About")}>
              <GField
                ref={aboutRef}
                value={about}
                onChangeText={(v) => setAbout(v.slice(0, 600))}
                placeholder={tx("Who it's for, how often you meet, the vibe.")}
                multiline
                maxLength={600}
                accessibilityLabel={a11y("Description")}
              />
            </Field>

            <Field n="4" label={tx("Category")}>
              <Wrap>
                {CATEGORIES.map((c) => (
                  <GChip
                    key={c.id}
                    small
                    label={c.label}
                    selected={category === c.id}
                    onPress={() =>
                      setCategory(category === c.id ? undefined : c.id)
                    }
                  />
                ))}
              </Wrap>
            </Field>

            <Field n="5" label={tx("City")}>
              <Wrap>
                {cities.map((c) => (
                  <GChip
                    key={c.id}
                    small
                    icon="pin"
                    label={c.name}
                    selected={cityId === c.id}
                    onPress={() => setCityId(c.id as CityId)}
                  />
                ))}
              </Wrap>
            </Field>

            <Field n="6" label={tx("Who can join")}>
              <View style={{ gap: 8 }}>
                <Choice
                  on={womenOnly}
                  icon="heart"
                  title={tx("Women only")}
                  body={tx(
                    "An IRLY Girl community: only women with IRLY Girl can see it, join it and read its chat.",
                  )}
                  onPress={() => setWomenOnly(true)}
                />
                <Choice
                  on={!womenOnly}
                  icon="globe"
                  title={tx("Everyone on IRLY")}
                  body={tx(
                    "Open to every IRLY member. It will not appear in IRLY Girl.",
                  )}
                  onPress={() => setWomenOnly(false)}
                />
              </View>
            </Field>

            {error ? (
              <Animated.View
                entering={reduced ? undefined : FadeIn}
                style={styles.error}
                accessibilityLiveRegion="polite"
              >
                <GIconWell icon="x" tone="error" size={30} />
                <Text variant="bodyS" color={girl.bordeaux} style={{ flex: 1 }}>
                  {error}
                </Text>
              </Animated.View>
            ) : null}

            <GButton
              label={
                busy === "photo"
                  ? tx("Adding the photo…")
                  : tx("Create the community")
              }
              icon="users"
              loading={busy !== null}
              disabled={!valid}
              onPress={create}
            />
            {!valid ? (
              <Text
                variant="caption"
                color={girl.inkSoft}
                style={{ textAlign: "center" }}
              >
                {tx(
                  "A name of {min} characters or more is all you need to start.",
                  { min: NAME_MIN },
                )}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {photos.sheet}
    </View>
  );
}

function Field({
  n,
  label,
  children,
}: {
  n: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.fieldHead}>
        <Text variant="caption" color={girl.rose} style={styles.num}>
          {n}
        </Text>
        <Text variant="titleS" color={girl.ink} style={girlType.card}>
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Choice({
  on,
  icon,
  title,
  body,
  onPress,
}: {
  on: boolean;
  icon: "heart" | "globe";
  title: string;
  body: string;
  onPress: () => void;
}) {
  const m = useGirlMotion();
  // Chosen: a pane of plum glass with pearl type; the other stays pearl glass.
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={title}
      style={[styles.choice, { boxShadow: on ? girl.shadowPlum : girl.shadowSoft }]}
    >
      <GlassLayer radius={radius.lg} variant={on ? "plum" : "card"} />
      <Icon name={icon} size={18} color={on ? "#F4B3CF" : girl.inkSoft} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleS" color={on ? girl.pearl : girl.ink}>
          {title}
        </Text>
        <Text variant="caption" color={on ? "rgba(255,240,247,0.82)" : girl.inkSoft}>
          {body}
        </Text>
      </View>
      <View
        style={[styles.radio, { borderColor: on ? "#F4B3CF" : girl.inkFaint }]}
      >
        {on ? <Animated.View entering={m.pop(0)} style={styles.radioDot} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: girl.bg },
  center: { alignItems: "center", justifyContent: "center", gap: 18 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.gutter,
    paddingBottom: 6,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  head: { paddingHorizontal: space.gutter, paddingTop: 8, gap: 10 },
  preview: {
    marginHorizontal: space.gutter,
    marginTop: space[5],
    height: 210,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: girl.blush,
    boxShadow: girl.shadow,
  },
  previewShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(56,40,50,0.18)",
  },
  photoPill: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: girl.glass,
  },
  previewText: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    gap: 2,
  },
  form: {
    paddingHorizontal: space.gutter,
    paddingTop: space[6],
    gap: space[6],
  },
  fieldHead: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  num: { fontFamily: font.bold, letterSpacing: 1 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F4B3CF",
  },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(142,31,69,0.22)",
    backgroundColor: "#FBE9EE",
  },
  doneBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
    boxShadow: girl.glow,
  },
});

/** IRLY Girl: the shared components of IRLY, rendered in the Girl flavor (palette, glass, ambient light). */
export default function GirlNewCommunity() {
  return (
    <Flavor value="girl">
      <GirlNewCommunityInner />
    </Flavor>
  );
}
