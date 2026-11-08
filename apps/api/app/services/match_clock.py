"""Server-side twin of the browser clock (useMatchClock.ts): the same inputs must give the same elapsed seconds."""
from datetime import datetime, timezone
from typing import Optional


def _dt(v) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(v).replace("Z", "+00:00"))


def half_minutes(settings: dict, match: dict) -> tuple[int, int]:
    first = (settings or {}).get("first_half_minutes") or 45
    second = (settings or {}).get("second_half_minutes") or 45
    meta = (match or {}).get("metadata") or {}
    if isinstance(meta.get("first_half_minutes"), (int, float)):
        first = meta["first_half_minutes"]
    if isinstance(meta.get("second_half_minutes"), (int, float)):
        second = meta["second_half_minutes"]
    return int(first), int(second)


def elapsed_seconds(match: dict, settings: dict, now: Optional[datetime] = None) -> int:
    start = _dt(match.get("half_started_at"))
    if start is None:
        return 0
    now = now or datetime.now(timezone.utc)
    state = match.get("match_state")
    first, second = half_minutes(settings, match)
    base = {
        "SECOND_HALF": first * 60,
        "EXTRA_TIME_1": (first + second) * 60,
        "EXTRA_TIME_2": int((first + second + ((settings or {}).get("extra_time_minutes") or 0) / 2) * 60),
    }.get(state, 0)
    if state in ("PAUSED", "HALF_TIME", "FULL_TIME") and match.get("paused_at"):
        return int((_dt(match["paused_at"]) - start).total_seconds()) + base
    return int((now - start).total_seconds()) + base


def regular_time_seconds(settings: dict, match: dict) -> int:
    first, second = half_minutes(settings, match)
    return (first + second) * 60
