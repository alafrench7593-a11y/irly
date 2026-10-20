import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Page } from "@/components/layout/Page";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { CITIES } from "@/data/destinations";
import { useAccount } from "@/features/auth/account";
import { joinCommunity } from "@/features/community/data";
import {
  HELP_CATEGORIES,
  useHelpFeed,
  type HelpPost,
} from "@/features/help/help";
import { openReport } from "@/features/moderation/reportStore";
import { PostMedia } from "@/features/posts/PostMedia";
import { toggleSave } from "@/features/server/engage";
import { a11y, t as tx } from "@/i18n";
import { hueOf } from "@/lib/format";
import { timeAgo } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { haptic } from "@/motion/haptics";
import { PressableScale } from "@/motion/PressableScale";
import { useCityId } from "@/state/store";
import { font, radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { GlassLayer } from "@/components/ui/GlassLayer";

/**
 * Help & Questions: ask about life in the city, answer, recommend places and
 * professionals, save useful threads, report scams. Members' answers are
 * experience; official sources are linked for sensitive topics.
 */
export default function HelpScreen() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const [category, setCategory] = useState<string | null>(null);
  const [kind, setKind] = useState<"question" | "recommendation" | null>(null);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState<"question" | "recommendation" | null>(
    null,
  );
  const feed = useHelpFeed(cityId, category, query, kind);
  const cat = HELP_CATEGORIES.find((c) => c.id === category) ?? null;
  const hasGroups = feed.groups.length > 0;

  const ask = async (k: "question" | "recommendation", categoryId: string) => {
    const g = feed.groups.find((x) => x.category === categoryId);
    if (!g) {
      // Never a silent tap.
      toast(
        feed.error ? "Can’t reach IRLY right now" : "Not open in this city yet",
        "x",
        "live",
      );
      return;
    }
    try {
      if (!g.isMember) await joinCommunity(g.id);
      setAsking(null);
      router.push({
        pathname: "/post/new",
        params: {
          community: g.id,
          name: tx(
            HELP_CATEGORIES.find((c) => c.id === categoryId)?.label ?? g.name,
          ),
          kind: k,
        },
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not open", "x", "live");
    }
  };
  const start = (k: "question" | "recommendation") => {
    if (!account) {
      toast("Sign in to ask", "user", "brand");
      router.push("/account");
      return;
    }
    if (category) ask(k, category);
    else setAsking(k);
  };

  return (
    <Page
      overline={city.name}
      title="Help & Questions"
      subtitle="Ask, answer and recommend. Answers come from members' own experience."
    >
      <View style={{ gap: space[4] }}>
        <View style={[styles.pad, styles.row]}>
          <View style={{ flex: 1 }}>
            <Button
              label="Ask a question"
              icon="question"
              full
              onPress={() => start("question")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Recommend"
              icon="star"
              variant="secondary"
              full
              onPress={() => start("recommendation")}
            />
          </View>
        </View>
        <View style={[styles.pad]}>
          <View
            style={[
              styles.search,
              {
                backgroundColor: "transparent",
                overflow: "hidden",
                borderColor: "transparent",
              },
            ]}
          >
            <GlassLayer radius={radius.lg} />
            <Icon name="search" size={18} color={t.c.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={tx("Search: Emirates ID, nursery, Marina…")}
              placeholderTextColor={t.c.textTertiary}
              style={[styles.searchInput, { color: t.c.text }]}
              returnKeyType="search"
              accessibilityLabel={a11y("Search questions")}
            />
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}
        >
          <Chip
            size="sm"
            label={tx("All")}
            selected={!category}
            onPress={() => setCategory(null)}
          />
          {HELP_CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              size="sm"
              icon={c.icon}
              label={tx(c.label)}
              selected={category === c.id}
              onPress={() => setCategory(category === c.id ? null : c.id)}
            />
          ))}
        </ScrollView>
        <View style={[styles.pad, styles.row]}>
          <Chip
            size="sm"
            label={tx("Everything")}
            selected={!kind}
            onPress={() => setKind(null)}
          />
          <Chip
            size="sm"
            label={tx("Questions")}
            selected={kind === "question"}
            onPress={() => setKind("question")}
          />
          <Chip
            size="sm"
            label={tx("Recommendations")}
            selected={kind === "recommendation"}
            onPress={() => setKind("recommendation")}
          />
        </View>

        {cat?.official?.length ? (
          <View
            style={[
              styles.official,
              {
                backgroundColor: "transparent",
                overflow: "hidden",
                borderColor: "transparent",
              },
            ]}
          >
            <GlassLayer radius={radius.xl} />
            <View style={styles.row}>
              <Icon name="shield" size={16} color={t.c.text} />
              <Text variant="titleS">Official sources</Text>
            </View>
            <Text variant="bodyS" tone="secondary">
              Rules and fees change: members share what they lived, the official
              sites say what applies today.
            </Text>
            {cat.official.map((o) => (
              <PressableScale
                key={o.url}
                haptic="select"
                onPress={() => Linking.openURL(o.url)}
                style={styles.link}
                accessibilityRole="link"
                accessibilityLabel={o.label}
              >
                <Icon name="link" size={14} color={t.c.text} />
                <Text variant="label" style={{ flex: 1 }}>
                  {tx(o.label)}
                </Text>
                <Icon name="chevronRight" size={14} color={t.c.textTertiary} />
              </PressableScale>
            ))}
          </View>
        ) : null}

        {!account ? (
          <View style={[styles.pad, { gap: 10 }]}>
            <Text variant="body" tone="secondary">
              Sign in to read and ask questions.
            </Text>
            <Button label="Sign in" onPress={() => router.push("/account")} />
          </View>
        ) : feed.loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={t.c.text} />
        ) : feed.error ? (
          <View style={[styles.pad, { gap: 10 }]}>
            <Text variant="body" tone="secondary">
              {tx(feed.error)}
            </Text>
            <Button
              label="Try again"
              variant="secondary"
              onPress={feed.reload}
            />
          </View>
        ) : !hasGroups ? (
          <Text variant="body" tone="secondary" style={styles.pad}>
            {tx("Help & Questions is not open in {city} yet.", {
              city: city.name,
            })}
          </Text>
        ) : !feed.items.length ? (
          <View
            style={[
              styles.empty,
              { backgroundColor: "transparent", overflow: "hidden" },
            ]}
          >
            <GlassLayer radius={radius.xl} />
            <Icon name="question" size={22} color={t.c.textSecondary} />
            <Text variant="body" tone="secondary" align="center">
              {query
                ? "Nothing found. Try other words, or ask the question."
                : "No questions here yet. Be the first to ask."}
            </Text>
          </View>
        ) : (
          <View style={[styles.pad, { gap: 12 }]}>
            {feed.items.map((p) => (
              <HelpCard key={p.id} p={p} onSaved={feed.reload} />
            ))}
          </View>
        )}
      </View>
      <Sheet
        visible={Boolean(asking)}
        onClose={() => setAsking(null)}
        title={asking === "recommendation" ? "Recommend in…" : "Ask in…"}
        subtitle="Pick the topic: the right people will see it."
      >
        <View style={[styles.pad, styles.wrap, { paddingBottom: space[4] }]}>
          {HELP_CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              icon={c.icon}
              label={tx(c.label)}
              onPress={() => asking && ask(asking, c.id)}
            />
          ))}
        </View>
      </Sheet>
    </Page>
  );
}

