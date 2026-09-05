import { TurfHero } from "@/components/shared/TurfHero";

export default function Page() {
  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      <TurfHero
        eyebrow="Organizer"
        title={<>Event <span className="text-primary-container">Settings</span></>}
        subtitle="Advanced tournament configuration."
        image="/turf/pitch-lines.jpg"
        size="sm"
      />
      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8">
        <div className="border border-outline-variant bg-surface p-6 md:p-12">
          <p className="font-body-md text-on-surface-variant">This is a Phase 2 placeholder page.</p>
        </div>
      </div>
    </div>
  );
}
