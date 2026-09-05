import Link from "next/link";
import { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-on-surface font-body-md h-screen overflow-hidden flex flex-col md:flex-row w-full">
      {/* Mobile Top App Bar */}
      <header className="md:hidden flex justify-between items-center w-full px-margin-mobile py-4 bg-surface border-b border-outline-variant z-50">
        <div className="font-display-sm text-display-sm font-bold tracking-tighter text-on-surface">REACTOR ELITE</div>
        <button className="text-primary-container font-label-caps text-label-caps border border-primary-container px-4 py-2 hover:bg-primary-container hover:text-on-primary-container transition-colors duration-200 uppercase tracking-widest">Live Stream</button>
      </header>

      {/* Desktop Side Navigation */}
      <nav className="hidden md:flex flex-col h-full py-8 px-4 bg-surface-container border-r border-outline-variant fixed left-0 top-0 w-[80px] z-50 items-center justify-between shrink-0">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Brand Mark */}
          <div className="w-10 h-10 bg-on-surface rounded-none flex items-center justify-center text-surface font-black text-xl tracking-tighter">R</div>
          
          <div className="flex flex-col gap-6 w-full">
            {/* Home (Active) */}
            <Link href="/explore" className="flex flex-col items-center justify-center w-12 h-12 rounded-none bg-primary-container text-on-primary-container hover:bg-primary-fixed transition-colors" title="Home">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            </Link>
            
            <Link href="/events/schedule" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors" title="Live Matches">
              <span className="material-symbols-outlined">sensors</span>
            </Link>
            
            <Link href="/explore" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors" title="Tournaments">
              <span className="material-symbols-outlined">trophy</span>
            </Link>
            
            <Link href="/events/stats" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors" title="Analytics">
              <span className="material-symbols-outlined">monitoring</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-6 w-full items-center">
          <Link href="/settings" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors" title="Settings">
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <div className="w-8 h-8 rounded-none bg-surface-variant border border-outline-variant flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-sm">person</span>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full md:pl-[80px] pb-20 md:pb-0 relative">
        {children}
      </main>

      {/* Mobile Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center py-3 bg-surface-container-highest border-t border-outline-variant z-50">
        <Link href="/explore" className="flex flex-col items-center justify-center text-primary-container opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emergency_recording</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Live</span>
        </Link>
        <Link href="/explore" className="flex flex-col items-center justify-center text-on-surface-variant opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined">sports_soccer</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Matches</span>
        </Link>
        <Link href="/explore" className="flex flex-col items-center justify-center text-on-surface-variant opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined">leaderboard</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Stats</span>
        </Link>
        <Link href="/explore" className="flex flex-col items-center justify-center text-on-surface-variant opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
