import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

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

/**
 * A picked photo made safe to share: re-encoded as JPEG, which drops the
 * file's metadata (EXIF: GPS position where the photo was taken, phone
 * model, date), and kept to 1600 px on the long side. Every photo other
 * members can see goes through here before it is uploaded.
 */
export async function cleanImage(uri: string): Promise<{ body: ArrayBuffer; ext: 'jpg'; contentType: 'image/jpeg' }> {
  let out = await manipulateAsync(uri, [], { compress: 0.85, format: SaveFormat.JPEG });
  const long = Math.max(out.width, out.height);
  if (long > 1600) {
    const resize = out.width >= out.height ? { width: 1600 } : { height: 1600 };
    out = await manipulateAsync(out.uri, [{ resize }], { compress: 0.85, format: SaveFormat.JPEG });
  }
  return { body: await imageBytes(out.uri), ext: 'jpg', contentType: 'image/jpeg' };
}
