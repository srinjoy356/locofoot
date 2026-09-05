"use client";

import { Download, Printer } from "lucide-react";
import { exportToCSV } from "@/lib/exportUtils";

interface Props {
  filename: string;
  data: any[];
  columns: { key: string; label: string; formatter?: (val: any, row: any) => string }[];
}

export function ExportControls({ filename, data, columns }: Props) {
  return (
    <div className="flex gap-2 print:hidden">
      <button 
        onClick={() => exportToCSV(filename, data, columns)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded transition-colors border dark:border-zinc-700"
      >
        <Download size={14} /> CSV
      </button>
      <button 
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded transition-colors border dark:border-zinc-700"
      >
        <Printer size={14} /> PDF
      </button>
    </div>
  );
}
