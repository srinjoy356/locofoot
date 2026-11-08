'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, GitBranch, Layers, Loader2, RotateCcw, Trophy, Users, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  DEFAULT_FORMAT_CONFIG,
  FORMAT_LABELS,
  planFixtures,
  type FormatConfig,
  type TournamentFormat,
} from '@/lib/tournamentFormat';

const ICONS: Record<TournamentFormat, typeof Trophy> = {
  ROUND_ROBIN: Users,
  DOUBLE_ROUND_ROBIN: Users,
  KNOCKOUT: GitBranch,
  GROUP_KNOCKOUT: Layers,
};

type Props = {
  eventId: string;
  teamCount: number;
  matchCount: number; // fixtures already generated
  capacity: number; // slot x field assignments available
  initialFormat?: string | null;
  onChanged: () => void;
};

const Stepper = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) => (
  <div className="flex items-center justify-between gap-4 border border-outline-variant bg-background px-4 py-3">
    <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">{label}</span>
    <div className="flex items-center gap-3">
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}
        className="h-8 w-8 border border-outline-variant text-on-surface hover:bg-surface-variant disabled:opacity-30">-</button>
      <span className="w-6 text-center font-mono text-lg text-on-surface">{value}</span>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}
        className="h-8 w-8 border border-outline-variant text-on-surface hover:bg-surface-variant disabled:opacity-30">+</button>
    </div>
  </div>
);

