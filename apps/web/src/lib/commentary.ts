/** One readable line per event for people following the match. Pure, so wording is covered by tests. */
const KEY_TYPES = new Set(['GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'FOUL', 'SAVE', 'CORNER', 'FREE_KICK']);

export function isKeyEvent(type: string, result?: string | null): boolean {
  return KEY_TYPES.has(type) || (type === 'SHOT');
}

export function commentary(type: string, actor?: string | null, target?: string | null, result?: string | null): string {
  const a = actor || 'A player';
  const t = target || 'a team-mate';
  const shot: Record<string, string> = {
    GOAL: `GOAL! ${a} scores`,
    SAVED: `${a} forces a save`,
    BLOCKED: `${a}'s shot is blocked`,
    OFF_TARGET: `${a} fires wide`,
    WOODWORK: `${a} hits the woodwork!`,
  };
  switch (type) {
    case 'SHOT': return shot[result || ''] || `${a} takes a shot`;
    case 'PASS': return `${a} finds ${t}`;
    case 'CROSS': return `${a} whips in a cross${target ? ` for ${target}` : ''}`;
    case 'DRIBBLE': return `${a} goes past a marker`;
    case 'TACKLE': return target ? `${a} wins the ball from ${target}` : `${a} makes a tackle`;
    case 'INTERCEPTION': return `${a} cuts out the pass`;
    case 'BLOCK': return `${a} gets in the way`;
    case 'BALL_RECOVERY': return `${a} wins it back`;
    case 'CLEARANCE': return `${a} clears the danger`;
    case 'SAVE': return `${a} makes a save`;
    case 'AERIAL_DUEL': return `${a} wins the header`;
    case 'GREAT_FIRST_TOUCH': return `Lovely first touch from ${a}`;
    case 'CORNER': return `Corner taken by ${a}`;
    case 'FREE_KICK': return `${a} takes the free kick`;
    case 'FOUL': return `${a} brings down ${target || 'an opponent'}`;
    case 'YELLOW_CARD': return `${a} is shown a yellow card`;
    case 'RED_CARD': return `${a} is sent off!`;
    case 'SUBSTITUTION': return `${t} replaces ${a}`;
    default: return `${type.replace(/_/g, ' ').toLowerCase()} by ${a}`;
  }
}
