import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function StageQrCode({ value, className = '', label = 'QR code' }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    const text = String(value || '').trim();
    if (!text) {
      setSvg('');
      return undefined;
    }
    let cancelled = false;
    QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    }).then((out) => {
      if (!cancelled) setSvg(out);
    }).catch(() => {
      /* keep last svg */
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!svg) {
    return <div className={`bg-white ${className}`} aria-hidden />;
  }

  return (
    <div
      className={`stage-qr bg-white ${className}`}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
