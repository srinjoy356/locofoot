import Link from "next/link";

const FEATURES = [
  { icon: "scoreboard", title: "Live Match Center", desc: "Real-time scores, timelines and events as the action unfolds on the pitch." },
  { icon: "groups", title: "Squad Matchmaking", desc: "Find players by code, build your roster, and register teams in seconds." },
  { icon: "insights", title: "Deep Statistics", desc: "Every goal, assist and card tracked across your entire footballing career." },
  { icon: "emoji_events", title: "Tournament Engine", desc: "Automated scheduling, fixtures and standings built for organizers." },
];

export default function Home() {
  return (
    <div className="relative w-full bg-background text-on-surface">
      {/* Hero */}
      <section className="relative min-h-screen w-full overflow-hidden flex flex-col">
        <div className="absolute inset-0 z-0">
          <img
            alt=""
            aria-hidden="true"
            src="/turf/pitch-lines.jpg"
            className="w-full h-full object-cover object-center  opacity-50 "
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40 z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/30 to-transparent z-10" />
        </div>

        {/* Top bar */}
        <header className="relative z-20 w-full">
          <div className="max-w-container-max mx-auto flex items-center justify-between px-margin-mobile md:px-gutter py-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-container text-surface flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>sports_soccer</span>
              </div>
              <span className="font-display-lg text-2xl uppercase tracking-tighter text-on-surface">LocoFoot</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden sm:inline-flex items-center border border-outline-variant bg-surface/50 hover:bg-surface-variant text-on-surface px-5 py-3 font-label-caps text-label-caps uppercase tracking-widest transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="inline-flex items-center bg-primary-container text-on-primary-container px-5 py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-20 flex-1 flex flex-col justify-center px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full pb-24 pt-10">
          <span className="flex items-center gap-2 mb-6 font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]" />
            Grassroots Football, Elevated
          </span>
          <h1 className="font-display-lg text-display-lg md:text-[88px] lg:text-[110px] uppercase tracking-tighter leading-[0.9] text-on-surface max-w-4xl">
            The Beautiful Game, <span className="text-primary-container">Professionally</span> Run.
          </h1>
          <p className="font-body-lg md:text-body-lg text-on-surface-variant mt-6 max-w-xl">
            Real-time turf availability, elite matchmaking, and performance tracking — the complete platform for players and organizers.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-8 py-4 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors">
              Create Free Account
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
            <Link href="/explore" className="inline-flex items-center justify-center gap-2 border border-outline-variant bg-surface/40 hover:bg-surface-variant text-on-surface px-8 py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors">
              <span className="material-symbols-outlined text-base">travel_explore</span>
              Explore Events
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-20 border-t border-outline-variant bg-background">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter py-16 md:py-24">
          <div className="mb-12">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Everything You Need</span>
            <h2 className="font-display-lg text-headline-lg md:text-display-sm uppercase tracking-tighter text-on-surface mt-2 leading-none">
              One Platform. <span className="text-primary-container">Full Control.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-outline-variant">
            {FEATURES.map((f) => (
              <div key={f.title} className="border-r border-b border-outline-variant p-8 bg-[#151816] hover:bg-surface-variant transition-colors group">
                <span className="material-symbols-outlined text-primary-container text-4xl mb-6 block group-hover:scale-110 transition-transform origin-left">{f.icon}</span>
                <h3 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface mb-3">{f.title}</h3>
                <p className="font-body-md text-on-surface-variant">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="relative overflow-hidden border-t border-outline-variant">
        <div className="absolute inset-0 z-0">
          <img alt="" aria-hidden="true" src="/turf/aerial-field.jpg" className="w-full h-full object-cover  opacity-30 " />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/60 z-10" />
        </div>
        <div className="relative z-20 max-w-container-max mx-auto px-margin-mobile md:px-gutter py-20 md:py-28 flex flex-col items-center text-center">
          <h2 className="font-display-lg text-display-sm md:text-display-lg uppercase tracking-tighter leading-none text-on-surface max-w-3xl">
            Ready to Take the <span className="text-primary-container">Pitch?</span>
          </h2>
          <p className="font-body-lg text-on-surface-variant mt-5 max-w-lg">
            Join players and organizers building the future of local football.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-8 py-4 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors">
              Get Started Free
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center border border-outline-variant bg-surface/40 hover:bg-surface-variant text-on-surface px-8 py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-20 border-t border-outline-variant bg-background">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-primary-container text-surface flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>sports_soccer</span>
            </div>
            <span className="font-display-lg text-lg uppercase tracking-tighter text-on-surface">LocoFoot</span>
          </div>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">The Home of Grassroots Football</p>
        </div>
      </footer>
    </div>
  );
}
