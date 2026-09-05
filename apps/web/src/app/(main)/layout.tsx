"use client";

import { useState } from "react";
import { Navigation } from "@/components/shared/Navigation";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="bg-transparent text-on-surface font-body-md min-h-screen flex flex-col md:flex-row w-full overflow-x-hidden">
      <Navigation isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <main className={`flex-1 w-full pb-20 md:pb-0 relative min-h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:pl-64' : 'md:pl-0'}`}>
        {children}
      </main>
    </div>
  );
}
