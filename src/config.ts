import { homedir } from "os";
import { join } from "path";
import type { TelegramConfig } from "./types";

const CONFIG_DIR = join(homedir(), ".claude-telegram");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface StoredConfig {
  botToken: string;
  chatId: string;
  timeout?: number;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export async function loadConfig(): Promise<TelegramConfig> {
  const file = Bun.file(CONFIG_FILE);

  if (!(await file.exists())) {
    throw new Error(
      `Config not found at ${CONFIG_FILE}\nRun 'bun run setup.ts' to configure.`
    );
  }

  const stored: StoredConfig = await file.json();

  if (!stored.botToken || !stored.chatId) {
    throw new Error(
      "Invalid config: missing botToken or chatId.\nRun 'bun run setup.ts' to reconfigure."
    );
  }

  return {
    botToken: stored.botToken,
    chatId: stored.chatId,
    timeout: stored.timeout ?? 3600,
    projectPath: process.cwd(),
  };
}

export async function saveConfig(config: StoredConfig): Promise<void> {
  const { mkdir } = await import("fs/promises");
  await mkdir(CONFIG_DIR, { recursive: true });
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function configExists(): Promise<boolean> {
  return await Bun.file(CONFIG_FILE).exists();
}
