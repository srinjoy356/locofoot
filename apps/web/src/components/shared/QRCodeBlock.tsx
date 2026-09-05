"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Download } from "lucide-react";

interface Props {
  url: string;
  title?: string;
  className?: string;
}

export function QRCodeBlock({ url, title = "Scan to view", className = "" }: Props) {
  const [fullUrl, setFullUrl] = useState(url);

  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && url.startsWith("/")) {
      setFullUrl(`${window.location.origin}${url}`);
    } else {
      setFullUrl(url);
    }
  }, [url]);

  if (!isRevealed) {
    return (
      <button 
        onClick={() => setIsRevealed(true)}
        className={`flex items-center gap-3 border border-outline-variant bg-surface hover:bg-surface-variant transition-colors px-6 py-4 w-max mx-auto font-label-caps text-label-caps uppercase tracking-widest text-on-surface ${className}`}
      >
        <QrCode size={18} className="text-on-surface-variant" />
        <span>REVEAL QR CODE</span>
      </button>
    );
  }

  return (
    <div className={`flex flex-col items-center bg-surface-container border border-outline-variant p-4 w-max mx-auto relative ${className}`}>
      <button 
        onClick={() => setIsRevealed(false)}
        className="absolute top-2 right-2 text-on-surface-variant hover:text-on-surface transition-colors"
        title="Hide QR Code"
      >
        &times;
      </button>
      <div className="flex items-center gap-2 mb-4 text-on-surface-variant font-label-caps text-label-caps uppercase tracking-widest">
        <QrCode size={18} />
        <span>{title}</span>
      </div>
      
      <div className="bg-white p-2 border border-outline-variant">
        <QRCodeSVG 
          value={fullUrl} 
          size={160}
          bgColor={"#ffffff"}
          fgColor={"#000000"}
          level={"L"}
          includeMargin={false}
        />
      </div>
      
      <p className="mt-3 text-xs text-on-surface-variant text-center max-w-[200px] break-all">
        {fullUrl}
      </p>
    </div>
  );
}
