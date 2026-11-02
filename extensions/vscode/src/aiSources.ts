// "AtoAxis: Manage AI Log Sources" — list the local AI tools whose logs the CLI can
// read and turn each one on or off.
//
// The CLI owns the state (`wakaclock ai sources list|enable|disable --json`); this
// module only shapes its JSON into a picker and runs the toggle. It takes its
// dependencies as arguments so it can be tested without the extension host.

/** One row of `wakaclock ai sources list --json`. Paths are never included. */
export interface AiSourceSummary {
  agent: string;
  enabled: boolean;
  source_kind: string;
  sources: number;
  time_mode: "counted" | "time_neutral" | string;
  dry_run_edits?: {
    count: number;
    lines_added: number;
    lines_deleted: number;
    latest_at?: string | null;
  };
  /** Present on CLIs that keep 24-hour sync counters; older CLIs omit it. */
  last_24h?: Partial<Record<
    "budget_hits" | "source_busy" | "sync_lock_skips" | "parser_panics" | "schema_unknown",
    number
  >>;
}

/** Thrown when the installed CLI predates `wakaclock ai sources`. */
export class AiSourcesUnsupportedError extends Error {
  constructor() {
    super(
      "This AtoAxis CLI cannot manage AI log sources yet. Update the AtoAxis extension or CLI and try again.",
    );
    this.name = "AiSourcesUnsupportedError";
  }
}

export const AI_SOURCES_PRIVACY_NOTE =
  "Only metadata and counts are read: no prompts, code or diffs leave this machine.";

export function parseAiSources(stdout: string): AiSourceSummary[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    throw new Error("wakaclock ai sources list returned invalid JSON");
  }
  const sources = (parsed as { sources?: unknown } | null)?.sources;
  if (!Array.isArray(sources)) {
    throw new Error("wakaclock ai sources list returned an unexpected shape");
  }
  return sources.filter(
    (row): row is AiSourceSummary =>
      typeof row === "object" &&
      row !== null &&
      typeof (row as AiSourceSummary).agent === "string" &&
      typeof (row as AiSourceSummary).enabled === "boolean",
  );
}

export interface AiSourcePickItem {
  label: string;
  description: string;
  detail?: string;
  agent: string;
  enabled: boolean;
}

const PROBLEM_LABELS: Array<[keyof NonNullable<AiSourceSummary["last_24h"]>, string]> = [
  ["budget_hits", "out of time"],
  ["source_busy", "database busy"],
  ["parser_panics", "reader crashed"],
  ["schema_unknown", "unknown format"],
];

/** Picker rows: tools found on this machine first, then by name. */
export function aiSourcePickItems(sources: AiSourceSummary[]): AiSourcePickItem[] {
  return [...sources]
    .sort((a, b) =>
      Number(b.sources > 0) - Number(a.sources > 0) || a.agent.localeCompare(b.agent),
    )
    .map((source) => {
      const found =
        source.sources > 0
          ? `${source.sources} source${source.sources === 1 ? "" : "s"}`
          : "not found on this machine";
      const mode =
        source.time_mode === "counted" ? "edits counted" : "token usage only";
      const details: string[] = [];
      if (source.time_mode !== "counted" && source.dry_run_edits?.count) {
        const edits = source.dry_run_edits;
        details.push(
          `${edits.count} edit${edits.count === 1 ? "" : "s"} kept on this machine (+${edits.lines_added} −${edits.lines_deleted})`,
        );
      }
      const problems = PROBLEM_LABELS.flatMap(([key, label]) => {
        const count = source.last_24h?.[key] ?? 0;
        return count > 0 ? [`${label} ${count}`] : [];
      });
      if (problems.length > 0) {
        details.push(`Last 24h: ${problems.join(", ")}`);
      }
      return {
        label: `${source.enabled ? "$(check)" : "$(circle-slash)"} ${source.agent}`,
        description: `${source.enabled ? "on" : "off"} · ${mode} · ${found}`,
        detail: details.length > 0 ? details.join(" · ") : undefined,
        agent: source.agent,
        enabled: source.enabled,
      };
    });
}

export interface ManageAiSourcesDeps {
  listAiSources(): Promise<AiSourceSummary[]>;
  setAiSourceEnabled(agent: string, enabled: boolean): Promise<void>;
  pick(items: AiSourcePickItem[], placeHolder: string): Promise<AiSourcePickItem | undefined>;
  showInformation(message: string): Promise<unknown>;
  showError(message: string): Promise<unknown>;
}

/** Show the tools, toggle the one picked. Returns the toggled agent, if any. */
export async function manageAiSources(deps: ManageAiSourcesDeps): Promise<string | undefined> {
  let sources: AiSourceSummary[];
  try {
    sources = await deps.listAiSources();
  } catch (error) {
    await deps.showError(error instanceof Error ? error.message : "Unable to list AI log sources.");
    return undefined;
  }
  if (sources.length === 0) {
    await deps.showInformation("This AtoAxis CLI has no local AI log readers.");
    return undefined;
  }
  const picked = await deps.pick(
    aiSourcePickItems(sources),
    `Pick a tool to turn reading its local logs on or off. ${AI_SOURCES_PRIVACY_NOTE}`,
  );
  if (!picked) {
    return undefined;
  }
  const enable = !picked.enabled;
  try {
    await deps.setAiSourceEnabled(picked.agent, enable);
  } catch (error) {
    await deps.showError(
      error instanceof Error ? error.message : `Unable to change ${picked.agent}.`,
    );
    return undefined;
  }
  await deps.showInformation(
    enable
      ? `Reading ${picked.agent} logs from now on. Earlier history is not uploaded.`
      : `Stopped reading ${picked.agent} logs. Nothing more is read until you turn it back on.`,
  );
  return picked.agent;
}
