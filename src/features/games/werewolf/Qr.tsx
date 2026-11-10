import { memo, useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
// The encoder only (no file or canvas code): pure JavaScript, the same on phones and the web.
import QRCode from 'qrcode/lib/core/qrcode';

/** A QR code for a link, drawn with SVG (dark modules on white, with its quiet zone). */
export const Qr = memo(function Qr({ value, size }: { value: string; size: number }) {
  const { path, n } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count: number = qr.modules.size;
    const data: Uint8Array = qr.modules.data;
    let d = '';
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) if (data[y * count + x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
    return { path: d, n: count + 8 };
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
      <Rect x={0} y={0} width={n} height={n} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
});
