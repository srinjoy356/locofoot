"use client";

import { ReactNode, useState } from "react";
import { PublicNav } from "@/components/shared/PublicNav";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="bg-transparent text-on-surface font-body-md h-screen overflow-hidden flex flex-col md:flex-row w-full">
      <PublicNav isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto w-full pb-20 md:pb-0 relative transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:pl-64' : 'md:pl-0'}`}>
        {children}
      </main>
    </div>
  );
}
