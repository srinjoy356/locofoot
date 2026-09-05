import { Navigation } from "@/components/shared/Navigation";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col md:flex-row w-full overflow-x-hidden">
      <Navigation />
      <main className="flex-1 w-full md:pl-[80px] pb-20 md:pb-0 relative min-h-screen">
        {children}
      </main>
    </div>
  );
}
