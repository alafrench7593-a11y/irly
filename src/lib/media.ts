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
