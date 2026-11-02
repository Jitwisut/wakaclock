-- Persist the causal observation predecessor before a subscription request.
-- NULL means no prior observed state, not permission to adopt an arbitrary one.
ALTER TABLE team_subscription_cancellation_exchanges
  ADD COLUMN IF NOT EXISTS previous_observation_id UUID;
