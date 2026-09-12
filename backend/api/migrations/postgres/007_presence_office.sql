BEGIN;
CREATE TABLE IF NOT EXISTS presence_profiles (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 appearance JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS presence_messages (
 id UUID PRIMARY KEY, room_id UUID NOT NULL REFERENCES presence_rooms(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,
 body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(room_id,user_id,request_id)
);
CREATE INDEX IF NOT EXISTS presence_messages_page ON presence_messages(room_id, id DESC);
CREATE TABLE IF NOT EXISTS presence_reactions (
 id UUID PRIMARY KEY, room_id UUID NOT NULL REFERENCES presence_rooms(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, emoji TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS presence_reactions_recent ON presence_reactions(room_id, created_at);
CREATE TABLE IF NOT EXISTS presence_sprints (
 id UUID PRIMARY KEY, room_id UUID NOT NULL REFERENCES presence_rooms(id) ON DELETE CASCADE,
 created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL CHECK(char_length(title) BETWEEN 1 AND 160),
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(), ends_at TIMESTAMPTZ NOT NULL,
 finished_at TIMESTAMPTZ, CHECK(ends_at > started_at)
);
CREATE TABLE IF NOT EXISTS presence_sprint_members (
 sprint_id UUID NOT NULL REFERENCES presence_sprints(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 completed BOOLEAN NOT NULL DEFAULT false, PRIMARY KEY(sprint_id,user_id)
);
CREATE TABLE IF NOT EXISTS presence_spaces (
 room_id UUID PRIMARY KEY REFERENCES presence_rooms(id) ON DELETE CASCADE,
 parent_id UUID NOT NULL REFERENCES presence_rooms(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('floor','meeting')), CHECK(room_id <> parent_id)
);
COMMIT;
