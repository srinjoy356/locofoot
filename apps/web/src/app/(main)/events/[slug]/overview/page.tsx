import { TurfHero } from "@/components/shared/TurfHero";

export default function Page() {
  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen">
      <TurfHero
        eyebrow="Tournament"
        title={<>Event <span className="text-primary-container">Overview</span></>}
        subtitle="A summary of this tournament's story, format, and standings."
        image="/turf/stadium.jpg"
        size="md"
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 md:py-12">
        <div className="border border-outline-variant bg-surface p-8 md:p-12 text-center">
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
            This is a Phase 2 placeholder page.
          </p>
        </div>
      </div>
    </div>
  );
}
