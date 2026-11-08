import { describe, it, expect } from 'vitest';
import { matchStory } from '../../src/lib/matchStory';

const base = { homeName: 'Hawks', awayName: 'Lions', goals: [] as any[] };

describe('matchStory', () => {
  it('reports a goalless draw', () => {
    expect(matchStory({ ...base, homeScore: 0, awayScore: 0 })).toBe('Hawks and Lions played out a goalless draw.');
  });

  it('tells a close thriller with scorers, hat-trick and player of the match', () => {
    const story = matchStory({
      ...base, homeScore: 4, awayScore: 3,
      goals: [
        { team: 'home', scorer: 'Ada', minute: 3 }, { team: 'away', scorer: 'Bo', minute: 6 }, { team: 'home', scorer: 'Ada', minute: 9 },
        { team: 'away', scorer: 'Cy', minute: 12 }, { team: 'home', scorer: 'Ada', minute: 14 }, { team: 'away', scorer: 'Bo', minute: 16 },
        { team: 'home', scorer: 'Dee', minute: 18 },
      ],
      mvp: { name: 'Ada', rating: 9.1, goals: 3, assists: 0 },
    });
    expect(story).toContain('Hawks edged a 7-goal thriller against Lions, 4-3.');
    expect(story).toContain('Ada opened the scoring for Hawks on 3\'.');
    expect(story).toContain('Ada bagged a hat-trick');
    expect(story).toContain('Bo scored twice');
    expect(story).toContain('The last goal came from Dee on 18\'.');
    expect(story).toContain('Player of the match: Ada (3 goals), rated 9.1.');
  });

  it('describes margins and draws', () => {
    expect(matchStory({ ...base, homeScore: 1, awayScore: 5 })).toContain('Lions routed Hawks 5-1.');
    expect(matchStory({ ...base, homeScore: 2, awayScore: 2 })).toContain('shared 4 goals in a 2-2 draw');
    expect(matchStory({ ...base, homeScore: 1, awayScore: 0 })).toContain('Hawks won a tight one against Lions, 1-0.');
  });

  it('mentions red cards and rowdy games', () => {
    expect(matchStory({ ...base, homeScore: 0, awayScore: 0, redCards: 1 })).toContain('1 red card changed');
    expect(matchStory({ ...base, homeScore: 0, awayScore: 0, homeCards: 3, awayCards: 2 })).toContain('5 yellow cards');
  });
});
