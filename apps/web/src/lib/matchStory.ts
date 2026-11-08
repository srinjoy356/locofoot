export type StoryGoal = { team: 'home' | 'away'; scorer: string; minute: number; assist?: string | null; penalty?: boolean };

export type StoryInput = {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  goals: StoryGoal[]; // chronological
  mvp?: { name: string; rating?: number | null; goals: number; assists: number } | null;
  homeCards?: number;
  awayCards?: number;
  redCards?: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** A short written match report for people who missed the game. Pure, so every sentence is testable. */
export function matchStory(m: StoryInput): string {
  const { homeName, awayName, homeScore, awayScore } = m;
  const total = homeScore + awayScore;
  const lines: string[] = [];

  if (total === 0) {
    lines.push(`${homeName} and ${awayName} played out a goalless draw.`);
  } else {
    const winner = homeScore > awayScore ? homeName : awayName;
    const loser = homeScore > awayScore ? awayName : homeName;
    const margin = Math.abs(homeScore - awayScore);
    const score = `${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)}`;
    if (margin === 0) lines.push(`${homeName} and ${awayName} shared ${plural(total, 'goal')} in a ${homeScore}-${awayScore} draw.`);
    else if (margin >= 4) lines.push(`${winner} routed ${loser} ${score}.`);
    else if (margin === 1 && total >= 5) lines.push(`${winner} edged a ${total}-goal thriller against ${loser}, ${score}.`);
    else if (margin === 1) lines.push(`${winner} won a tight one against ${loser}, ${score}.`);
    else lines.push(`${winner} beat ${loser} ${score}.`);
  }

  const first = m.goals[0];
  if (first) lines.push(`${first.scorer} opened the scoring for ${first.team === 'home' ? homeName : awayName} on ${first.minute}'.`);

  const byScorer = new Map<string, number>();
  m.goals.forEach((g) => byScorer.set(g.scorer, (byScorer.get(g.scorer) ?? 0) + 1));
  const multi = [...byScorer].filter(([, n]) => n >= 2).map(([name, n]) => (n === 3 ? `${name} bagged a hat-trick` : n > 3 ? `${name} scored ${n}` : `${name} scored twice`));
  if (multi.length) lines.push(`${list(multi)}.`);

  const last = m.goals[m.goals.length - 1];
  if (last && m.goals.length > 1 && last.minute >= 0) {
    const decisive = Math.abs(homeScore - awayScore) <= 1 && last !== first;
    if (decisive) lines.push(`The last goal came from ${last.scorer} on ${last.minute}'.`);
  }

  if (m.mvp && (m.mvp.goals > 0 || m.mvp.assists > 0 || m.mvp.rating)) {
    const bits = [m.mvp.goals ? plural(m.mvp.goals, 'goal') : '', m.mvp.assists ? plural(m.mvp.assists, 'assist') : ''].filter(Boolean);
    lines.push(`Player of the match: ${m.mvp.name}${bits.length ? ` (${bits.join(', ')})` : ''}${m.mvp.rating ? `, rated ${Number(m.mvp.rating).toFixed(1)}` : ''}.`);
  }

  if ((m.redCards ?? 0) > 0) lines.push(`${plural(m.redCards as number, 'red card')} changed the complexion of the game.`);
  else if ((m.homeCards ?? 0) + (m.awayCards ?? 0) >= 5) lines.push(`A feisty game: ${(m.homeCards ?? 0) + (m.awayCards ?? 0)} yellow cards were shown.`);

  return lines.join(' ');
}
