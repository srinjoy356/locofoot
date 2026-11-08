"""Pure tournament-format maths: no I/O, so every rule here is unit-testable and recomputable."""
from typing import Optional

KNOCKOUT_ROUND_NAMES = {1: "FINAL", 2: "SF", 4: "QF", 8: "R16", 16: "R32"}


def round_robin(ids: list[str], double: bool = False) -> list[tuple[str, str]]:
    """Circle-method pairings, ordered round by round. `double` adds the reverse fixtures."""
    teams: list[Optional[str]] = list(ids)
    if len(teams) < 2:
        return []
    if len(teams) % 2:
        teams.append(None)  # bye
    n = len(teams)
    pairs: list[tuple[str, str]] = []
    for _ in range(n - 1):
        for i in range(n // 2):
            home, away = teams[i], teams[n - 1 - i]
            if home is not None and away is not None:
                pairs.append((home, away))
        teams.insert(1, teams.pop())
    return pairs + [(a, h) for h, a in pairs] if double else pairs


def split_groups(ids: list[str], group_count: int) -> list[list[str]]:
    """Snake-distribute teams (given in seed order) so group strength stays balanced."""
    groups: list[list[str]] = [[] for _ in range(group_count)]
    for i, team in enumerate(ids):
        lap, pos = divmod(i, group_count)
        groups[pos if lap % 2 == 0 else group_count - 1 - pos].append(team)
    return groups


def _seed_order(size: int) -> list[int]:
    order = [1]
    while len(order) < size:
        m = len(order) * 2
        order = [x for s in order for x in (s, m + 1 - s)]
    return order


def build_knockout(entrants: list[dict], third_place: bool = False) -> list[dict]:
    """
    entrants: source dicts ordered by seed (index 0 = seed 1), e.g. {"type": "group_position", ...}.
    Returns bracket specs in creation order. Each spec is
    {key, round_name, position, home, away}; home/away are entrant sources or
    {"type": "winner_of"|"loser_of", "key": <spec key>} references to earlier specs.
    Non power-of-two fields give the top seeds a first-round bye.
    """
    n = len(entrants)
    if n < 2:
        return []
    size = 1
    while size < n:
        size *= 2

    specs: list[dict] = []
    positions: dict[str, int] = {}

    def add(home: dict, away: dict, teams_in_round: int) -> dict:
        name = KNOCKOUT_ROUND_NAMES.get(teams_in_round // 2, f"R{teams_in_round}")
        positions[name] = positions.get(name, 0) + 1
        spec = {"key": f"{name}-{positions[name]}", "round_name": name,
                "position": positions[name], "home": home, "away": away}
        specs.append(spec)
        return {"type": "winner_of", "key": spec["key"]}

    order = _seed_order(size)
    feeders: list[dict] = []
    for a, b in zip(order[::2], order[1::2]):
        if b > n:  # b is a bye, seed a walks through
            feeders.append(entrants[a - 1])
        else:
            feeders.append(add(entrants[a - 1], entrants[b - 1], size))

    teams_in_round = size // 2
    while len(feeders) > 1:
        feeders = [add(feeders[i], feeders[i + 1], teams_in_round) for i in range(0, len(feeders), 2)]
        teams_in_round //= 2

    semis = [s for s in specs if s["round_name"] == "SF"]
    if third_place and len(semis) == 2:
        add_third = {"key": "THIRD_PLACE-1", "round_name": "THIRD_PLACE", "position": 1,
                     "home": {"type": "loser_of", "key": semis[0]["key"]},
                     "away": {"type": "loser_of", "key": semis[1]["key"]}}
        specs.append(add_third)
    return specs


def knockout_entrants(group_ids: list[str], advance_per_group: int) -> list[dict]:
    """
    Seed order: all group winners, then the runners-up, ... Each lower tier is tried forwards and reversed and the order
    with the fewest same-group clashes in round one wins (3 groups need the runners-up reversed, 2 or 4 do not).
    """
    def tier(p: int, reverse: bool) -> list[dict]:
        ids = group_ids[::-1] if reverse else group_ids
        return [{"type": "group_position", "group_id": g, "position": p} for g in ids]

    n = len(group_ids) * advance_per_group
    size = 1
    while size < n:
        size *= 2
    pairs = list(zip(_seed_order(size)[::2], _seed_order(size)[1::2]))

    best, best_clashes = None, None
    for mask in range(2 ** max(advance_per_group - 1, 0)):
        order = tier(1, False)
        for p in range(2, advance_per_group + 1):
            order += tier(p, bool(mask >> (p - 2) & 1))
        clashes = sum(1 for a, b in pairs if b <= n and order[a - 1]["group_id"] == order[b - 1]["group_id"])
        if best is None or clashes < best_clashes:
            best, best_clashes = order, clashes
        if clashes == 0:
            break
    return best


def match_winner(match: dict) -> Optional[str]:
    """Winner registration id, honouring a manual decision for drawn knockout games."""
    if match.get("winner_registration_id"):
        return match["winner_registration_id"]
    if match["home_score"] > match["away_score"]:
        return match["home_registration_id"]
    if match["away_score"] > match["home_score"]:
        return match["away_registration_id"]
    return None


def match_loser(match: dict) -> Optional[str]:
    w = match_winner(match)
    if w is None:
        return None
    return match["away_registration_id"] if w == match["home_registration_id"] else match["home_registration_id"]


def rank_teams(ids: list[str], matches: list[dict], win: int = 3, draw: int = 1, loss: int = 0) -> list[dict]:
    """
    League table from completed matches. Order: points, goal difference, goals for,
    then head-to-head points among the still-tied teams, then id (deterministic).
    """
    rows = {i: {"team_id": i, "played": 0, "won": 0, "drawn": 0, "lost": 0, "gf": 0, "ga": 0, "gd": 0, "points": 0}
            for i in ids}
    for m in matches:
        h, a = m["home_registration_id"], m["away_registration_id"]
        if h not in rows or a not in rows:
            continue
        hs, as_ = m["home_score"], m["away_score"]
        for t, gf, ga in ((h, hs, as_), (a, as_, hs)):
            r = rows[t]
            r["played"] += 1
            r["gf"] += gf
            r["ga"] += ga
            r["gd"] = r["gf"] - r["ga"]
            if gf > ga:
                r["won"] += 1
                r["points"] += win
            elif gf == ga:
                r["drawn"] += 1
                r["points"] += draw
            else:
                r["lost"] += 1
                r["points"] += loss

    def h2h_points(team: str, tied: set[str]) -> int:
        pts = 0
        for m in matches:
            h, a = m["home_registration_id"], m["away_registration_id"]
            if team not in (h, a) or h not in tied or a not in tied:
                continue
            mine, theirs = (m["home_score"], m["away_score"]) if team == h else (m["away_score"], m["home_score"])
            pts += win if mine > theirs else draw if mine == theirs else loss
        return pts

    base = lambda r: (-r["points"], -r["gd"], -r["gf"])
    ordered = sorted(rows.values(), key=lambda r: (base(r), r["team_id"]))
    out: list[dict] = []
    i = 0
    while i < len(ordered):
        j = i
        while j < len(ordered) and base(ordered[j]) == base(ordered[i]):
            j += 1
        tied = ordered[i:j]
        if len(tied) > 1:
            ids_tied = {r["team_id"] for r in tied}
            tied.sort(key=lambda r: (-h2h_points(r["team_id"], ids_tied), r["team_id"]))
        out.extend(tied)
        i = j
    return out


def resolve_source(source: dict, ctx: dict) -> Optional[str]:
    """
    Resolve a bracket source to a registration id, or None if not yet decided.
    ctx = {"matches": {match_id: row}, "group_tables": {group_id: [ranked rows] | None}}
    where a group table is None until every group fixture is completed.
    """
    kind = source.get("type")
    if kind == "team":
        return source.get("registration_id")
    if kind in ("winner_of", "loser_of"):
        m = ctx["matches"].get(source.get("match_id"))
        if not m or m.get("match_state") != "COMPLETED":
            return None
        return match_winner(m) if kind == "winner_of" else match_loser(m)
    if kind == "group_position":
        table = ctx["group_tables"].get(source.get("group_id"))
        pos = source.get("position", 0)
        return table[pos - 1]["team_id"] if table and 0 < pos <= len(table) else None
    return None
