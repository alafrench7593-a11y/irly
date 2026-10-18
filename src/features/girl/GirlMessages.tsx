import { useRouter } from "expo-router";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import type { Conversation } from "@/data/types";
import { useAccount } from "@/features/auth/account";
import { useServerInbox } from "@/features/server/chat";
import { DEMO } from "@/config/app";
import { demoPhoto, useDemoGirlInbox } from "./demo";
import { t as tx } from "@/i18n";
import { hueOf } from "@/lib/format";
import { PressableScale } from "@/motion/PressableScale";
import { radius, space } from "@/theme/tokens";
import { girl, girlType } from "./theme";
import { GButton } from "./ui";

// The demonstration build shows its example IRLY Girl chats (the local inbox), never the server's.
const useInbox = DEMO ? useDemoGirlInbox : useServerInbox;

/**
 * "Your messages" on the IRLY Girl home: the three latest conversations,
 * read from the same inbox as the Messages tab (one chat system for the whole
 * app: a conversation started anywhere in IRLY shows here, and the other way
 * round). Opens the conversation, or the full list.
 */
export function GirlMessages({ onCommunities }: { onCommunities: () => void }) {
  const router = useRouter();
  const account = useAccount();
  const { conversations, loading, error, refresh } = useInbox();
  if (!account && !DEMO) return null;
  const recent = conversations.filter((c) => !c.archived).slice(0, 3);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="titleM" color={girl.ink} style={girlType.section}>
          {tx("Your messages")}
        </Text>
        <PressableScale
          haptic="select"
          scaleTo={0.95}
          onPress={() => router.push("/messages")}
          accessibilityRole="link"
          accessibilityLabel={tx("All messages")}
          style={styles.all}
        >
          <Text variant="label" color={girl.rose}>
            {tx("All")}
          </Text>
          <Icon name="chevronRight" size={16} color={girl.rose} />
        </PressableScale>
      </View>
      <View style={styles.card}>
        {loading && !recent.length ? (
          [0, 1].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton width={44} height={44} radius={22} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="50%" height={12} />
                <Skeleton width="80%" height={10} />
              </View>
            </View>
          ))
        ) : error && !recent.length ? (
          <View style={styles.empty}>
            <Text
              variant="bodyS"
              color={girl.inkSoft}
              style={{ textAlign: "center" }}
            >
              {tx("Your messages could not load.")}
            </Text>
            <GButton
              label={tx("Try again")}
              variant="secondary"
              onPress={refresh}
            />
          </View>
        ) : !recent.length ? (
          <View style={styles.empty}>
            <Text variant="titleS" color={girl.ink} style={girlType.card}>
              {tx("No conversations yet")}
            </Text>
            <Text
              variant="bodyS"
              color={girl.inkSoft}
              style={{ textAlign: "center" }}
            >
              {tx("Join a community: you are in its chat straight away.")}
            </Text>
            <GButton
              label={tx("Find a community")}
              variant="secondary"
              icon="users"
              onPress={onCommunities}
            />
          </View>
        ) : (
          recent.map((c, i) => (
            <Row
              key={c.id}
              c={c}
              last={i === recent.length - 1}
              onPress={() => router.push(`/messages/${c.id}`)}
            />
          ))
        )}
      </View>
    </View>
  );
}

const Row = memo(function Row({
  c,
  last,
  onPress,
}: {
  c: Conversation;
  last: boolean;
  onPress: () => void;
}) {
  const m = c.messages[c.messages.length - 1];
  const preview = m ? (c.lastIsPhoto ? tx("Photo") : m.text) : "";
  const who =
    m && m.from === "me"
      ? tx("You: ")
      : c.kind !== "direct" && c.lastSenderName
        ? `${c.lastSenderName}: `
        : "";
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.98}
      onPress={onPress}
      accessibilityLabel={
        c.unread
          ? tx("{name}, {n} unread", { name: c.title, n: c.unread })
          : c.title
      }
      style={[styles.row, !last && styles.divider]}
    >
      <Avatar
        name={c.title}
        hue={hueOf(c.otherId ?? c.id)}
        size={44}
        userId={c.kind === "direct" ? c.otherId : undefined}
        photo={demoPhoto(c.personIds[0])}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleS" color={girl.ink} numberOfLines={1} raw>
          {c.title}
        </Text>
        <Text
          variant="bodyS"
          color={c.unread ? girl.ink : girl.inkSoft}
          numberOfLines={1}
          raw
          style={c.unread ? styles.bold : undefined}
        >
          {who}
          {preview}
        </Text>
      </View>
      {c.unread ? (
        <View style={styles.unread}>
          <Text variant="caption" color="#FFFFFF" raw style={styles.unreadText}>
            {c.unread > 99 ? "99+" : String(c.unread)}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  wrap: { marginTop: space[7], gap: 12, paddingHorizontal: space.gutter },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  all: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: girl.surface,
    borderWidth: 1,
    borderColor: girl.line,
    overflow: "hidden",
    boxShadow: girl.shadowSoft,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 68,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: girl.line,
  },
  bold: { fontWeight: "700" },
  unread: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: girl.rose,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { fontSize: 11, lineHeight: 13, fontWeight: "700" },
  empty: { alignItems: "center", gap: 10, padding: 20 },
});
