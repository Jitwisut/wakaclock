import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AiAgentsTable } from '@/components/wakaclock/ai-agents-table';
import type { ActorType, AiAgentItem } from '@/lib/wakaclock/types';

function agent(actor_type: ActorType, overrides: Partial<AiAgentItem> = {}): AiAgentItem {
  return {
    actor_type,
    agent: 'codex',
    provider: 'openai',
    model: 'gpt-5.6-sol',
    ai_lines_added: 10,
    ai_lines_deleted: 2,
    human_lines_added: 0,
    human_lines_deleted: 0,
    unknown_lines_added: 0,
    unknown_lines_deleted: 0,
    unattributed_lines_added: 0,
    unattributed_lines_deleted: 0,
    heartbeat_count: 5,
    ...overrides,
  };
}

describe('AiAgentsTable', () => {
  it('names the agent for verified AI evidence', () => {
    render(<AiAgentsTable agents={[agent('ai_verified', { agent: 'claude-code' })]} />);

    expect(screen.getByText('claude-code')).toBeInTheDocument();
    expect(screen.getByText('openai / gpt-5.6-sol')).toBeInTheDocument();
  });

  it('never names an agent for inferred evidence', () => {
    // Inference proves *an* AI acted, never *which* one — the backend already
    // redacts the identity, and this is the guard that it is not rendered even if
    // a historical row still carries one.
    render(<AiAgentsTable agents={[agent('ai_inferred', { agent: 'codex' })]} />);

    expect(screen.getByText('Unattributed AI')).toBeInTheDocument();
    expect(screen.queryByText('codex')).not.toBeInTheDocument();
    expect(screen.queryByText('openai / gpt-5.6-sol')).not.toBeInTheDocument();
  });

  it('keeps the inferred row and its counts rather than hiding it', () => {
    // Hiding the row would stop these counts reconciling with the "AI inferred"
    // share rendered above the table.
    render(
      <AiAgentsTable agents={[agent('ai_inferred', { ai_lines_added: 42, heartbeat_count: 7 })]} />
    );

    expect(screen.getByText('AI inferred')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('leaves human rows untouched', () => {
    render(<AiAgentsTable agents={[agent('human', { agent: 'human' })]} />);

    // "Human" is both the actor and the agent label here, so assert on the count
    // rather than a single match.
    expect(screen.getAllByText('Human')).toHaveLength(2);
    expect(screen.queryByText('Unattributed AI')).not.toBeInTheDocument();
  });

  it('labels unknown authorship and does not render an unknown identity pair', () => {
    render(
      <AiAgentsTable
        agents={[
          agent('unknown', {
            agent: 'unknown',
            provider: 'unknown',
            model: 'unknown',
            heartbeat_count: 2,
          }),
        ]}
      />
    );

    expect(screen.getAllByText('Unknown authorship')).toHaveLength(2);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('unknown / unknown')).not.toBeInTheDocument();
  });

  it('keeps verified provider and model labels independent when one is missing', () => {
    render(
      <AiAgentsTable
        agents={[
          agent('ai_verified', { provider: null, model: 'gpt-5.6-sol' }),
          agent('ai_verified', { provider: 'openai', model: null }),
        ]}
      />
    );

    expect(screen.getByText('Provider not reported / gpt-5.6-sol')).toBeInTheDocument();
    expect(screen.getByText('openai / Model not reported')).toBeInTheDocument();
  });
});
