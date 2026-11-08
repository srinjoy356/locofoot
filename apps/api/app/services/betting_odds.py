"""Pure odds maths for the virtual-coin predictions game. No I/O: every number is reproducible from its inputs."""
from math import exp, factorial
from typing import Optional

MARGIN = 0.08  # the house edge, so coins drain slowly from pure guessing and skill is rewarded
MIN_ODDS, MAX_ODDS = 1.05, 40.0
MAX_GOALS = 14
LEAGUE_DEFAULT_GOALS = 1.3  # goals per team per match when nothing has been played yet


def poisson_pmf(k: int, lam: float) -> float:
    return exp(-lam) * lam ** k / factorial(k) if lam > 0 else (1.0 if k == 0 else 0.0)


def team_rates(home: dict, away: dict, league_avg: Optional[float] = None, shrink: float = 2.0) -> tuple[float, float]:
    """
    Expected goals for the whole match. `home`/`away` = {"played", "gf", "ga"} from completed matches.
    Attack and defence are shrunk towards the league average so one 6-0 game does not make a team unbeatable.
    """
    avg = league_avg if league_avg else LEAGUE_DEFAULT_GOALS

    def strength(t: dict) -> tuple[float, float]:
        n = t.get("played", 0)
        return (t.get("gf", 0) + shrink * avg) / (n + shrink), (t.get("ga", 0) + shrink * avg) / (n + shrink)

    h_att, h_def = strength(home)
    a_att, a_def = strength(away)
    clamp = lambda v: max(0.3, min(6.0, v))
    return clamp((h_att + a_def) / 2), clamp((a_att + h_def) / 2)


def remaining_fraction(elapsed_s: float, total_s: float) -> float:
    return 1.0 if total_s <= 0 else max(0.0, min(1.0, 1 - elapsed_s / total_s))


def outcome_grid(goals_h: int, goals_a: int, lam_h: float, lam_a: float):
    """Yield (final_home, final_away, probability) for every combination of remaining goals."""
    for i in range(MAX_GOALS + 1):
        pi = poisson_pmf(i, lam_h)
        for j in range(MAX_GOALS + 1):
            yield goals_h + i, goals_a + j, pi * poisson_pmf(j, lam_a)


def result_probs(goals_h: int, goals_a: int, lam_h_rem: float, lam_a_rem: float) -> dict[str, float]:
    p = {"HOME": 0.0, "DRAW": 0.0, "AWAY": 0.0}
    for fh, fa, pr in outcome_grid(goals_h, goals_a, lam_h_rem, lam_a_rem):
        p["HOME" if fh > fa else "AWAY" if fa > fh else "DRAW"] += pr
    total = sum(p.values())
    return {k: v / total for k, v in p.items()}


def total_goals_probs(goals_h: int, goals_a: int, lam_h_rem: float, lam_a_rem: float, line: float) -> dict[str, float]:
    over = sum(pr for fh, fa, pr in outcome_grid(goals_h, goals_a, lam_h_rem, lam_a_rem) if fh + fa > line)
    total = sum(pr for _, _, pr in outcome_grid(goals_h, goals_a, lam_h_rem, lam_a_rem))
    return {"OVER": over / total, "UNDER": 1 - over / total}


def next_goal_probs(lam_h_rem: float, lam_a_rem: float) -> dict[str, float]:
    both = lam_h_rem + lam_a_rem
    if both <= 0:
        return {"HOME": 0.0, "AWAY": 0.0, "NONE": 1.0}
    any_goal = 1 - exp(-both)
    return {"HOME": lam_h_rem / both * any_goal, "AWAY": lam_a_rem / both * any_goal, "NONE": 1 - any_goal}


def to_odds(prob: float, margin: float = MARGIN) -> Optional[float]:
    """Decimal odds including the margin, or None when the outcome is so settled that betting it is pointless."""
    if prob <= 0:
        return None
    odds = 1 / (prob * (1 + margin))
    if odds < MIN_ODDS:
        return None
    return round(min(odds, MAX_ODDS), 2)


def price_markets(goals_h: int, goals_a: int, lam_h: float, lam_a: float, frac_left: float, total_line: float = 2.5) -> dict:
    """Current odds for every market of a match, as {market_kind: {selection: odds | None}}."""
    h, a = lam_h * frac_left, lam_a * frac_left
    return {
        "MATCH_RESULT": {k: to_odds(v) for k, v in result_probs(goals_h, goals_a, h, a).items()},
        "TOTAL_GOALS": {k: to_odds(v) for k, v in total_goals_probs(goals_h, goals_a, h, a, total_line).items()},
        "NEXT_GOAL": {k: to_odds(v) for k, v in next_goal_probs(h, a).items()},
    }


def payout(stake: int, odds: float) -> int:
    return int(stake * odds)  # whole coins, rounded down


def settle_result(kind: str, params: dict, final_h: int, final_a: int, goals_in_order: list[str], match_over: bool) -> Optional[str]:
    """
    Winning selection for a market, or None while it is still undecided.
    goals_in_order: 'HOME'/'AWAY' for each goal, earliest first. Recomputable from the timeline at any time.
    """
    if kind == "NEXT_GOAL":
        n = int(params["goal_no"])
        if len(goals_in_order) >= n:
            return goals_in_order[n - 1]
        return "NONE" if match_over else None
    if not match_over:
        if kind == "TOTAL_GOALS" and final_h + final_a > float(params["line"]):
            return "OVER"  # over is already guaranteed, no need to wait for the whistle
        return None
    if kind == "MATCH_RESULT":
        return "HOME" if final_h > final_a else "AWAY" if final_a > final_h else "DRAW"
    if kind == "TOTAL_GOALS":
        return "OVER" if final_h + final_a > float(params["line"]) else "UNDER"
    raise ValueError(kind)
