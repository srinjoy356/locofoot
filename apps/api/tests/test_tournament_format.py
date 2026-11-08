import pytest

from app.services.tournament_format import (
    build_knockout, knockout_entrants, rank_teams, resolve_source, round_robin, split_groups,
)


def m(h, a, hs, as_, **kw):
    return {"home_registration_id": h, "away_registration_id": a, "home_score": hs, "away_score": as_,
            "match_state": "COMPLETED", "winner_registration_id": None, **kw}


def test_round_robin_counts():
    assert len(round_robin(list("ABCD"))) == 6
    assert len(round_robin(list("ABCDE"))) == 10  # odd count uses byes
    assert len(round_robin(list("ABCD"), double=True)) == 12
    assert len({frozenset(p) for p in round_robin(list("ABCDEF"))}) == 15


def test_split_groups_is_balanced_snake():
    groups = split_groups([str(i) for i in range(1, 9)], 2)
    assert groups == [["1", "4", "5", "8"], ["2", "3", "6", "7"]]
    assert [len(g) for g in split_groups(list("ABCDEFG"), 3)] == [3, 2, 2]


def test_knockout_two_groups_cross_over_with_third_place():
    specs = build_knockout(knockout_entrants(["gA", "gB"], 2), third_place=True)
    assert [s["key"] for s in specs] == ["SF-1", "SF-2", "FINAL-1", "THIRD_PLACE-1"]
    sf1, sf2, final, third = specs
    assert (sf1["home"]["group_id"], sf1["home"]["position"]) == ("gA", 1)
    assert (sf1["away"]["group_id"], sf1["away"]["position"]) == ("gB", 2)
    assert (sf2["home"]["group_id"], sf2["home"]["position"]) == ("gB", 1)
    assert final["home"] == {"type": "winner_of", "key": "SF-1"}
    assert third["home"] == {"type": "loser_of", "key": "SF-1"}


def test_knockout_four_groups_no_same_group_round_one():
    specs = build_knockout(knockout_entrants(["A", "B", "C", "D"], 2))
    qfs = [s for s in specs if s["round_name"] == "QF"]
    assert len(qfs) == 4
    assert all(q["home"]["group_id"] != q["away"]["group_id"] for q in qfs)


def test_knockout_byes_for_non_power_of_two():
    entrants = [{"type": "team", "registration_id": str(i)} for i in range(1, 6)]
    specs = build_knockout(entrants, third_place=True)
    assert len([s for s in specs if s["round_name"] == "QF"]) == 1  # only 4v5 plays
    sf = [s for s in specs if s["round_name"] == "SF"]
    assert len(sf) == 2 and any(s["home"]["registration_id"] == "1" for s in sf if s["home"]["type"] == "team")
    assert specs[-1]["round_name"] == "THIRD_PLACE"
    assert sum(1 for s in specs if s["round_name"] == "FINAL") == 1


def test_knockout_three_teams_has_no_third_place():
    entrants = [{"type": "team", "registration_id": str(i)} for i in range(3)]
    assert not any(s["round_name"] == "THIRD_PLACE" for s in build_knockout(entrants, third_place=True))


def test_rank_teams_points_gd_and_head_to_head():
    ids = ["A", "B", "C"]
    # All three finish on 3 pts, GD 0, GF 1: H2H among the tied trio is also level, so order falls to id.
    table = rank_teams(ids, [m("A", "B", 1, 0), m("B", "C", 1, 0), m("C", "A", 1, 0)])
    assert [r["team_id"] for r in table] == ["A", "B", "C"]
    # B beats A, A beats C, C draws B: points A3 B4 C1 -> B first
    table = rank_teams(ids, [m("B", "A", 2, 0), m("A", "C", 1, 0), m("C", "B", 1, 1)])
    assert [r["team_id"] for r in table] == ["B", "A", "C"]
    assert table[0]["points"] == 4 and table[0]["gd"] == 2


def test_rank_teams_head_to_head_breaks_tie():
    # A and B level on points/GD/GF overall; A beat B directly.
    ms = [m("A", "B", 1, 0), m("B", "C", 1, 0), m("C", "A", 1, 0), m("A", "D", 0, 0), m("B", "D", 0, 0)]
    table = rank_teams(["A", "B", "C", "D"], ms)
    assert [r["team_id"] for r in table[:2]] == ["A", "B"]


def test_resolve_source():
    ctx = {"matches": {"m1": m("A", "B", 1, 1, winner_registration_id="B"), "m2": m("A", "B", 2, 1),
                       "m3": {**m("A", "B", 0, 0), "match_state": "SCHEDULED"}, "m4": m("A", "B", 0, 0)},
           "group_tables": {"g": [{"team_id": "X"}, {"team_id": "Y"}], "open": None}}
    assert resolve_source({"type": "winner_of", "match_id": "m1"}, ctx) == "B"  # manual decision wins
    assert resolve_source({"type": "loser_of", "match_id": "m2"}, ctx) == "B"
    assert resolve_source({"type": "winner_of", "match_id": "m3"}, ctx) is None  # not played
    assert resolve_source({"type": "winner_of", "match_id": "m4"}, ctx) is None  # undecided draw
    assert resolve_source({"type": "group_position", "group_id": "g", "position": 2}, ctx) == "Y"
    assert resolve_source({"type": "group_position", "group_id": "open", "position": 1}, ctx) is None
    assert resolve_source({"type": "group_position", "group_id": "g", "position": 3}, ctx) is None


def first_round_clashes(group_ids, advance):
    specs = build_knockout(knockout_entrants(group_ids, advance))
    first = [sp for sp in specs if sp["home"].get("type") == "group_position" and sp["away"].get("type") == "group_position"]
    return [(s["home"]["group_id"], s["away"]["group_id"]) for s in first if s["home"]["group_id"] == s["away"]["group_id"]]


@pytest.mark.parametrize("groups,advance", [(2, 2), (3, 2), (4, 2), (5, 2), (6, 2), (3, 1), (8, 1), (4, 3)])
def test_group_winners_and_runners_up_avoid_each_other_in_round_one(groups, advance):
    ids = [f"g{i}" for i in range(groups)]
    # a rematch is only unavoidable when a group supplies more qualifiers than there are other groups to meet
    if advance <= groups:
        assert first_round_clashes(ids, advance) == []


def test_three_groups_with_byes_still_resolve_every_slot():
    specs = build_knockout(knockout_entrants(["A", "B", "C"], 2), third_place=True)
    assert [s["round_name"] for s in specs].count("QF") == 2  # 6 teams: two quarter-finals, two byes
    keys = {s["key"] for s in specs}
    for s in specs:
        for side in (s["home"], s["away"]):
            assert side["type"] in ("group_position", "winner_of", "loser_of")
            if side["type"] != "group_position":
                assert side["key"] in keys
