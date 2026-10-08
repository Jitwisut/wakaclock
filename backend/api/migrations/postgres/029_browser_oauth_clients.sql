-- Public device-flow clients: no distributable browser package contains a client secret.
INSERT INTO oauth_apps
    (id, owner_user_id, organization_id, name, client_id, client_secret_hash, is_confidential)
VALUES
    ('019c91f4-4c3e-7b31-a102-3a5f9d0b7e11', NULL, NULL, 'AtoAxis Browser (Chrome, Edge, Brave)', 'atoaxis_browser_chromium', NULL, FALSE),
    ('019c91f4-4c3e-7b31-a102-3a5f9d0b7e12', NULL, NULL, 'AtoAxis Browser (Firefox)', 'atoaxis_browser_firefox', NULL, FALSE),
    ('019c91f4-4c3e-7b31-a102-3a5f9d0b7e13', NULL, NULL, 'AtoAxis Browser (Safari)', 'atoaxis_browser_safari', NULL, FALSE)
ON CONFLICT (client_id) DO NOTHING;
