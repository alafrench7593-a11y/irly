import { useEffect, useMemo, useRef, useState } from 'react';
import { AreaPicker } from '@/components/ui/AreaPicker';
import { Image } from 'expo-image';
import { a11y, t as tx } from '@/i18n';
import { ActivityIndicator, BackHandler, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Animated, { Extrapolation, FadeIn, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useFrame } from '@/components/layout/AppFrame';
import { Button } from '@/components/ui/Button';
import { DateTimePicker, WhenField, whenText } from '@/components/ui/DateTimePicker';
import { Chip, Field } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Ambient } from '@/components/visual/Ambient';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CATALOG_ENTRIES, CATEGORY_BY_ID, DISCOVERY_ORDER, guessCategory, ideaPhoto, photoForText, searchCatalog, type CatalogActivity, type CatalogSub, type CategoryKey } from '@/data/catalog/categories';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { photo, type PhotoKey } from '@/data/photos';
import { Photo } from '@/components/visual/Photo';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { useKeyboardHeight } from '@/motion/keyboard';
import { PressableScale } from '@/motion/PressableScale';
import { ease, motion, scale as scaleTokens, spring } from '@/motion/tokens';
import { useCityId, useStore, type MyPlan } from '@/state/store';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { createServerActivity, updateServerActivity, useGeocoderOn, useMyCommunityOptions, type ActivityPatch } from '@/features/server/activities';
import { formatAmount } from '@/lib/format';
import { useAccount } from '@/features/auth/account';
import { useNow } from '@/lib/useNow';
import { useRouter } from 'expo-router';
import { dropStagedCover, stageCover } from '@/features/server/covers';
import { usePhotoSource } from '@/components/ui/PhotoSourceSheet';
import { useAppSpace } from '@/state/appSpace';
import { lastLibraryPhoto, rememberLibraryPhoto } from './lastPhoto';
import { libraryFor, libraryKindOf, surprise } from './photoLibrary';
import { PhotoLibrarySheet } from './PhotoLibrarySheet';
import { useCreateStore, type CreateFormat, type EditActivity } from './createStore';
import { parsePrice, priceMax, priceText, type PriceProblem } from './price';
import { clockLabel, instants, localPlanDay, problemOf, whenFrom, type When } from './when';

const PRIVACY: { id: NonNullable<MyPlan['privacy']>; label: string }[] = [
  { id: 'public', label: 'Public' },
  { id: 'connections', label: 'Mutual follows' },
  { id: 'community', label: 'Community' },
  { id: 'invite', label: 'Invite only' },
];
const BUTTON = 52;
/** The time at a tap (not during render), as in the date picker. */
const clockNow = () => Date.now();

/** Suggested prices in the destination's currency. */
const PRICES: Record<'AED' | 'IDR', number[]> = {
  AED: [25, 50, 80, 150, 300],
  IDR: [50_000, 100_000, 250_000, 500_000, 1_000_000],
};
export const formatPrice = (n: number, currency: string) => (n ? `${currency} ${formatAmount(n)}` : tx('Free'));

/** An amount as an example in the member's own way of writing numbers: « 37.50 », « 37,50 » in French. */
const priceExample = (currency: string) => (currency === 'IDR' ? '50000' : formatAmount(37.5));

/** Why a typed price is refused, said under the field. */
function priceProblemText(problem: PriceProblem, currency: string): string {
  switch (problem) {
    case 'negative':
      return tx('A price cannot be negative');
    case 'decimals':
      return tx('Two decimals at most, for example {example}', { example: priceExample(currency) });
    case 'whole-only':
      return tx('Whole amounts only in {currency}, for example {example}', { currency, example: priceExample(currency) });
    case 'too-high':
      return tx('The highest price is {max}', { max: `${currency} ${formatAmount(priceMax(currency))}` });
    default:
      return tx('Numbers only, for example {example}', { example: priceExample(currency) });
  }
}

const FORMAT: Record<CreateFormat, { title: string; cta: string }> = {
  activity: { title: 'What do you want to do?', cta: 'Create activity' },
  sport: { title: 'Which sport?', cta: 'Create sport session' },
  event: { title: 'What is the event?', cta: 'Create event' },
  session: { title: 'What do you want to do?', cta: 'Create session' },
  meetup: { title: 'What kind of meetup?', cta: 'Create meetup' },
  trip: { title: 'Where are you going?', cta: 'Create trip' },
};

type Pick = { categoryId: CategoryKey; sub?: CatalogSub; activity?: CatalogActivity; custom?: string };

/**
 * The activity's photo, exactly as it is published: a photo of the IRLY
 * library (picked in the grid, or drawn by « Surprise me »; `auto` when IRLY
 * drew it for the member), her own photo, or none (the app's photo of the
 * category). Shown big before publishing; never swapped behind her back.
 */
type PhotoChoice = { type: 'library'; url: string; kind: string; auto: boolean } | { type: 'own'; uri: string } | { type: 'none' } | /** Editing: the photo it has today, untouched. */ { type: 'kept' };

/** The activity being edited, as the form's pick: its own name, in its category (which stays as it is). */
function editPick(edit: EditActivity): Pick {
  const categoryId = (edit.categoryId in CATEGORY_BY_ID ? edit.categoryId : 'entertainment') as CategoryKey;
  return { categoryId, sub: CATEGORY_BY_ID[categoryId].subs.find((x) => x.id === edit.subId), custom: edit.title };
}

/** The longest description the server keeps (activities.description). */
const DESCRIPTION_MAX = 1000;

/**
 * WHAT DO YOU WANT TO DO? The twelve things people start most, one tap
 * each. A pick with a catalog entry jumps straight to « when », a broad
 * one opens its category, « Other » goes to « name your own ».
 */
const QUICK: { label: string; icon: IconName; entry?: string; category?: CategoryKey }[] = [
  { label: 'Football', icon: 'trophy', entry: 'Football' },
  { label: 'Padel', icon: 'target', entry: 'Padel' },
  { label: 'Dinner', icon: 'utensils', entry: 'Dinner' },
  { label: 'Coffee', icon: 'coffee', entry: 'Coffee' },
  { label: 'Beach', icon: 'palm', entry: 'Beach' },
  { label: 'Gym', icon: 'dumbbell', entry: 'Gym' },
  { label: 'Brunch', icon: 'sunrise', entry: 'Brunch' },
  { label: 'Walk', icon: 'footprints', entry: 'Walk together' },
  { label: 'Party', icon: 'disc', category: 'nightlife' },
  { label: 'Coworking', icon: 'laptop', category: 'networking' },
  { label: 'Travel', icon: 'plane', category: 'travel' },
  { label: 'Other', icon: 'plus' },
];

/** A quick pick shows a photo of the activity itself, never an icon. */
function quickPhoto(q: (typeof QUICK)[number]): PhotoKey {
  return photoForText(q.entry ?? q.label) ?? (q.category ? CATEGORY_BY_ID[q.category].photo : 'girlsOut');
}

/**
 * The server clearly said no (a rule, a check, an ended session): nothing was created.
 * No answer (offline, timeout, aborted, gateway) or a duplicate (an earlier try saved it)
 * is not a refusal: the activity may exist.
 */
function refusedForSure(e: unknown): boolean {
  const m = e instanceof Error ? e.message : '';
  if (!m) return false;
  return !/fetch|network|connection|offline|timed? ?out|timeout|abort|gateway|50[234]|duplicate|23505|server error/i.test(m);
}

