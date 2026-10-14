import { ImageManipulator, manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Type and extension of a picked image, from its URI. iOS (with editing)
 * gives JPEG; Android's photo picker can give PNG or WebP, which must not be
 * stored as .jpg/image/jpeg. Anything unknown is sent as JPEG.
 */
export function imageType(uri: string): { ext: string; contentType: string } {
  const m = uri.toLowerCase().match(/\.(png|webp|jpe?g)(?:[?#].*)?$/) ?? uri.match(/^data:image\/(png|webp|jpe?g)/i);
  const kind = m?.[1]?.toLowerCase();
  if (kind === 'png') return { ext: 'png', contentType: 'image/png' };
  if (kind === 'webp') return { ext: 'webp', contentType: 'image/webp' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

/** Bytes of a picked image: data: URIs are decoded here (fetch of data: is unreliable on Android). */
export async function imageBytes(uri: string): Promise<ArrayBuffer> {
  const m = uri.match(/^data:[^;]+;base64,(.*)$/);
  if (!m) return (await fetch(uri)).arrayBuffer();
  const bin = atob(m[1]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Longest side of every shared photo. */
export const SHARE_MAX_EDGE = 1600;

/**
 * A picked photo made safe to share, as a file: decoded once (turned upright
 * from its EXIF orientation by the manipulator on iOS and Android), kept to
 * 1600 px on the long side and encoded ONCE as JPEG, which drops the file's
 * metadata (EXIF: GPS position, phone model, date). HEIC, PNG and WebP come
 * out as JPEG. Its size is the size of the picture as it is shown.
 */
export async function prepareImage(uri: string): Promise<{ uri: string; width: number; height: number; ext: 'jpg'; contentType: 'image/jpeg' }> {
  // Native images hold full-size bitmaps: released as soon as the file is written (a loop of
  // photos would otherwise keep them all until the garbage collector runs).
  const held: { release?: () => void }[] = [];
  try {
    const first = ImageManipulator.manipulate(uri);
    held.push(first);
    let ref = await first.renderAsync();
    held.push(ref);
    const long = Math.max(ref.width, ref.height);
    if (long > SHARE_MAX_EDGE) {
      const resize = ref.width >= ref.height ? { width: SHARE_MAX_EDGE } : { height: SHARE_MAX_EDGE };
      const second = ImageManipulator.manipulate(ref).resize(resize);
      held.push(second);
      ref = await second.renderAsync();
      held.push(ref);
    }
    const out = await ref.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    return { uri: out.uri, width: out.width, height: out.height, ext: 'jpg', contentType: 'image/jpeg' };
  } finally {
    for (const h of held) {
      try {
        h.release?.();
      } catch {
        // Already released: nothing to free.
      }
    }
  }
}

/**
 * A picked photo made safe to share (see prepareImage), as bytes. Every photo
 * other members can see goes through here or prepareImage before it is uploaded.
 */
export async function cleanImage(uri: string): Promise<{ body: ArrayBuffer; ext: 'jpg'; contentType: 'image/jpeg'; width: number; height: number }> {
  const img = await prepareImage(uri);
  return { body: await imageBytes(img.uri), ext: 'jpg', contentType: 'image/jpeg', width: img.width, height: img.height };
}

/**
 * The small copy of a profile photo (256 px, light JPEG): what avatars show,
 * so a list of faces never downloads full-size photos. Takes a local file or
 * a link (an existing photo whose small copy is missing).
 */
export async function faceThumb(uri: string): Promise<ArrayBuffer> {
  if (/^https?:/.test(uri)) {
    const { Image } = await import('expo-image');
    const ref = await Image.loadAsync(uri);
    const side = ref.width >= ref.height ? { width: 256 } : { height: 256 };
    const out = await (await ImageManipulator.manipulate(ref).resize(side).renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return imageBytes(out.uri);
  }
  const first = await manipulateAsync(uri, [], { format: SaveFormat.JPEG });
  const side = first.width >= first.height ? { width: 256 } : { height: 256 };
  const out = await manipulateAsync(first.uri, [{ resize: side }], { compress: 0.8, format: SaveFormat.JPEG });
  return imageBytes(out.uri);
}
