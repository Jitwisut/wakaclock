#!/usr/bin/env python3
"""Remove the local test data created while redesigning the dashboard and Presence.

Scope is fixed to six test accounts (listed below) and what they own: their personal
organizations, "UX Rhythm Test Org" and its team, their Presence rooms, the seeded
co-working sessions, their heartbeats/rollups, and their Redis presence keys.
Nothing else is touched.

Default is a DRY RUN that only counts rows. Pass --apply to delete.

    make infra-up
    python3 scripts/cleanup-ux-test-data.py          # dry run
    python3 scripts/cleanup-ux-test-data.py --apply  # delete

Local development only: it talks to the docker-compose containers directly.
"""
import json
import subprocess
import sys

POSTGRES = ["docker", "exec", "-i", "wakaclock-postgres-1", "psql", "-U", "wakaclock", "-d", "wakaclock", "-v", "ON_ERROR_STOP=1", "-At"]
CLICKHOUSE = ["docker", "exec", "-i", "wakaclock-clickhouse-1", "clickhouse-client", "-d", "wakaclock"]
REDIS = ["docker", "exec", "-i", "wakaclock-redis-1", "redis-cli"]

TEST_USERS = {
    "uxtest1790611114": "01a0e8bd-4d8c-7d30-8de4-337c317680e7",
    "uxmate1790626761": "01a0e9ac-0d88-73d3-a730-0c47ff2c65a6",
    "uxpair1790630564": "01a0e9e6-134b-77b3-9fc8-d900bd5b42e3",
    "uxreview1790630564": "01a0e9e6-1424-7532-b968-103e78f3fbc3",
    "uxinvitee1790669702": "01a0ec3b-4605-7c62-8c22-c78f3dce09c0",
    "uxjoiner1790669833": "01a0ec3d-477f-7df2-9fe2-8ddcb8a97f79",
}
TEST_ORG = "01a0e9e6-1432-70a2-8453-427e688d8932"  # "UX Rhythm Test Org"

APPLY = "--apply" in sys.argv


def run(cmd, sql=None):
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"command failed: {' '.join(cmd[:4])}\n{result.stderr.strip()}")
    return result.stdout.strip()


def pg(sql):
    return run(POSTGRES, sql)


def ch(sql):
    return run(CLICKHOUSE + ["-q", sql])


def uuid_list(ids):
    return ", ".join(f"'{value}'" for value in ids)


def load_seeded_room():
    try:
        with open(
            "/private/tmp/claude-501/-Users-jitwisutthobut-Desktop-wakaclock/"
            "0a81b4d0-6793-47c1-88b4-39195d645f5d/scratchpad/rhythm_room.json"
        ) as handle:
            return json.load(handle)["room"]
    except (OSError, KeyError, ValueError):
        return None


def main():
    users = list(TEST_USERS.values())
    users_sql = uuid_list(users)

    # Sanity check: every id must still belong to the expected test username, so the
    # script can never be pointed at a real account by a stale id.
    rows = pg(f"SELECT id, username FROM users WHERE id IN ({users_sql})")
    found = dict(line.split("|") for line in rows.splitlines() if line)
    for username, user_id in TEST_USERS.items():
        if user_id in found and found[user_id] != username:
            raise SystemExit(f"refusing: {user_id} is {found[user_id]}, expected {username}")
    print(f"Test accounts present in PostgreSQL: {len(found)}/{len(users)}")

    orgs = pg(
        f"SELECT id FROM organizations WHERE id = '{TEST_ORG}' "
        f"OR personal_owner_id IN ({users_sql})"
    ).split()
    orgs_sql = uuid_list(orgs) or "NULL"
    teams = pg(f"SELECT id FROM teams WHERE organization_id IN ({orgs_sql})").split()
    teams_sql = uuid_list(teams) or "NULL"
    rooms = pg(
        f"SELECT id FROM presence_rooms WHERE owner_user_id IN ({users_sql}) "
        f"OR team_id IN ({teams_sql})"
    ).split()
    seeded = load_seeded_room()
    if seeded:
        rooms.append(seeded)
    rooms_sql = uuid_list(rooms) or "NULL"
    print(f"Organizations: {len(orgs)}  teams: {len(teams)}  presence rooms: {len(rooms)}")

    # ClickHouse: every table in the database that has a user_id column, plus the
    # co-working sessions of the test rooms.
    tables = ch(
        "SELECT table FROM system.columns WHERE database = 'wakaclock' AND name = 'user_id' "
        "AND table IN (SELECT name FROM system.tables WHERE database = 'wakaclock' "
        "AND engine LIKE '%MergeTree%')"
    ).split()
    plan = []
    for table in tables:
        count = int(ch(f"SELECT count() FROM {table} WHERE user_id IN ({users_sql})") or 0)
        if count:
            plan.append((table, f"user_id IN ({users_sql})", count))
    sessions = int(ch(f"SELECT count() FROM coworking_sessions WHERE room_id IN ({rooms_sql})") or 0)
    if sessions:
        plan.append(("coworking_sessions", f"room_id IN ({rooms_sql})", sessions))
        plan.append((
            "coworking_session_participants",
            f"session_id IN (SELECT session_id FROM coworking_sessions WHERE room_id IN ({rooms_sql}))",
            int(ch(
                "SELECT count() FROM coworking_session_participants WHERE session_id IN "
                f"(SELECT session_id FROM coworking_sessions WHERE room_id IN ({rooms_sql}))"
            ) or 0),
        ))
    print("ClickHouse rows to delete:")
    for table, _, count in plan:
        print(f"  {table}: {count}")

    redis_keys = []
    for user_id in users:
        redis_keys += run(REDIS + ["--scan", "--pattern", f"presence:user:{user_id}*"]).split()
    for room in rooms:
        redis_keys += run(REDIS + ["--scan", "--pattern", f"presence:room:{room}:*"]).split()
    print(f"Redis presence keys to delete: {len(redis_keys)}")

    if not APPLY:
        print("\nDry run only. Re-run with --apply to delete the rows above.")
        return

    # Order: Redis (ephemeral), then ClickHouse sessions before their participants
    # table is emptied, then PostgreSQL in one transaction so a foreign-key surprise
    # rolls everything there back instead of leaving half an account.
    if redis_keys:
        run(REDIS + ["DEL", *redis_keys])
    participants = [p for p in plan if p[0] == "coworking_session_participants"]
    others = [p for p in plan if p[0] != "coworking_session_participants"]
    for table, where, _ in participants + others:
        ch(f"ALTER TABLE {table} DELETE WHERE {where} SETTINGS mutations_sync = 1")
    pg(
        "BEGIN;\n"
        f"DELETE FROM presence_rooms WHERE id IN ({rooms_sql});\n"
        f"DELETE FROM organizations WHERE id IN ({orgs_sql});\n"
        f"DELETE FROM users WHERE id IN ({users_sql});\n"
        "COMMIT;\n"
    )
    print("Deleted.")


if __name__ == "__main__":
    main()
