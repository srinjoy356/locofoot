import { Navigation } from "@/components/shared/Navigation";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navigation />
      <main className="max-w-4xl mx-auto p-4 w-full flex-1">
        {children}
      </main>
    </>
  );
}