function findEntry(label: string) {
  const l = label.toLowerCase();
  return CATALOG_ENTRIES.find((e) => e.label.toLowerCase() === l) ?? searchCatalog(label, 1)[0];
}

/**
 * Create a session, from anything. Step 1: a category (or search the whole
 * catalog, or type your own activity). Step 2: the activity. Step 3: when,
 * where, who can see it. Step 4: how many people. The white Create button
 * grows into the screen on `spring.soft` and becomes the close button.
 */
export function CreateHost() {
  const open = useCreateStore((s) => s.open);
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  if (!mounted) return null;
  return <Composer open={open} onClosed={() => setMounted(false)} />;
}

function Composer({ open, onClosed }: { open: boolean; onClosed: () => void }) {
  const t = useTheme();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const hide = useCreateStore((s) => s.hide);
  const preset = useCreateStore((s) => s.preset);
  const origin = useCreateStore((s) => s.origin) ?? { x: frame.width / 2, y: frame.height - layout.tabBarHeight };
  // Created from a community: the activity takes place in that community's emirate.
  const myCity = useCityId();
  const cityId = preset?.cityId && preset.cityId in CITIES ? (preset.cityId as CityId) : myCity;
  const city = CITIES[cityId];
  const postPlan = useStore((s) => s.postPlan);
  // Editing an activity (its host's « Edit »): the same form from « when and where », filled with it; nothing is created.
  const edit = preset?.edit;
  const firstStep = edit ? 2 : 0;
  const offset = city.utcOffset ?? 4;
  // The price stays in the activity's own currency.
  const currency = edit?.currency ?? city.currency;

  const format: CreateFormat = preset?.format ?? 'session';
  const presetCategory = preset?.categoryId ? CATEGORY_BY_ID[preset.categoryId] : undefined;
  const presetSub = presetCategory?.subs.find((x) => x.id === preset?.subId);
  // From a chat message: its words are the activity's name (a custom one), the member goes on to the date and place.
  const presetTitle = preset?.title?.trim().slice(0, 80);
  const [pick, setPick] = useState<Pick | null>(
    edit
      ? editPick(edit)
      : presetTitle && presetTitle.length >= 3
        ? { categoryId: presetCategory?.id ?? guessCategory(presetTitle), custom: presetTitle }
        : presetCategory
          ? { categoryId: presetCategory.id, sub: presetSub, activity: presetSub?.activities?.find((x) => x.id === preset?.activityId) }
          : null,
  );
  const [step, setStep] = useState(edit ? 2 : presetTitle && presetTitle.length >= 3 ? 2 : presetCategory ? (presetSub ? 2 : 1) : 0);
  const [paid, setPaid] = useState(Boolean(edit?.priceMinor));
  // The price as typed (« 37,50 »): a suggested amount fills it, the member can type any other.
  const suggested: number[] = PRICES[currency as keyof typeof PRICES] ?? [];
  const [priceInput, setPriceInput] = useState(edit?.priceMinor ? priceText(edit.priceMinor) : String(suggested[1] ?? ''));
  const typedPrice = parsePrice(paid ? priceInput : '', currency);
  const price = typedPrice.ok ? typedPrice.amount : 0;
  const priceProblem = typedPrice.ok ? null : typedPrice.problem;
  // Editing: never fewer spots than the people already going.
  const minSpots = Math.max(2, edit?.going ?? 0);
  const maxSpots = edit ? 1000 : 60;
  const [unlimited, setUnlimited] = useState(edit ? edit.capacity == null : false);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  // No date or time is chosen for the member: they pick both (in the city's time) before publishing.
  // From an IRLY event (« Go together »): its date and time, editable.
  // Editing: its date and time read back in the activity's city time, as they were saved.
  const [savedWhen] = useState<When | null>(() => (edit ? whenFrom(edit.startsAt, edit.endsAt, offset) : null));
  const [when, setWhen] = useState<When | null>(savedWhen ?? preset?.when ?? null);
  const [picking, setPicking] = useState(false);
  // Re-read every minute: a time picked earlier that has passed since is shown, never moved.
  const now = useNow();
  // Editing: other changes never move the activity. Only a start that was changed must be in the future
  // (an activity under way keeps its start; its end can still move).
  const startChanged = Boolean(savedWhen && when && (when.day !== savedWhen.day || when.start.h !== savedWhen.start.h || when.start.m !== savedWhen.start.m));
  const endChanged = Boolean(savedWhen && when && (when.end?.h !== savedWhen.end?.h || when.end?.m !== savedWhen.end?.m));
  const whenProblem = !when ? null : !edit ? problemOf(when, offset, now) : startChanged ? problemOf(when, offset, now) : endChanged ? problemOf(when, offset, 0) : null;
  // No neighbourhood is chosen for the member either (it used to be the first one, Deira, silently).
  // From an IRLY event: its neighbourhood (when the city lists it).
  const [area, setArea] = useState<string | null>(edit ? edit.areaId : preset?.areaId && city.areas.some((a) => a.id === preset.areaId) ? preset.areaId : null);
  // Editing: the place as written on the activity (« Kite Beach, court 3 »). Left as the neighbourhood's
  // name (what the form saves when none is given), it follows a change of neighbourhood.
  const [placeEdit, setPlaceEdit] = useState(edit?.placeName ?? '');
  const chooseArea = (next: string) => {
    if (edit && area && placeEdit.trim() === areaName(city, area)) setPlaceEdit(areaName(city, next));
    setArea(next);
  };
  const [privacy, setPrivacy] = useState<NonNullable<MyPlan['privacy']>>(preset?.communityId ? 'community' : 'public');
  // Optional: the community (or group) it belongs to. Not needed to create an activity.
  const [communityId, setCommunityId] = useState<string | null>(preset?.communityId ?? null);
  const myCommunities = useMyCommunityOptions();
  // The community it is proposed in (from « + Propose an activity », or chosen below), named on the form.
  const chosenCommunity = myCommunities.find((x) => x.id === communityId);
  const originName = chosenCommunity ? (chosenCommunity.groupOf ? `${tx(chosenCommunity.name)} · ${tx(chosenCommunity.groupOf)}` : tx(chosenCommunity.name)) : communityId && communityId === preset?.communityId ? (preset.communityName ?? null) : null;
  // Optional: an exact address, so the activity can appear on the map once the server matched it.
  const geocoderOn = useGeocoderOn();
  const [address, setAddress] = useState('');
  const [spots, setSpots] = useState(edit ? (edit.capacity ?? Math.max(6, minSpots)) : 6);
  const [description, setDescription] = useState(() => (edit?.description ?? preset?.description ?? '').slice(0, DESCRIPTION_MAX));
  // The name as published: the activity's own by default, the member may rewrite it.
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const signedIn = Boolean(useAccount());
  // IRLY Girl: the same form, in the Girl look, and the activity is for women only.
  // Editing: the activity's own space, which never changes.
  const appSpace = useAppSpace();
  const girlSpace = edit ? edit.girlOnly : appSpace === 'girl';
  // The photo: an IRLY library photo (drawn at random for the type until the member chooses), her own, or none.
  // From an IRLY event: the event's own photo (an IRLY library photo), until she picks another.
  // Editing: the photo it has today, until she picks another.
  const [photoChoice, setPhotoChoice] = useState<PhotoChoice | null>(() => (edit ? { type: 'kept' } : preset?.cover ? { type: 'library', url: preset.cover, kind: '', auto: false } : null));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [upload, setUpload] = useState<'idle' | 'uploading' | 'failed'>('idle');
  const cover = photoChoice?.type === 'own' ? photoChoice.uri : null;
  // Signed in, the photo is cleaned and uploaded as soon as it is picked, while the
  // form is still being filled: publishing then only saves the row (one round trip).
  // sent: a publish went out with it. unsure: one of those tries ended without a clear answer
  // (network, timeout…), so the activity may exist with this photo: it is kept for good then.
  const staged = useRef<{ uri: string; path: Promise<string>; failed: boolean; sent: boolean; unsure?: boolean } | null>(null);
  const stage = (uri: string) => {
    const cur = staged.current;
    if (cur?.uri === uri && !cur.failed) return cur.path;
    const job = { uri, path: stageCover(uri), failed: false, sent: false };
    setUpload('uploading');
    job.path.then(
      () => staged.current === job && setUpload('idle'),
      () => {
        job.failed = true;
        if (staged.current === job) setUpload('failed');
      },
    );
    staged.current = job;
    return job.path;
  };
  // A staged photo that is not used (replaced, removed, form closed) is removed from the server.
  // Once a publish was sent with it, it is kept: an unanswered try may have saved the activity with it.
  const unstage = () => {
    const cur = staged.current;
    staged.current = null;
    setUpload('idle');
    if (cur && !cur.sent) cur.path.then(dropStagedCover, () => undefined);
  };
  // Closing the form (unmount) drops a photo that was not published.
  useEffect(() => unstage, []);
  const choosePhoto = (next: PhotoChoice) => {
    const uri = next.type === 'own' ? next.uri : null;
    if (staged.current && staged.current.uri !== uri) unstage();
    setPhotoChoice(next);
    if (uri && signedIn) void stage(uri).catch(() => undefined);
  };
  // MY PHOTOS: the shared photo sheet (library or camera), cropped 16:10 like every cover.
  const photos = usePhotoSource({ aspect: [16, 10], title: tx('Activity photo'), subtitle: tx('Everyone who sees the activity sees it.') });
  const pickOwn = async () => {
    try {
      const picked = await photos.pick();
      if (!picked) return;
      // Phone photos are 5–10 MB: 1280 px wide is plenty for a card and a header (as covers.pickPhoto).
      const small = await manipulateAsync(picked.uri, [{ resize: { width: 1280 } }], { compress: 0.75, format: SaveFormat.JPEG });
      choosePhoto({ type: 'own', uri: small.uri });
    } catch {
      toast(tx('Photos are not available. Check the access in Settings.'), 'image', 'live');
    }
  };

  const D = 2 * Math.hypot(Math.max(origin.x, frame.width - origin.x), Math.max(origin.y, frame.height - origin.y));
  const p = useSharedValue(0);

  useEffect(() => {
    if (open) {
      p.set(withSpring(1, spring.soft));
    } else {
      p.set(
        withTiming(0, { duration: motion.slow, easing: ease.exit }, (fin) => {
          if (fin) scheduleOnRN(onClosed);
        }),
      );
    }
  }, [open, p, onClosed]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > firstStep) setStep(step - 1);
      else hide();
      return true;
    });
    return () => sub.remove();
  }, [step, firstStep, hide]);

  const circle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [BUTTON / D, 1], Extrapolation.CLAMP) }],
  }));
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0, 1], [24, 0], Extrapolation.CLAMP) }],
  }));
  const closeBtn = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 45}deg` }] }));

  const results = useMemo(() => searchCatalog(query, 8), [query]);
  const category = pick ? CATEGORY_BY_ID[pick.categoryId] : undefined;
  const title = pick?.custom ?? pick?.activity?.label ?? (pick?.sub ? `${tx('{what} session', { what: tx(pick.sub.label) })}` : undefined);
  // From an IRLY event: its venue, as long as the activity is still the event's (not another one chosen since).
  const place = pick?.activity?.place ?? (preset?.place && pick?.custom && pick.custom === presetTitle ? preset.place : undefined);
  const finalTitle = (titleEdit ?? title ?? '').trim();

  // The IRLY library for this type of activity (padel, brunch, beach…), every photo of it.
  const kind = pick ? libraryKindOf(pick.categoryId, pick.custom ?? pick.activity?.label ?? pick.sub?.label ?? '', place, pick.sub?.label) : null;
  const library = useMemo(() => (kind ? libraryFor(kind, { girl: girlSpace }) : []), [kind, girlSpace]);
  const draw = (avoid: (string | null)[]) => (kind ? surprise(library, [...avoid, lastLibraryPhoto(kind)]) : null);
  // On the last step the activity always shows a photo: one drawn at random from its type
  // (never the one used last time), until the member picks another, her own, or none.
  // The type changed (another activity chosen): IRLY's own draw follows it; her choice stays.
  if (step === 3 && kind && (photoChoice === null || (photoChoice.type === 'library' && photoChoice.auto && photoChoice.kind !== kind))) {
    const url = draw([]);
    if (url) setPhotoChoice({ type: 'library', url, kind, auto: true });
  }
  const surpriseMe = () => {
    if (!kind) return;
    const url = draw([photoChoice?.type === 'library' ? photoChoice.url : null]);
    if (!url) return;
    haptic('select');
    choosePhoto({ type: 'library', url, kind, auto: false });
  };
  const defaultPhoto = pick ? photo(ideaPhoto(pick.categoryId, pick.custom ?? pick.activity?.label ?? '', place, pick.sub?.id), 900, undefined, true) : undefined;
  const previewUri = photoChoice?.type === 'library' ? photoChoice.url : photoChoice?.type === 'own' ? photoChoice.uri : photoChoice?.type === 'kept' ? (edit?.coverUrl ?? defaultPhoto) : defaultPhoto;

  const chooseCategory = (id: CategoryKey) => {
    setPick({ categoryId: id });
    setStep(1);
  };
  const chooseEntry = (categoryId: CategoryKey, sub: CatalogSub, activity?: CatalogActivity) => {
    haptic('select');
    setPick({ categoryId, sub, activity });
    setQuery('');
    setStep(2);
  };
  const scroller = useRef<ScrollView>(null);
  // The address and description fields sit low on the last step: the list
  // makes room for the keyboard (iOS insets itself) and the button rides above it.
  const keyboard = useKeyboardHeight();
  const chooseQuick = (q: (typeof QUICK)[number]) => {
    haptic('select');
    if (q.entry) {
      const e = findEntry(q.entry);
      if (e) {
        chooseEntry(e.categoryId, e.sub, e.activity);
        return;
      }
    }
    if (q.category) {
      chooseCategory(q.category);
      return;
    }
    scroller.current?.scrollToEnd({ animated: true });
  };
  const chooseCustom = (text: string) => {
    const label = text.trim();
    if (label.length < 3) return;
    haptic('select');
    // IRLY guesses the category; the member can change it on the next step.
    setPick({ categoryId: pick?.categoryId ?? guessCategory(label), custom: label });
    setCustom('');
    setQuery('');
    setStep(2);
  };

  const [publishing, setPublishing] = useState(false);
  // One tap, one activity: a second tap before the button shows « Publishing… » is ignored.
  const sending = useRef(false);
  const router = useRouter();
  // Editing: only what changed is sent (public.update_activity). The server holds the rules: its host only,
  // not once it is over or cancelled, never fewer spots than the people going; a new time or place tells them.
  const saveEdit = async () => {
    if (!edit || publishing || sending.current) return;
    if (finalTitle.length < 3) {
      toast(tx('Give the activity a name (3 characters or more)'), 'edit', 'brand');
      return;
    }
    // Checked again at the tap, as when creating: a new start picked earlier may have passed since.
    const problem = whenProblem ?? (when && startChanged ? problemOf(when, offset, clockNow()) : null);
    if (!when || problem) {
      toast(tx(!when ? 'Pick a date and a start time' : problem === 'past' ? 'This time has passed: pick a later one' : 'The end must be after the start'), 'calendar', 'brand');
      setStep(2);
      return;
    }
    if (!area) {
      toast(tx('Choose a neighbourhood'), 'pin', 'brand');
      setStep(2);
      return;
    }
    if (priceProblem) {
      toast(priceProblemText(priceProblem, currency), 'banknote', 'brand');
      return;
    }
    if (!unlimited && spots < minSpots) {
      toast(tx('Spots: between {min} and 1000, or empty for unlimited', { min: minSpots }), 'users', 'brand');
      return;
    }
    const patch: ActivityPatch = {};
    if (finalTitle !== edit.title) patch.title = finalTitle;
    const about = description.trim() || null;
    if (about !== (edit.description?.trim() || null)) patch.description = about;
    const placeName = placeEdit.trim() || null;
    if (placeName !== (edit.placeName ?? null)) patch.placeName = placeName;
    if (area !== edit.areaId) patch.areaId = area;
    if (startChanged || endChanged) {
      const moved = instants(when, offset);
      if (startChanged) patch.startsAt = moved.startsAt;
      patch.endsAt = moved.endsAt;
    }
    const capacity = unlimited ? null : spots;
    if (capacity !== edit.capacity) patch.capacity = capacity;
    const minor = typedPrice.ok ? typedPrice.minor : 0;
    if (minor !== edit.priceMinor) patch.priceMinor = minor;
    const libraryCover = photoChoice?.type === 'library' ? photoChoice.url : null;
    if (libraryCover) patch.libraryCover = libraryCover;
    else if (photoChoice?.type === 'none' && edit.coverUrl) patch.libraryCover = null;
    // Nothing changed: nothing is sent, nobody is told.
    if (!Object.keys(patch).length && !cover) {
      hide();
      return;
    }
    sending.current = true;
    setPublishing(true);
    try {
      // Her own photo: usually uploaded already (as when creating); claimed before waiting.
      const pending = cover ? stage(cover) : null;
      if (cover && staged.current?.uri === cover) staged.current.sent = true;
      if (pending) patch.coverPath = await pending;
      await updateServerActivity(edit.id, patch);
      // The photo now belongs to the activity: closing the form must not remove it.
      if (staged.current?.uri === cover) staged.current = null;
      if (libraryCover && kind) rememberLibraryPhoto(kind, libraryCover);
      haptic('success');
      toast('Saved. Everyone sees the new version', 'check', 'brand');
      hide();
    } catch (e) {
      // As when creating: a clear refusal frees the staged photo, an unanswered try may have saved it.
      if (cover && staged.current?.uri === cover) {
        if (refusedForSure(e) && !staged.current.unsure) staged.current.sent = false;
        else staged.current.unsure = true;
      }
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
    } finally {
      sending.current = false;
      setPublishing(false);
    }
  };

  const post = async () => {
    if (!pick || !title || publishing || sending.current) return;
    if (finalTitle.length < 3) {
      toast(tx('Give the activity a name (3 characters or more)'), 'edit', 'brand');
      return;
    }
    // A typed price that cannot be read is never published as free.
    if (priceProblem) {
      toast(priceProblemText(priceProblem, currency), 'banknote', 'brand');
      return;
    }
    // Checked again at the tap: a time picked earlier may have passed while the form stayed open.
    const problem = when ? problemOf(when, offset, clockNow()) : null;
    if (!when || problem) {
      toast(tx(!when ? 'Pick a date and a start time' : problem === 'past' ? 'This time has passed: pick a later one' : 'The end must be after the start'), 'calendar', 'brand');
      setStep(2);
      return;
    }
    if (!area) {
      toast(tx('Choose a neighbourhood'), 'pin', 'brand');
      setStep(2);
      return;
    }
    const { startsAt, endsAt } = instants(when, offset);
    // Kept on this phone (signed out): the plan stores words ("Tomorrow", "Friday"), at most a week ahead.
    const day = localPlanDay(when, clockNow(), offset);
    if (!signedIn && !day) {
      toast(tx('Sign in to plan more than a week ahead'), 'calendar', 'brand');
      return;
    }
    // "Community" visibility needs a community, otherwise nobody else could see it.
    if (privacy === 'community' && !communityId) {
      toast(tx('Choose the community it is for, or another visibility'), 'users', 'brand');
      return;
    }
    const plan = {
      cityId,
      categoryId: pick.categoryId,
      subId: pick.sub?.id,
      activityId: pick.activity?.id,
      title: finalTitle,
      place: place ?? areaName(city, area),
      note: pick.activity?.note,
      description: description.trim() || undefined,
      privacy,
      day: day ?? 'Today',
      time: clockLabel(when.start),
      spots: unlimited ? 0 : spots,
      areaId: area,
      format,
      price,
      currency: city.currency,
    };
    // The photo exactly as previewed: the library photo chosen, her own photo, or none.
    // `null`: no photo on purpose (or her own): the server never draws one in its place.
    const libraryCover = photoChoice?.type === 'library' ? photoChoice.url : null;
    // Signed out: the plan lives on this phone only, and says so.
    if (!signedIn) {
      const shown = cover ?? libraryCover;
      postPlan({ ...plan, ...(shown ? { coverUri: shown } : {}) });
      if (libraryCover && kind) rememberLibraryPhoto(kind, libraryCover);
      haptic('success');
      toast(tx('{title} saved on this phone. Sign in to share it', { title: finalTitle }), 'send', 'brand');
      hide();
      return;
    }
    // Signed in: the server is the only copy. "Live" only once it really is;
    // a failure keeps the form so the same plan can be sent again (never twice).
    sending.current = true;
    setPublishing(true);
    try {
      const chosen = myCommunities.find((x) => x.id === communityId);
      // Usually uploaded already; still on its way, it is awaited; a failed upload is tried again here.
      // Claimed before waiting: closing the form or removing the photo meanwhile must not delete it.
      const pending = cover ? stage(cover) : null;
      if (cover && staged.current?.uri === cover) staged.current.sent = true;
      const coverPath = pending ? await pending : null;
      const serverId = await createServerActivity(plan, startsAt, {
        endsAt,
        coverUri: cover,
        coverPath,
        libraryCover,
        communityId,
        // IRLY Girl: the activity is for women only (the server checks the member may create one).
        girlOnly: girlSpace || chosen?.girlOnly || (communityId === preset?.communityId && preset?.girlOnly) || undefined,
        ...(girlSpace ? { audience: 'girls' as const } : {}),
        address: geocoderOn ? address : null,
        // Made from an IRLY event: the event page lists it, its page links back to the event.
        eventKey: preset?.eventKey ?? null,
        // Made from a post: the post's card lists it (public.post_activities).
        sourcePostId: preset?.sourcePostId ?? null,
      });
      // No id: nothing was created (session ended). Never "live" then; the form stays.
      if (!serverId) throw new Error(tx('your session has ended, sign in again'));
      // The photo now belongs to the activity: closing the form must not remove it.
      if (staged.current?.uri === cover) staged.current = null;
      // « Surprise me » next time starts from another photo of this type.
      if (libraryCover && kind) rememberLibraryPhoto(kind, libraryCover);
      haptic('success');
      toast(tx('{title} is live. Chat created', { title: finalTitle }), 'send', 'brand');
      hide();
      router.push(`/a/${serverId}`);
    } catch (e) {
      // Refused for sure (a rule, a check, the session): nothing was created, so the staged photo
      // is unused again and goes when the form closes or the photo changes. An unanswered try
      // (network, timeout, unknown) may have saved the activity with it: it stays then.
      if (cover && staged.current?.uri === cover) {
        if (refusedForSure(e) && !staged.current.unsure) staged.current.sent = false;
        else staged.current.unsure = true;
      }
      toast(tx('Not published: {why}. Try again', { why: e instanceof Error ? e.message : 'server error' }), 'x', 'live');
    } finally {
      sending.current = false;
      setPublishing(false);
    }
  };

  const canNext = step === 0 ? false : step === 1 ? Boolean(pick?.sub || pick?.custom) : step === 2 ? Boolean(when && !whenProblem && area) : true;

  return (
    // Clipped: the reveal circle is wider than the screen (on the web it made the page scroll sideways).
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View
        style={[
          styles.circle,
          { width: D, height: D, borderRadius: D / 2, left: origin.x - D / 2, top: origin.y - D / 2, backgroundColor: t.c.bg },
          circle,
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + space[6] }, content]}>
        <Ambient variant="hero" />
        <View style={styles.head}>
          {step > firstStep ? (
            <PressableScale haptic="select" scaleTo={0.9} onPress={() => setStep(step - 1)} accessibilityLabel="Previous step" style={styles.back} hitSlop={8}>
              <Icon name="chevronLeft" size={22} color={t.c.text} />
            </PressableScale>
          ) : null}
          <Text variant="overline" tone="secondary">
            {tx('Step {n} / {total}', { n: step + 1 - firstStep, total: 4 - firstStep })}{category ? ` · ${tx(category.label)}` : ''}
          </Text>
        </View>
        {edit ? (
          // Editing: said on both steps, with the activity's name as it is today.
          <View style={styles.origin} accessibilityLabel={tx('Editing {name}', { name: edit.title })}>
            <GlassLayer radius={radius.pill} level="thin" />
            <Icon name="edit" size={14} color={t.c.text} />
            <Text variant="caption" raw numberOfLines={1} style={{ flexShrink: 1 }}>
              {tx('Editing {name}', { name: edit.title })}
            </Text>
          </View>
        ) : null}
        {preset?.eventKey && preset.eventTitle ? (
          // Made from an IRLY event: the event it is for, on every step.
          <View style={styles.origin} accessibilityLabel={tx('For the event {name}', { name: preset.eventTitle })}>
            <GlassLayer radius={radius.pill} level="thin" />
            <Icon name="ticket" size={14} color={t.c.text} />
            <Text variant="caption" raw numberOfLines={1} style={{ flexShrink: 1 }}>
              {tx('For the event {name}', { name: tx(preset.eventTitle) })}
            </Text>
          </View>
        ) : null}
        {preset?.sourcePostId ? (
          // Made from a post: said on every step (the post's card will list it).
          <View style={styles.origin} accessibilityLabel={tx('From a post')}>
            <GlassLayer radius={radius.pill} level="thin" />
            <Icon name="message" size={14} color={t.c.text} />
            <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
              From a post
            </Text>
          </View>
        ) : null}
        {originName ? (
          // Proposed from a community (or attached to one): where it will be shown, on every step.
          <View style={styles.origin} accessibilityLabel={tx('Proposed in {name}', { name: originName })}>
            <GlassLayer radius={radius.pill} level="thin" />
            <Icon name="users" size={14} color={t.c.text} />
            <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
              {tx('Proposed in {name}', { name: originName })}
            </Text>
          </View>
        ) : null}

        <ScrollView
          ref={scroller}
          contentContainerStyle={{ paddingBottom: 220 + (Platform.OS === 'android' ? keyboard : 0) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {step === 0 ? (
            <View key="s0">
              <Animated.View entering={enter.rise(0, 120)}>
                <Text variant="displayL" style={styles.title}>
                  {FORMAT[format].title}
                </Text>
              </Animated.View>
              <Animated.View entering={enter.rise(1, 120)} style={styles.block}>
                <Field icon="search" placeholder={tx('Padel, brunch, mosque visit, AI founders…')} value={query} onChangeText={setQuery} returnKeyType="search" />
              </Animated.View>
              {query.trim().length >= 2 ? (
                <Animated.View entering={FadeIn.duration(motion.fast)} style={[styles.block, { gap: 6 }]}>
                  {results.map((r) => {
                    const c = CATEGORY_BY_ID[r.categoryId];
                    return (
                      <PressableScale key={`${r.categoryId}-${r.sub.id}-${r.activity?.id ?? ''}`} haptic={false} scaleTo={0.98} onPress={() => chooseEntry(r.categoryId, r.sub, r.activity)} style={styles.result}>
                        <GlassLayer radius={radius.lg} level="thin" />
                        <View style={[styles.dot, { backgroundColor: c.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text variant="label">{r.label}</Text>
                          <Text variant="caption" tone="tertiary">
                            {c.label}
                            {r.activity ? ` · ${r.sub.label}` : ''}
                            {r.activity?.place ? ` · ${r.activity.place}` : ''}
                          </Text>
                        </View>
                        <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
                      </PressableScale>
                    );
                  })}
                  <CustomButton text={query} onPress={() => chooseCustom(query)} />
                </Animated.View>
              ) : (
                <>
                  <View style={styles.quick}>
                    {QUICK.map((q, i) => (
                      <Animated.View key={q.label} entering={enter.pop(Math.min(i, 11), 140)} style={styles.quickCell}>
                        <PressableScale
                          haptic={false}
                          scaleTo={0.92}
                          onPress={() => chooseQuick(q)}
                          accessibilityLabel={q.label}
                          style={styles.quickTile}
                        >
                          <Photo pinned visual={{ photo: quickPhoto(q) }} light={city.light} scrim="strong" style={StyleSheet.absoluteFill} width={240} />
                          <Text variant="label" color="#FFFFFF" numberOfLines={1} style={styles.tileLabel}>
                            {q.label}
                          </Text>
                        </PressableScale>
                      </Animated.View>
                    ))}
                  </View>
                  <Text variant="overline" tone="tertiary" style={styles.or}>
                    Or browse everything
                  </Text>
                  <View style={styles.grid}>
                    {DISCOVERY_ORDER.map((k) => CATEGORY_BY_ID[k]).map((c, i) => (
                      <Animated.View key={c.id} entering={enter.pop(Math.min(i, 8), 160)} style={styles.cell}>
                        <PressableScale
                          haptic="select"
                          scaleTo={scaleTokens.press}
                          onPress={() => chooseCategory(c.id)}
                          accessibilityLabel={c.label}
                          style={[styles.tile, { boxShadow: t.shadow.card }]}
                        >
                          <Photo pinned visual={{ photo: photoForText(c.label) ?? c.photo }} light={city.light} scrim="strong" style={StyleSheet.absoluteFill} width={480} />
                          <Text variant="titleS" color="#FFFFFF" style={styles.tileLabel}>
                            {c.label}
                          </Text>
                        </PressableScale>
                      </Animated.View>
                    ))}
                  </View>
                  <View style={styles.block}>
                    <Text variant="titleS">Can&apos;t find what you&apos;re looking for?</Text>
                    <Field placeholder={tx('Sunset photography at Palm Jumeirah')} value={custom} onChangeText={setCustom} onSubmitEditing={() => chooseCustom(custom)} returnKeyType="next" />
                    {custom.trim().length >= 3 ? <CustomButton text={custom} onPress={() => chooseCustom(custom)} /> : null}
                  </View>
                </>
              )}
            </View>
          ) : null}

          {step === 1 && category ? (
            <View key={`s1-${category.id}`}>
              <Animated.View entering={enter.rise(0)}>
                <Text variant="displayL" style={styles.title}>
                  {category.label}
                </Text>
              </Animated.View>
              <Animated.View entering={enter.rise(1)} style={styles.block}>
                <View style={styles.wrap}>
                  {category.subs.map((sub) => (
                    <Chip
                      key={sub.id}
                      size="sm"
                      label={sub.label}
                      dot={category.color}
                      selected={pick?.sub?.id === sub.id && !pick.custom}
                      onPress={() => (sub.activities?.length ? setPick({ categoryId: category.id, sub }) : chooseEntry(category.id, sub))}
                    />
                  ))}
                </View>
              </Animated.View>
              {pick?.sub?.activities?.length ? (
                <Animated.View key={pick.sub.id} entering={FadeIn.duration(motion.normal)} style={[styles.block, { gap: 6 }]}>
                  <Text variant="overline" tone="secondary">
                    {pick.sub.label}
                  </Text>
                  <PressableScale haptic={false} scaleTo={0.98} onPress={() => chooseEntry(category.id, pick.sub!)} style={styles.result}>
                        <GlassLayer radius={radius.lg} level="thin" />
                    <View style={[styles.dot, { backgroundColor: category.color }]} />
                    <Text variant="label" style={{ flex: 1 }}>
                      {tx('{what} session', { what: tx(pick.sub.label) })}
                    </Text>
                    <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
                  </PressableScale>
                  {pick.sub.activities.map((act) => (
                    <PressableScale key={act.id} haptic={false} scaleTo={0.98} onPress={() => chooseEntry(category.id, pick.sub!, act)} style={styles.result}>
                        <GlassLayer radius={radius.lg} level="thin" />
                      <View style={[styles.dot, { backgroundColor: category.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text variant="label">{act.label}</Text>
                        {act.place ? (
                          <Text variant="caption" tone="tertiary">
                            {act.place}
                          </Text>
                        ) : null}
                      </View>
                      <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
                    </PressableScale>
                  ))}
                </Animated.View>
              ) : null}
              <View style={styles.block}>
                <Text variant="titleS">{tx('Something else in {category}?', { category: tx(category.label).toLowerCase() })}</Text>
                <Field placeholder={tx('Name your activity')} value={custom} onChangeText={setCustom} onSubmitEditing={() => chooseCustom(custom)} />
                {custom.trim().length >= 3 ? <CustomButton text={custom} onPress={() => chooseCustom(custom)} /> : null}
              </View>
            </View>
          ) : null}

          {step === 2 && category ? (
            <View key="s2" style={{ gap: space[6] }}>
              <Animated.View entering={enter.rise(0)}>
                <Text variant="displayL" style={styles.title}>
                  When and where?
                </Text>
              </Animated.View>
              {pick?.custom && !edit ? (
                <Animated.View entering={enter.rise(1)} style={styles.block}>
                  <Text variant="overline" tone="secondary">
                    Category · suggested by IRLY, change it if needed
                  </Text>
                  <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {DISCOVERY_ORDER.map((k) => CATEGORY_BY_ID[k]).map((c) => (
                      <Chip key={c.id} size="sm" label={c.label} dot={c.color} selected={pick.categoryId === c.id} onPress={() => setPick({ ...pick, categoryId: c.id })} />
                    ))}
                  </ScrollView>
                </Animated.View>
              ) : null}
              <Animated.View entering={enter.rise(2)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  When
                </Text>
                <WhenField value={when} utcOffset={offset} onPress={() => setPicking(true)} invalid={Boolean(whenProblem)} />
                {whenProblem ? (
                  <Text variant="caption" tone="critical">
                    {whenProblem === 'past' ? tx('This time has already passed in {city}. Pick a later time.', { city: city.name }) : 'The end must be after the start.'}
                  </Text>
                ) : !when ? (
                  <Text variant="caption" tone="secondary">
                    {tx('Pick a date and a start time ({city} time)', { city: city.name })}
                  </Text>
                ) : edit && edit.going > 1 && (startChanged || endChanged) ? (
                  <Text variant="caption" tone="secondary">
                    The people going will be told about the new time.
                  </Text>
                ) : null}
                <DateTimePicker visible={picking} onClose={() => setPicking(false)} value={when} onConfirm={setWhen} utcOffset={offset} cityName={city.name} />
              </Animated.View>
              <Animated.View entering={enter.rise(3)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  {place ? tx('Meeting point near {place}', { place }) : 'Where'}
                </Text>
                <AreaPicker cityId={city.id} value={area} onChange={chooseArea} />
                {edit ? <Field value={placeEdit} onChangeText={(v) => setPlaceEdit(v.slice(0, 120))} placeholder="Place (e.g. Kite Beach, court 3)" accessibilityLabel="Place" icon="pin" maxLength={120} /> : null}
              </Animated.View>
              {/* Editing: who can see it and its community stay as they were when people joined. */}
              {edit ? null : (
                <Animated.View entering={enter.rise(4)} style={styles.block}>
                  <Text variant="overline" tone="secondary">
                    Who can see it
                  </Text>
                  <View style={styles.wrap}>
                    {PRIVACY.map((x) => (
                      <Chip key={x.id} size="sm" label={x.label} selected={privacy === x.id} onPress={() => setPrivacy(x.id)} />
                    ))}
                  </View>
                </Animated.View>
              )}
              {/* Made from a community's post: it stays in that community (the server checks it too), named above. */}
              {!edit && signedIn && myCommunities.length && !(preset?.sourcePostId && preset.communityId) ? (
                <Animated.View entering={enter.rise(5)} style={styles.block}>
                  <Text variant="overline" tone="secondary">
                    In a community (optional)
                  </Text>
                  <View style={styles.wrap}>
                    <Chip size="sm" label={tx('None')} selected={!communityId} onPress={() => (setCommunityId(null), privacy === 'community' && setPrivacy('public'))} />
                    {myCommunities.map((x) => (
                      <Chip key={x.id} size="sm" label={x.groupOf ? `${tx(x.name)} · ${tx(x.groupOf)}` : tx(x.name)} selected={communityId === x.id} onPress={() => setCommunityId(x.id)} />
                    ))}
                  </View>
                </Animated.View>
              ) : null}
              {geocoderOn && !edit ? (
                <Animated.View entering={enter.rise(6)} style={styles.block}>
                  <Text variant="overline" tone="secondary">
                    Exact address (optional)
                  </Text>
                  <View style={styles.fieldHost}>
                  <GlassLayer radius={radius.lg} level="thin" />
                  <TextInput
                    value={address}
                    onChangeText={(v) => setAddress(v.slice(0, 200))}
                    placeholder={tx('Building, street, place: to appear on the map')}
                    placeholderTextColor={t.c.textTertiary}
                    style={[styles.address, { color: t.c.text }]}
                    accessibilityLabel={a11y('Exact address')}
                  />
                  </View>
                </Animated.View>
              ) : null}
            </View>
          ) : null}

          {step === 3 && category && title ? (
            <View key="s3" style={{ gap: space[6] }}>
              <Animated.View entering={enter.rise(0)}>
                <Text variant="displayL" style={styles.title}>
                  How many people?
                </Text>
              </Animated.View>
              <Animated.View entering={enter.rise(1)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  Name
                </Text>
                <Field
                  value={titleEdit ?? title}
                  onChangeText={(v) => setTitleEdit(v.slice(0, 80))}
                  placeholder={tx('Name your activity')}
                  maxLength={80}
                  accessibilityLabel={a11y('Name of the activity')}
                  invalid={finalTitle.length < 3}
                />
                {girlSpace ? (
                  <Text variant="caption" tone="secondary">
                    {tx('IRLY Girl: only women members can see and join it.')}
                  </Text>
                ) : null}
              </Animated.View>
              <Animated.View entering={enter.rise(1)} style={[styles.block, styles.wrap, { justifyContent: 'center' }]}>
                {[2, 4, 10, 50].filter((n) => n >= minSpots).map((n) => (
                  <Chip key={n} size="sm" label={`${n}`} selected={!unlimited && spots === n} onPress={() => { setUnlimited(false); setSpots(n); }} />
                ))}
                <Chip size="sm" label="Unlimited" selected={unlimited} onPress={() => setUnlimited(true)} />
              </Animated.View>
              <Animated.View entering={enter.rise(1)} style={[styles.block, styles.stepperRow, unlimited ? { opacity: 0.35 } : null]} pointerEvents={unlimited ? 'none' : 'auto'}>
                <PressableScale haptic="select" scaleTo={0.85} repeat onPress={() => setSpots((n) => Math.max(minSpots, n - 1))} style={styles.stepBtn} accessibilityLabel="Fewer spots">
                  <GlassLayer radius={28} level="thin" />
                  <Icon name="minus" size={22} color={t.c.text} />
                </PressableScale>
                <Text variant="displayXL" style={{ minWidth: 90 }} align="center">
                  {spots}
                </Text>
                <PressableScale haptic="select" scaleTo={0.85} repeat onPress={() => setSpots((n) => Math.min(maxSpots, n + 1))} style={styles.stepBtn} accessibilityLabel="More spots">
                  <GlassLayer radius={28} level="thin" />
                  <Icon name="plus" size={22} color={t.c.text} />
                </PressableScale>
              </Animated.View>
              {edit && edit.going > 1 ? (
                // Editing: why the spots stop there (the server refuses fewer, too).
                <Text variant="caption" tone="secondary" align="center" raw style={styles.spotsNote}>
                  {tx('{n} going: no fewer than {n} spots', { n: edit.going })}
                </Text>
              ) : null}
              <Animated.View entering={enter.rise(2)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  Price
                </Text>
                <View style={styles.wrap}>
                  <Chip size="sm" label="Free" selected={!paid} onPress={() => setPaid(false)} />
                  <Chip size="sm" label="Paid" icon="banknote" selected={paid} onPress={() => setPaid(true)} />
                </View>
                {paid ? (
                  <Animated.View entering={FadeIn.duration(motion.fast)} style={{ gap: 10 }}>
                    <View style={styles.wrap}>
                      {suggested.map((n) => (
                        <Chip key={n} size="sm" label={formatPrice(n, currency)} selected={typedPrice.ok && price === n} onPress={() => setPriceInput(String(n))} />
                      ))}
                    </View>
                    {/* Any amount, typed by hand: what is typed stays as typed (never rewritten under the finger), and is checked below. */}
                    <Field
                      value={priceInput}
                      onChangeText={setPriceInput}
                      placeholder={tx('Another amount in {currency}', { currency })}
                      accessibilityLabel="Price"
                      icon="banknote"
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      returnKeyType="done"
                      autoCorrect={false}
                      maxLength={14}
                      invalid={Boolean(priceProblem)}
                      testID="create-price"
                      trailing={
                        <Text variant="label" tone="secondary" raw>
                          {currency}
                        </Text>
                      }
                    />
                    {priceProblem ? (
                      <Text variant="caption" tone="critical" raw>
                        {priceProblemText(priceProblem, currency)}
                      </Text>
                    ) : (
                      <Text variant="caption" tone="secondary" raw>
                        {price ? tx('Each person pays {price}', { price: formatPrice(price, currency) }) : tx('Empty or 0: the activity is free')}
                      </Text>
                    )}
                  </Animated.View>
                ) : null}
              </Animated.View>
              <Animated.View entering={enter.rise(2)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  Photo
                </Text>
                {/* The final render: the photo as it will be published, with the activity's name on it. */}
                <View style={styles.cover} accessibilityLabel={tx('Photo of the activity')} testID="create-cover">
                  {previewUri ? <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                  <View style={styles.coverScrim} pointerEvents="none" />
                  <View style={styles.coverText} pointerEvents="none">
                    <Text variant="overline" color="#FFFFFF">
                      {[tx(category.label), girlSpace ? 'IRLY Girl' : null].filter(Boolean).join(' · ')}
                    </Text>
                    <Text variant="titleL" color="#FFFFFF" numberOfLines={2}>
                      {finalTitle || title}
                    </Text>
                  </View>
                  <View style={[styles.coverPill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                    {upload === 'uploading' && cover ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name={photoChoice?.type === 'own' ? 'camera' : 'image'} size={14} color="#FFFFFF" />}
                    <Text variant="caption" style={{ color: '#FFFFFF' }}>
                      {photoChoice?.type === 'own'
                        ? upload === 'uploading'
                          ? tx('Your photo · uploading…')
                          : upload === 'failed'
                            ? tx('Your photo · sent again when you publish')
                            : tx('Your photo')
                        : photoChoice?.type === 'library'
                          ? tx('IRLY library')
                          : photoChoice?.type === 'kept' && edit?.coverUrl
                            ? tx('Current photo')
                            : tx('IRLY photo of the category')}
                    </Text>
                  </View>
                  {photoChoice && photoChoice.type !== 'none' && !(photoChoice.type === 'kept' && !edit?.coverUrl) ? (
                    <PressableScale haptic="select" disabled={publishing} onPress={() => choosePhoto({ type: 'none' })} style={[styles.coverRemove, { backgroundColor: 'rgba(0,0,0,0.55)' }]} accessibilityLabel={tx('Remove the photo')} hitSlop={8}>
                      <Icon name="x" size={16} color="#FFFFFF" strokeWidth={2.6} />
                    </PressableScale>
                  ) : null}
                </View>
                <View style={styles.photoRow}>
                  <PhotoOption icon="image" label={tx('IRLY library')} hint={tx('{n} photos', { n: library.length })} disabled={publishing || !library.length} onPress={() => setLibraryOpen(true)} />
                  <PhotoOption icon="camera" label={tx('My photos')} hint={tx('From your phone')} disabled={publishing} onPress={pickOwn} />
                  <PhotoOption icon="sparkles" label={tx('Surprise me')} hint={tx('At random')} disabled={publishing || library.length < 2} onPress={surpriseMe} />
                </View>
                <PhotoLibrarySheet
                  visible={libraryOpen}
                  onClose={() => setLibraryOpen(false)}
                  urls={library}
                  selected={photoChoice?.type === 'library' ? photoChoice.url : null}
                  title={finalTitle || title}
                  onPick={(url) => {
                    if (kind) choosePhoto({ type: 'library', url, kind, auto: false });
                    setLibraryOpen(false);
                  }}
                />
                {photos.sheet}
              </Animated.View>
              <Animated.View entering={enter.rise(2)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  Description
                </Text>
                <View style={styles.fieldHost}>
                <GlassLayer radius={radius.lg} level="thin" />
                <TextInput
                  value={description}
                  onChangeText={(v) => setDescription(v.slice(0, DESCRIPTION_MAX))}
                  placeholder={tx('What you will do, the level, what to bring, where to meet…')}
                  placeholderTextColor={t.c.textTertiary}
                  multiline
                  maxLength={DESCRIPTION_MAX}
                  style={[styles.desc, { color: t.c.text }]}
                  accessibilityLabel={a11y('Description')}
                />
                </View>
                {description.length > DESCRIPTION_MAX - 200 ? (
                  <Text variant="caption" tone="tertiary" align="right">
                    {description.length} / {DESCRIPTION_MAX}
                  </Text>
                ) : null}
              </Animated.View>
              <Animated.View entering={enter.rise(3)} style={[styles.summary, { boxShadow: t.shadow.card }]}>
                <GlassLayer radius={radius.xl} />
                <View style={[styles.dot, { backgroundColor: category.color, width: 12, height: 12, borderRadius: 6 }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="cardTitle" style={{ fontSize: 20, lineHeight: 24 }}>
                    {finalTitle || title}
                  </Text>
                  <Text variant="bodyS" tone="secondary">
                    {when ? whenText(when, offset, now) : tx('Time to pick')} · {(edit ? placeEdit.trim() || undefined : place) ?? (area ? areaName(city, area) : tx('Neighbourhood to pick'))} · {unlimited ? tx('Unlimited') : tx('{n} spots', { n: spots })} · {formatPrice(price, currency)}
                    {edit ? null : ` · ${tx(PRIVACY.find((x) => x.id === privacy)?.label ?? '')}`}
                  </Text>
                </View>
              </Animated.View>
              {pick?.activity?.note ? (
                <Animated.View entering={enter.rise(4)} style={styles.note}>
                  <GlassLayer radius={radius.lg} level="thin" />
                  <Icon name="sparkles" size={16} color={t.c.text} />
                  <Text variant="bodyS" style={{ flex: 1 }}>
                    {pick.activity.note}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {step > 0 ? (
          <View style={[styles.footer, { bottom: keyboard ? keyboard + space[3] : layout.tabBarHeight + Math.max(insets.bottom, layout.tabBarBottomGap) + 24 }]}>
            {step < 3 ? (
              <Button label="Next" iconRight="arrowRight" full disabled={!canNext} haptic="select" onPress={() => setStep(step + 1)} />
            ) : (
              <Button label={edit ? (publishing ? 'Saving…' : 'Save changes') : publishing ? 'Publishing…' : FORMAT[format].cta} icon={edit ? 'check' : 'send'} full haptic={false} loading={publishing} disabled={publishing} onPress={edit ? saveEdit : post} />
            )}
          </View>
        ) : null}
      </Animated.View>

      <View style={[styles.closeWrap, { left: origin.x - BUTTON / 2, top: origin.y - BUTTON / 2 }]}>
        <PressableScale haptic="tap" scaleTo={0.9} disabled={publishing} onPress={hide} accessibilityLabel="Close composer" style={[styles.close, { backgroundColor: t.c.brand }]}>
          <Animated.View style={closeBtn}>
            <Icon name="plus" size={24} color={t.c.onBrand} strokeWidth={2.4} />
          </Animated.View>
        </PressableScale>
      </View>
    </View>
  );
}

/** One way to get the activity's photo: the IRLY library, the member's photos, or a surprise. */
function PhotoOption({ icon, label, hint, disabled, onPress }: { icon: IconName; label: string; hint: string; disabled?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.95} disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}. ${hint}`} style={[styles.photoOption, disabled ? { opacity: 0.45 } : null]}>
      <GlassLayer radius={radius.lg} level="thin" />
      <Icon name={icon} size={20} color={t.c.text} />
      <Text variant="label" numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
      <Text variant="caption" tone="tertiary" numberOfLines={1}>
        {hint}
      </Text>
    </PressableScale>
  );
}

