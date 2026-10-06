declare const __API_URL__: string;
declare const __FAMILY__: "chromium" | "firefox" | "safari";
export const API_URL = __API_URL__;
export const FAMILY = __FAMILY__;
export const CLIENT_ID = "atoaxis_browser_" + FAMILY;
export const CHECKPOINT_MS = 60_000;
export const MAX_GAP_MS = 90_000;
export const MAX_QUEUE = 10_000;
