import { Photo } from "@/components/visual/Photo";
import { useCommunityCover, usePhotoLink } from "@/features/server/covers";
import type { LightId } from "@/theme/lights";
import { communityPhoto } from "./official";

/**
 * A community at a glance: always a photo, never an icon or a logo. Its own
 * photo when it has one; otherwise a photo of what its name says it is about
 * (IRLY's own photos first), then its topic or category. The same choice as
 * on its page, so a community looks the same everywhere.
 */
export function CommunityThumb({
  id,
  name,
  coverPath,
  topic,
  categoryId,
  light,
  size = 44,
}: {
  id?: string;
  name?: string | null;
  coverPath?: string | null;
  topic?: string | null;
  categoryId?: string | null;
  /** Kept for callers that still pass it: a community is shown by its photo, not its emoji. */
  emoji?: string | null;
  light: LightId;
  size?: number;
  member?: boolean;
}) {
  // Lists that do not load the photo path pass none: it is looked up by id, all thumbnails at once.
  const path = useCommunityCover(id, coverPath);
  const uri = usePhotoLink(path);
  const key = communityPhoto(topic, categoryId, name);
  return (
    <Photo
      pinned
      visual={{ photo: key, uri: uri ?? undefined }}
      light={light}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        overflow: "hidden",
      }}
      width={240}
      recyclingKey={id ? `community-${id}-${path ?? key}` : undefined}
    />
  );
}
