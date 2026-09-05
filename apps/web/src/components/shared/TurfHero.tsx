import { ReactNode } from "react";

type Size = "sm" | "md" | "lg";

const HEIGHTS: Record<Size, string> = {
  sm: "h-[190px] md:h-[220px]",
  md: "h-[38vh] min-h-[300px] md:min-h-[340px]",
  lg: "h-[60vh] min-h-[420px]",
};

const TITLE_SIZES: Record<Size, string> = {
  sm: "text-headline-lg-mobile md:text-headline-lg",
  md: "text-headline-lg md:text-display-sm",
  lg: "text-display-sm md:text-display-lg",
};

export type TurfHeroProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  /** Path under /public. Defaults to the clean pitch-lines texture. */
  image?: string;
  size?: Size;
  /** Shows a pulsing green dot before the eyebrow. */
  live?: boolean;
  /** Right-aligned actions (buttons etc.), shown beside the title on desktop. */
  actions?: ReactNode;
  /** Full-width content rendered below the title (search, tabs, meta). */
  children?: ReactNode;
  className?: string;
};

export function TurfHero({
  title,
  subtitle,
  eyebrow,
  image = "/turf/pitch-lines.jpg",
  size = "md",
  live = false,
  actions,
  children,
  className = "",
}: TurfHeroProps) {
  return (
    <section
      className={`relative w-full overflow-hidden border-b border-outline-variant bg-[#151816] ${HEIGHTS[size]} ${className}`}
    >
      {/* Turf background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent z-10" />
        <img
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-center  opacity-50 "
          src={image}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 h-full flex flex-col justify-end px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full pb-7 md:pb-9">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <span className="flex items-center gap-2 mb-3 font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
                {live && (
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]" />
                )}
                {eyebrow}
              </span>
            )}
            <h1 className={`font-display-lg ${TITLE_SIZES[size]} text-on-surface uppercase tracking-tighter leading-none`}>
              {title}
            </h1>
            {subtitle && (
              <p className="font-body-md md:font-body-lg md:text-body-lg text-on-surface-variant mt-3 max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="hidden md:flex items-center gap-3 shrink-0">{actions}</div>}
        </div>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
