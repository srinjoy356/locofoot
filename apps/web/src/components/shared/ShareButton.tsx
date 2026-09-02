"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

interface Props {
  url: string;
  title?: string;
  className?: string;
}

export function ShareButton({ url, title = "Share", className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy url: ", err);
      // Fallback
      prompt("Copy this link:", url);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-2 px-3 py-1.5 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-gray-200 text-slate-700 dark:text-zinc-300 font-medium transition-colors ${className}`}
      title={title}
    >
      {copied ? <Check size={16} className="text-green-600" /> : <Share2 size={16} />}
      <span className="text-sm">{copied ? "Copied!" : title}</span>
    </button>
  );
}
