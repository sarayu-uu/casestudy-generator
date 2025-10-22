import fs from "node:fs/promises";
import path from "node:path";

const TOKEN_ALLOWANCE = Number(process.env.GOOGLE_GEMINI_TOKEN_ALLOWANCE ?? 50000);
const STORAGE_FILE = path.join(process.cwd(), "token-usage.json");

type TokenUsageState = {
  used: number;
  history: Array<{
    timestamp: string;
    tokens: number;
    topic: string;
  }>;
};

async function ensureStorageFile(): Promise<void> {
  try {
    await fs.access(STORAGE_FILE);
  } catch {
    const initialState: TokenUsageState = { used: 0, history: [] };
    await fs.writeFile(STORAGE_FILE, JSON.stringify(initialState, null, 2), "utf8");
  }
}

async function readState(): Promise<TokenUsageState> {
  await ensureStorageFile();
  const data = await fs.readFile(STORAGE_FILE, "utf8");
  try {
    return JSON.parse(data) as TokenUsageState;
  } catch {
    return { used: 0, history: [] };
  }
}

async function writeState(state: TokenUsageState): Promise<void> {
  await fs.writeFile(STORAGE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function getTokenSnapshot() {
  const state = await readState();
  const remaining = Math.max(0, TOKEN_ALLOWANCE - state.used);
  return {
    allowance: TOKEN_ALLOWANCE,
    used: state.used,
    remaining,
  };
}

export async function recordTokenUsage(amount: number, topic: string) {
  if (Number.isNaN(amount) || amount <= 0) {
    return getTokenSnapshot();
  }

  const state = await readState();
  const updatedUsed = state.used + amount;

  state.used = updatedUsed;
  state.history.unshift({
    timestamp: new Date().toISOString(),
    tokens: Math.round(amount),
    topic,
  });
  state.history = state.history.slice(0, 20);

  await writeState(state);
  return {
    allowance: TOKEN_ALLOWANCE,
    used: state.used,
    remaining: Math.max(0, TOKEN_ALLOWANCE - state.used),
  };
}
