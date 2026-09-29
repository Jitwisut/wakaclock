-- Username invites into an organization. An admin invites an existing account by
-- username; nothing about the invitee changes until they accept, because joining an
-- organization is what makes their team presence and consented analytics visible to it.
-- (organization_invites in 001 is the separate, email-token flow and is not used here.)
CREATE TABLE IF NOT EXISTS organization_user_invites (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    seat_type TEXT NOT NULL CHECK (seat_type IN ('developer', 'viewer')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ
);

-- At most one open invite per person per organization; re-inviting refreshes it.
CREATE UNIQUE INDEX IF NOT EXISTS organization_user_invites_pending_idx
    ON organization_user_invites (organization_id, invitee_user_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS organization_user_invites_invitee_idx
    ON organization_user_invites (invitee_user_id)
    WHERE status = 'pending';