function CustomButton({ text, onPress }: { text: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} style={[styles.custom, { borderColor: t.c.lineStrong }]} accessibilityLabel={tx('Create custom activity: {name}', { name: text })}>
      <Icon name="wand" size={18} color={t.c.text} />
      <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
        {tx('Create “{what}”', { what: text.trim() })}
      </Text>
      <Icon name="arrowRight" size={16} color={t.c.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fieldHost: { borderRadius: radius.lg, overflow: 'hidden' },
  address: { height: 48, paddingHorizontal: 14, fontFamily: font.medium, fontSize: 16 },
  cover: { height: 200, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: 'rgba(127,127,127,0.18)' },
  coverScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)' },
  coverText: { position: 'absolute', left: 14, right: 14, bottom: 52, gap: 2 },
  photoRow: { flexDirection: 'row', gap: 8 },
  photoOption: { flex: 1, minHeight: 84, borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 10 },
  coverRemove: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  coverPill: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter - 4, marginTop: space[5] },
  quickCell: { width: '25%', padding: 4 },
  quickTile: { height: 84, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', padding: 8 },
  tileLabel: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  or: { paddingHorizontal: space.gutter, marginTop: space[6] },
  circle: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter, height: 44 },
  origin: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', marginHorizontal: space.gutter, marginBottom: 6, paddingHorizontal: 12, height: 28, borderRadius: radius.pill, overflow: 'hidden' },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { paddingHorizontal: space.gutter, marginTop: space[3], marginBottom: space[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter - 5, marginBottom: space[6] },
  cell: { width: '50%', padding: 5 },
  tile: { height: 96, borderRadius: radius.xl, padding: 14, justifyContent: 'flex-end', overflow: 'hidden' },
  tileIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  block: { paddingHorizontal: space.gutter, gap: 10, marginBottom: space[5] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, overflow: 'hidden' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  custom: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed' },
  spotsNote: { paddingHorizontal: space.gutter, marginTop: -space[3] },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  desc: { minHeight: 90, borderRadius: radius.md, padding: 14, fontFamily: font.medium, fontSize: 15, textAlignVertical: 'top' },
  summary: { marginHorizontal: space.gutter, padding: 18, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
  note: { marginHorizontal: space.gutter, padding: 14, borderRadius: radius.lg, flexDirection: 'row', gap: 10, overflow: 'hidden' },
  footer: { position: 'absolute', left: space.gutter, right: space.gutter },
  closeWrap: { position: 'absolute', width: BUTTON, height: BUTTON },
  close: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, alignItems: 'center', justifyContent: 'center' },
});
