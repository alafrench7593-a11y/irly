// The QR encoder of the qrcode package (its core only: no file, canvas or Node code).
declare module 'qrcode/lib/core/qrcode' {
  const QRCode: {
    create(text: string, options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): { modules: { size: number; data: Uint8Array } };
  };
  export default QRCode;
}
