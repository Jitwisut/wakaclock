BEGIN;

-- UUIDv4 is only needed by the idempotent backfill below. New application rows use UUIDv7.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS presence_rooms (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('team', 'adhoc')),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    expires_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((kind = 'team' AND team_id IS NOT NULL AND expires_at IS NULL)
        OR (kind = 'adhoc' AND team_id IS NULL AND owner_user_id IS NOT NULL AND expires_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS presence_rooms_active_team_idx
    ON presence_rooms(team_id) WHERE kind = 'team' AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS presence_rooms_owner_idx
    ON presence_rooms(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS presence_room_zones (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES presence_rooms(id) ON DELETE CASCADE,
    label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    center_x DOUBLE PRECISION NOT NULL CHECK (center_x BETWEEN 0 AND 100),
    center_y DOUBLE PRECISION NOT NULL CHECK (center_y BETWEEN 0 AND 100),
    width DOUBLE PRECISION NOT NULL CHECK (width > 0 AND width <= 100),
    height DOUBLE PRECISION NOT NULL CHECK (height > 0 AND height <= 100),
    UNIQUE (room_id, sort_order),
    UNIQUE (room_id, label)
);

CREATE TABLE IF NOT EXISTS presence_room_grants (
    room_id UUID NOT NULL REFERENCES presence_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS presence_room_invites (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES presence_rooms(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presence_room_invites_room_idx
    ON presence_room_invites(room_id, created_at DESC);

-- Backfill one durable room and three fixed zones for every existing PostgreSQL team.
INSERT INTO presence_rooms (id, kind, team_id, name)
SELECT gen_random_uuid(), 'team', t.id, t.name
FROM teams t
WHERE NOT EXISTS (
    SELECT 1 FROM presence_rooms r WHERE r.team_id = t.id AND r.ended_at IS NULL
);

INSERT INTO presence_room_zones (id, room_id, label, sort_order, center_x, center_y, width, height)
SELECT gen_random_uuid(), r.id, z.label, z.sort_order, z.center_x, z.center_y, z.width, z.height
FROM presence_rooms r
CROSS JOIN (VALUES
    ('Pairing Table A', 0, 25.0, 30.0, 22.0, 24.0),
    ('Pairing Table B', 1, 75.0, 30.0, 22.0, 24.0),
    ('Pairing Table C', 2, 50.0, 72.0, 22.0, 24.0)
) AS z(label, sort_order, center_x, center_y, width, height)
WHERE NOT EXISTS (
    SELECT 1 FROM presence_room_zones existing
    WHERE existing.room_id = r.id AND existing.sort_order = z.sort_order
);

COMMIT;
