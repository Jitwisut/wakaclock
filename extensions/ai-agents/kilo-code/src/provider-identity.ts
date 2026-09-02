/** Canonical provider labels. Client identity is intentionally handled elsewhere. */
export function normalizeProvider(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().toLowerCase();
  if (!value) return undefined;
  const compact = value.replace(/[^a-z0-9]/g, "");
  if (["openai", "openaiapi", "apiopenaicom"].includes(compact)) return "openai";
  if (["anthropic", "anthropicapi", "apianthropiccom"].includes(compact)) return "anthropic";
  if (["moonshot", "moonshotai", "kimi", "kimiapi", "apimoonshotcn"].includes(compact)) {
    return "moonshot";
  }
  if (["deepseek", "deepseekapi", "apideepseekcom"].includes(compact)) return "deepseek";
  if (["google", "googleai", "gemini"].includes(compact)) return "google";
  if (["github", "githubcopilot"].includes(compact)) return "github";
  const normalized = value.replace(/[ _]+/g, "-");
  return /^[a-z0-9][a-z0-9./-]{0,127}$/.test(normalized) ? normalized : undefined;
}

export function normalizeModel(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:/+[\]-]{0,255}$/.test(value) ? value : undefined;
}
