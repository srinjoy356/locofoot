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
        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-variant text-on-surface text-xs font-semibold transition-colors border border-outline-variant"
      >
        <Download size={14} /> CSV
      </button>
      <button 
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-variant text-on-surface text-xs font-semibold transition-colors border border-outline-variant"
      >
        <Printer size={14} /> PDF
      </button>
    </div>
  );
}