const Toggle = ({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-center justify-between gap-4 border border-outline-variant bg-background px-4 py-3">
    <span>
      <span className="block font-label-caps text-[10px] uppercase tracking-widest text-on-surface">{label}</span>
      <span className="block text-xs text-on-surface-variant">{hint}</span>
    </span>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#39ff6a]" />
  </label>
);

export function FormatSetupPanel({ eventId, teamCount, matchCount, capacity, initialFormat, onChanged }: Props) {
  const supabase = createClient();
  const [format, setFormat] = useState<TournamentFormat>(
    (['ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'KNOCKOUT', 'GROUP_KNOCKOUT'].includes(initialFormat || '') ? initialFormat : 'ROUND_ROBIN') as TournamentFormat,
  );
  // the parent loads the saved format after this mounts, so follow it when it arrives
  useEffect(() => {
    if (['ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'KNOCKOUT', 'GROUP_KNOCKOUT'].includes(initialFormat || '')) setFormat(initialFormat as TournamentFormat);
  }, [initialFormat]);
  const [cfg, setCfg] = useState<FormatConfig>(DEFAULT_FORMAT_CONFIG);
  const [draw, setDraw] = useState<'SEEDED' | 'RANDOM'>('SEEDED');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const plan = useMemo(() => planFixtures(format, teamCount, cfg), [format, teamCount, cfg]);
  const patch = (p: Partial<FormatConfig>) => setCfg((c) => ({ ...c, ...p }));

  const call = async (path: string, body?: object) => {
    setBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/v1/events/${eventId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.message || `Request failed (${res.status})`);
      }
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  };

  const generate = () =>
    call('fixtures/generate', {
      idempotency_key: crypto.randomUUID(),
      tournament_format: format,
      group_count: cfg.groupCount,
      advance_per_group: cfg.advancePerGroup,
      third_place: cfg.thirdPlace,
      double_round_robin_groups: cfg.doubleRoundRobinGroups,
      draw,
    });

  if (matchCount > 0) {
    return (
      <div className="border border-outline-variant bg-surface p-6">
        <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface mb-2">FIXTURES READY</h2>
        <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mb-4">
          {matchCount} MATCHES GENERATED. KNOCKOUT SLOTS FILL THEMSELVES AS RESULTS COME IN.
        </p>
        {error && <p className="mb-3 text-sm text-error">{error}</p>}
        {confirmReset ? (
          <div className="space-y-2">
            <p className="text-xs text-on-surface-variant">Deletes every fixture, group and bracket. Only possible while no match has started.</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => call('fixtures/reset')}
                className="flex-1 bg-error py-3 font-label-caps text-[10px] uppercase tracking-widest text-on-error disabled:opacity-50">
                {busy ? 'RESETTING...' : 'YES, RESET'}
              </button>
              <button onClick={() => setConfirmReset(false)} className="flex-1 border border-outline-variant py-3 font-label-caps text-[10px] uppercase tracking-widest text-on-surface">CANCEL</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)}
            className="flex w-full items-center justify-center gap-2 border border-outline-variant py-3 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-error hover:border-error">
            <RotateCcw size={14} /> CHANGE FORMAT / REGENERATE
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-outline-variant bg-surface p-6 space-y-5">
      <div>
        <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface mb-1">TOURNAMENT FORMAT</h2>
        <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
          PICK A FORMAT. ONE CLICK BUILDS GROUPS, FIXTURES AND THE BRACKET FOR {teamCount} APPROVED TEAMS.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(FORMAT_LABELS) as TournamentFormat[]).map((f) => {
          const Icon = ICONS[f];
          const active = f === format;
          return (
            <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={active}
              className={`flex flex-col items-start gap-2 border p-3 text-left transition-colors ${active ? 'border-primary-container bg-primary-container/10' : 'border-outline-variant hover:bg-surface-variant'}`}>
              <Icon size={18} className={active ? 'text-primary-container' : 'text-on-surface-variant'} />
              <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface">{FORMAT_LABELS[f].title}</span>
              <span className="text-[11px] leading-snug text-on-surface-variant">{FORMAT_LABELS[f].blurb}</span>
            </button>
          );
        })}
      </div>

      {format === 'GROUP_KNOCKOUT' && (
        <div className="space-y-2">
          <Stepper label="Groups" value={cfg.groupCount} min={2} max={Math.max(2, Math.floor(teamCount / 2))} onChange={(v) => patch({ groupCount: v })} />
          <Stepper label="Advance per group" value={cfg.advancePerGroup} min={1} max={4} onChange={(v) => patch({ advancePerGroup: v })} />
          <Toggle label="Home & away in groups" hint="Each pair meets twice inside a group." checked={cfg.doubleRoundRobinGroups} onChange={(v) => patch({ doubleRoundRobinGroups: v })} />
        </div>
      )}
      {(format === 'GROUP_KNOCKOUT' || format === 'KNOCKOUT') && (
        <Toggle label="Third place match" hint="Semi-final losers play each other." checked={cfg.thirdPlace} onChange={(v) => patch({ thirdPlace: v })} />
      )}

      <div>
        <p className="mb-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">How are teams drawn?</p>
        <div className="grid grid-cols-2 gap-2">
          {([['SEEDED', 'By strength', 'Uses the seeds on the Registrations page, so strong teams are spread across groups.'], ['RANDOM', 'Random draw', 'Shuffles the teams. A different draw every time.']] as const).map(([d, title, blurb]) => (
            <button key={d} type="button" onClick={() => setDraw(d)} aria-pressed={draw === d}
              className={`flex flex-col items-start gap-1 border p-3 text-left transition-colors ${draw === d ? 'border-primary-container bg-primary-container/10' : 'border-outline-variant hover:bg-surface-variant'}`}>
              <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface">{title}</span>
              <span className="text-[11px] leading-snug text-on-surface-variant">{blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`border p-4 ${plan.valid ? 'border-primary-container/40 bg-primary-container/5' : 'border-error/50 bg-error/10'}`}>
        {plan.valid ? (
          <>
            <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface">{plan.summary}</p>
            {capacity < plan.total && (
              <p className="mt-2 flex items-start gap-2 text-xs text-on-surface-variant">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                Only {capacity} slot positions exist for {plan.total} matches. Add slots on the Slots page before going live.
              </p>
            )}
          </>
        ) : (
          <p className="flex items-start gap-2 text-sm text-error"><AlertCircle size={16} className="mt-0.5 shrink-0" />{plan.error}</p>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button onClick={generate} disabled={busy || !plan.valid}
        className="flex w-full items-center justify-center gap-2 bg-primary-container py-4 font-headline-sm uppercase tracking-tighter text-on-primary-container transition-colors hover:bg-primary-container/90 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
        GENERATE TOURNAMENT
      </button>
    </div>
  );
}
