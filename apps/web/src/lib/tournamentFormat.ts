export type TournamentFormat = 'ROUND_ROBIN' | 'DOUBLE_ROUND_ROBIN' | 'KNOCKOUT' | 'GROUP_KNOCKOUT';

export interface FormatConfig {
  groupCount: number;
  advancePerGroup: number;
  thirdPlace: boolean;
  doubleRoundRobinGroups: boolean;
}

export const DEFAULT_FORMAT_CONFIG: FormatConfig = {
  groupCount: 2,
  advancePerGroup: 2,
  thirdPlace: true,
  doubleRoundRobinGroups: false,
};

export const FORMAT_LABELS: Record<TournamentFormat, { title: string; blurb: string }> = {
  ROUND_ROBIN: { title: 'League', blurb: 'Everyone plays everyone once.' },
  DOUBLE_ROUND_ROBIN: { title: 'Home & Away League', blurb: 'Everyone plays everyone twice.' },
  KNOCKOUT: { title: 'Knockout', blurb: 'Lose and you are out. Ends with a final.' },
  GROUP_KNOCKOUT: { title: 'Groups + Knockout', blurb: 'Group stage, then semi-finals, final and an optional 3rd place match.' },
};

const pairs = (n: number) => (n * (n - 1)) / 2;

/** Mirrors apps/api tournament_format.py so the admin sees the real match count before generating. */
export function knockoutMatches(entrants: number, thirdPlace: boolean): number {
  if (entrants < 2) return 0;
  // every game eliminates one team, so n - 1 games reach a champion
  const semisAreReal = entrants >= 4;
  return entrants - 1 + (thirdPlace && semisAreReal ? 1 : 0);
}

export function groupSizes(teams: number, groupCount: number): number[] {
  const base = Math.floor(teams / groupCount);
  return Array.from({ length: groupCount }, (_, i) => base + (i < teams % groupCount ? 1 : 0));
}

export interface FixturePlan {
  valid: boolean;
  error?: string;
  groupMatches: number;
  knockoutMatches: number;
  total: number;
  summary: string;
}

export function planFixtures(format: TournamentFormat, teams: number, cfg: FormatConfig): FixturePlan {
  const fail = (error: string): FixturePlan => ({ valid: false, error, groupMatches: 0, knockoutMatches: 0, total: 0, summary: '' });
  if (teams < 2) return fail('At least 2 approved teams are needed.');

  if (format === 'ROUND_ROBIN' || format === 'DOUBLE_ROUND_ROBIN') {
    const m = pairs(teams) * (format === 'DOUBLE_ROUND_ROBIN' ? 2 : 1);
    return { valid: true, groupMatches: m, knockoutMatches: 0, total: m, summary: `${teams} teams, ${m} matches` };
  }
  if (format === 'KNOCKOUT') {
    const k = knockoutMatches(teams, cfg.thirdPlace);
    return { valid: true, groupMatches: 0, knockoutMatches: k, total: k, summary: `${teams} teams, ${k} knockout matches` };
  }

  const sizes = groupSizes(teams, cfg.groupCount);
  const smallest = Math.min(...sizes);
  if (smallest < 2) return fail(`${teams} teams cannot fill ${cfg.groupCount} groups of at least 2.`);
  if (cfg.advancePerGroup > smallest) return fail(`Only ${smallest} teams in the smallest group, so at most ${smallest} can advance.`);
  const qualifiers = cfg.groupCount * cfg.advancePerGroup;
  if (qualifiers < 2) return fail('At least 2 teams must qualify.');
  const g = sizes.reduce((sum, s) => sum + pairs(s) * (cfg.doubleRoundRobinGroups ? 2 : 1), 0);
  const k = knockoutMatches(qualifiers, cfg.thirdPlace);
  return {
    valid: true,
    groupMatches: g,
    knockoutMatches: k,
    total: g + k,
    summary: `${cfg.groupCount} groups of ${sizes.join('/')}, top ${cfg.advancePerGroup} advance: ${g} group + ${k} knockout = ${g + k} matches`,
  };
}
