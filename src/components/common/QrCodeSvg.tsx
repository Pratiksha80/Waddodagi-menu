import React from 'react';
import QRCode from 'qrcode';

/**
 * Robust matrix-based SVG QR Code generator for the Customer Menu URL.
 * Produces clean vector paths compatible with printing and mobile scanners.
 */
interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
}

export const QrCodeSvg: React.FC<QrCodeProps> = ({ value, size = 200, className = '' }) => {
  const [svg, setSvg] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 4,
      color: { dark: '#241a00', light: '#ffffff' },
    }).then((generatedSvg) => {
      if (!cancelled) setSvg(generatedSvg);
    }).catch((error: unknown) => {
      console.error('Failed to generate menu QR code:', error);
      if (!cancelled) setSvg('');
    });

    return () => { cancelled = true; };
  }, [value]);

  return (
    <div
      role="img"
      aria-label={`QR code linking to ${value}`}
      className={`rounded-lg bg-white p-3 shadow-inner [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
