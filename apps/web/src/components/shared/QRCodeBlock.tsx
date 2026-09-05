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

  useEffect(() => {
    if (typeof window !== "undefined" && url.startsWith("/")) {
      setFullUrl(`${window.location.origin}${url}`);
    } else {
      setFullUrl(url);
    }
  }, [url]);

  return (
    <div className={`flex flex-col items-center bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-sm w-max mx-auto ${className}`}>
      <div className="flex items-center gap-2 mb-4 text-slate-700 dark:text-zinc-300 font-semibold">
        <QrCode size={18} />
        <span>{title}</span>
      </div>
      
      <div className="bg-white p-2 rounded-lg border border-slate-200">
        <QRCodeSVG 
          value={fullUrl} 
          size={160}
          bgColor={"#ffffff"}
          fgColor={"#000000"}
          level={"L"}
          includeMargin={false}
        />
      </div>
      
      <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500 text-center max-w-[200px] break-all">
        {fullUrl}
      </p>
    </div>
  );
}
