from datetime import datetime, timedelta, timezone

import pytest

from app.services.betting_odds import (
    next_goal_probs, payout, price_markets, remaining_fraction, result_probs, settle_result, team_rates,
    to_odds, total_goals_probs,
)
from app.services.match_clock import elapsed_seconds, regular_time_seconds


def test_probabilities_sum_to_one_and_favour_the_stronger_side():
    p = result_probs(0, 0, 2.5, 1.0)
    assert sum(p.values()) == pytest.approx(1)
    assert p["HOME"] > p["DRAW"] > 0 and p["HOME"] > p["AWAY"]
    t = total_goals_probs(0, 0, 1.5, 1.5, 2.5)
    assert t["OVER"] + t["UNDER"] == pytest.approx(1)
    n = next_goal_probs(1.0, 1.0)
    assert sum(n.values()) == pytest.approx(1) and n["HOME"] == pytest.approx(n["AWAY"])


def test_a_lead_late_in_the_game_is_nearly_decided():
    early = result_probs(1, 0, 1.2, 1.2)["HOME"]
    late = result_probs(1, 0, 0.1, 0.1)["HOME"]
    assert late > 0.9 > early
    assert to_odds(late) is None  # too short to be worth offering
    assert to_odds(early) > 1.2


def test_goal_difference_matters_not_just_time():
    behind = result_probs(0, 2, 0.4, 0.4)
    assert behind["AWAY"] > 0.85


def test_odds_include_the_margin_and_are_bounded():
    assert to_odds(0.5) == round(1 / (0.5 * 1.08), 2)
    assert to_odds(0.0001) == 40.0
    assert to_odds(0) is None


def test_team_rates_shrink_towards_the_league_average():
    hot = team_rates({"played": 1, "gf": 6, "ga": 0}, {"played": 1, "gf": 0, "ga": 6}, league_avg=2)
    cold = team_rates({"played": 10, "gf": 60, "ga": 0}, {"played": 10, "gf": 0, "ga": 60}, league_avg=2)
    assert hot[0] < cold[0] <= 6.0  # one blowout moves the price less than ten
    assert team_rates({}, {}, None) == (1.3, 1.3)


def test_pricing_every_market_and_time_decay():
    start = price_markets(0, 0, 2.0, 1.5, 1.0)
    assert set(start) == {"MATCH_RESULT", "TOTAL_GOALS", "NEXT_GOAL"}
    assert all(v is not None for v in start["MATCH_RESULT"].values())
    end = price_markets(2, 1, 2.0, 1.5, 0.0)
    assert end["NEXT_GOAL"]["NONE"] is None  # certain, so not offered
    assert remaining_fraction(0, 1200) == 1 and remaining_fraction(1500, 1200) == 0


def test_payout_rounds_down_to_whole_coins():
    assert payout(100, 2.25) == 225 and payout(33, 1.5) == 49


def test_settlement_is_derived_from_the_goal_list():
    goals = ["HOME", "AWAY", "AWAY"]
    assert settle_result("NEXT_GOAL", {"goal_no": 2}, 1, 2, goals, False) == "AWAY"
    assert settle_result("NEXT_GOAL", {"goal_no": 4}, 1, 2, goals, False) is None  # still waiting for goal 4
    assert settle_result("NEXT_GOAL", {"goal_no": 4}, 1, 2, goals, True) == "NONE"  # the match ended first
    assert settle_result("MATCH_RESULT", {}, 1, 2, goals, False) is None
    assert settle_result("MATCH_RESULT", {}, 1, 2, goals, True) == "AWAY"
    assert settle_result("MATCH_RESULT", {}, 2, 2, goals, True) == "DRAW"
    assert settle_result("TOTAL_GOALS", {"line": 2.5}, 1, 2, goals, False) == "OVER"  # already beaten
    assert settle_result("TOTAL_GOALS", {"line": 2.5}, 1, 1, goals[:2], False) is None
    assert settle_result("TOTAL_GOALS", {"line": 2.5}, 1, 1, goals[:2], True) == "UNDER"
    # undoing a goal changes the answer, which is why settlement is recomputed rather than cached
    assert settle_result("NEXT_GOAL", {"goal_no": 3}, 1, 1, goals[:2], False) is None


def test_server_clock_matches_the_browser_rules():
    t0 = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    settings = {"first_half_minutes": 10, "second_half_minutes": 10}
    live = {"match_state": "LIVE", "half_started_at": t0.isoformat()}
    assert elapsed_seconds(live, settings, t0 + timedelta(seconds=125)) == 125
    second = {"match_state": "SECOND_HALF", "half_started_at": (t0 + timedelta(minutes=15)).isoformat()}
    assert elapsed_seconds(second, settings, t0 + timedelta(minutes=15, seconds=30)) == 630  # 10 min base + 30 s
    paused = {"match_state": "HALF_TIME", "half_started_at": t0.isoformat(), "paused_at": (t0 + timedelta(minutes=10)).isoformat()}
    assert elapsed_seconds(paused, settings, t0 + timedelta(hours=3)) == 600  # frozen while paused
    assert elapsed_seconds({"match_state": "SCHEDULED"}, settings) == 0
    custom = {"match_state": "LIVE", "half_started_at": t0.isoformat(), "metadata": {"first_half_minutes": 5, "second_half_minutes": 5}}
    assert regular_time_seconds(settings, custom) == 600