function HelpCard({ p, onSaved }: { p: HelpPost; onSaved: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const now = useNow();
  const [saved, setSaved] = useState(p.saved);
  const open = () =>
    router.push({
      pathname: "/comments",
      params: { type: "community_post", id: p.id, title: p.body.slice(0, 60) },
    });
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.98}
      onPress={open}
      style={[
        styles.card,
        {
          backgroundColor: "transparent",
          overflow: "hidden",
          borderColor: "transparent",
        },
      ]}
      accessibilityLabel={p.body.slice(0, 80)}
    >
      <GlassLayer radius={radius.xl} />
      <View style={styles.row}>
        <Avatar
          name={p.firstName}
          hue={hueOf(p.authorId)}
          size={30}
          userId={p.authorId}
        />
        <View style={{ flex: 1 }}>
          <Text variant="label" raw>
            {p.mine ? tx("You") : p.firstName}
          </Text>
          <Text variant="caption" tone="tertiary" raw>
            {[
              p.pinned ? tx("Pinned") : null,
              p.kind === "recommendation"
                ? tx("Recommendation")
                : tx("Question"),
              tx(
                HELP_CATEGORIES.find((c) => c.id === p.category)?.label ??
                  p.categoryName,
              ),
              timeAgo(Math.max(0, Math.round((now - p.at) / 60000))),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        {!p.mine ? (
          <PressableScale
            onPress={() =>
              openReport(
                { kind: "community_post", id: p.id, userId: p.authorId },
                p.firstName,
              )
            }
            haptic="select"
            hitSlop={8}
            accessibilityLabel="Report: scam or inappropriate"
          >
            <Icon name="flag" size={16} color={t.c.textTertiary} />
          </PressableScale>
        ) : null}
      </View>
      {p.body ? (
        <Text variant="body" numberOfLines={5} raw>
          {p.body}
        </Text>
      ) : null}
      {p.mediaPaths.length ? (
        <PostMedia
          paths={p.mediaPaths}
          kind={p.mediaKind}
          thumb={p.thumbPath}
          height={180}
        />
      ) : null}
      <View style={styles.row}>
        <Icon name="message" size={14} color={t.c.textSecondary} />
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          {p.answers
            ? tx("{n} answers", { n: p.answers })
            : tx("No answer yet: help out")}
        </Text>
        <PressableScale
          haptic="select"
          hitSlop={8}
          onPress={() => {
            setSaved(!saved);
            toggleSave({ type: "community_post", id: p.id })
              .then((now) => {
                // The server toggles: its answer is the truth.
                setSaved(now);
                haptic("success");
                onSaved();
              })
              .catch(() => {
                setSaved(saved);
                toast("Could not save", "x", "live");
              });
          }}
          accessibilityLabel={saved ? "Saved" : "Save"}
        >
          <Icon
            name="bookmark"
            size={18}
            color={saved ? t.c.text : t.c.textTertiary}
          />
        </PressableScale>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontFamily: font.medium, fontSize: 16 },
  official: {
    marginHorizontal: space.gutter,
    padding: 14,
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  empty: {
    marginHorizontal: space.gutter,
    padding: 24,
    borderRadius: radius.xl,
    alignItems: "center",
    gap: 10,
  },
  card: {
    padding: 14,
    gap: 10,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
