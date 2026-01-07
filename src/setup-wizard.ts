import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { configExists, getConfigPath, saveConfig } from "./config";
import { TelegramClient } from "./telegram";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

function printHeader(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         Claude Code Telegram Notifier - Setup             ║
╚═══════════════════════════════════════════════════════════╝
`);
}

function printStep(step: number, total: number, message: string): void {
  console.log(`\n[${step}/${total}] ${message}`);
  console.log("─".repeat(50));
}

async function getBotToken(): Promise<string> {
  console.log(`
To create a Telegram bot:
1. Open Telegram and search for @BotFather
2. Send /newbot command
3. Choose a name (e.g., "Claude Code Notifier")
4. Choose a username (must end in 'bot', e.g., "my_claude_notifier_bot")
5. Copy the token provided
`);

  const token = await prompt("Paste your bot token: ");

  if (!token?.includes(":")) {
    throw new Error(
      "Invalid token format. Should be like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
    );
  }

  return token;
}

async function getChatId(botToken: string): Promise<string> {
  console.log(`
To get your Chat ID:
1. Open a chat with your new bot in Telegram
2. Send any message to the bot (e.g., "hello")
3. Press Enter here after sending the message
`);

  await prompt("Press Enter after sending a message to your bot...");

  console.log("\nFetching chat ID...");

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates`
    );
    const data = (await response.json()) as {
      ok: boolean;
      result?: Array<{
        message?: { chat?: { id?: number } };
        callback_query?: { message?: { chat?: { id?: number } } };
      }>;
    };

    if (data.ok && data.result && data.result.length > 0) {
      const lastUpdate = data.result.at(-1);
      const chatId = lastUpdate
        ? (lastUpdate.message?.chat?.id?.toString() ??
          lastUpdate.callback_query?.message?.chat?.id?.toString())
        : undefined;

      if (chatId) {
        console.log(`Found chat ID: ${chatId}`);
        return chatId;
      }
    }

    console.log("\nCouldn't detect chat ID automatically.");
    return await prompt("Enter your chat ID manually: ");
  } catch (error) {
    console.error("Error fetching updates:", error);
    return await prompt("Enter your chat ID manually: ");
  }
}

async function testConnection(
  botToken: string,
  chatId: string
): Promise<boolean> {
  console.log("\nTesting connection...");

  const client = new TelegramClient({
    botToken,
    chatId,
    timeout: 30,
    projectPath: process.cwd(),
  });

  try {
    await client.sendSimpleNotification(
      "<b>Claude Code Telegram</b>\n\nSetup successful! You will receive notifications here."
    );
    return true;
  } catch (error) {
    console.error("Failed to send test message:", (error as Error).message);
    return false;
  }
}

async function installHooks(): Promise<boolean> {
  console.log("\nConfiguring Claude Code hooks...");

  // Use claude-telegram command (works for both npm install and binary)
  const command = "claude-telegram";

  const hooksConfig = {
    Notification: [
      {
        matcher: "permission_prompt",
        hooks: [
          {
            type: "command",
            command,
            timeout: 3600,
          },
        ],
      },
    ],
    Stop: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: `${command} --event=stop`,
            timeout: 30,
          },
        ],
      },
    ],
  };

  try {
    const settingsFile = Bun.file(CLAUDE_SETTINGS_PATH);
    let settings: Record<string, unknown> = {};

    if (await settingsFile.exists()) {
      settings = await settingsFile.json();
    }

    const existingHooks = (settings.hooks as Record<string, unknown[]>) ?? {};

    settings.hooks = {
      ...existingHooks,
      ...hooksConfig,
    };

    await mkdir(join(homedir(), ".claude"), { recursive: true });
    await Bun.write(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));

    console.log(`Hooks installed in: ${CLAUDE_SETTINGS_PATH}`);
    return true;
  } catch (error) {
    console.error("Failed to install hooks:", (error as Error).message);
    return false;
  }
}

export async function runSetupWizard(): Promise<void> {
  printHeader();

  if (await configExists()) {
    const reconfigure = await prompt(
      "Configuration already exists. Reconfigure? (y/N): "
    );
    if (reconfigure.toLowerCase() !== "y") {
      console.log("Setup cancelled.");
      return;
    }
  }

  printStep(1, 4, "Create Telegram Bot");
  const botToken = await getBotToken();

  printStep(2, 4, "Get Chat ID");
  const chatId = await getChatId(botToken);

  printStep(3, 4, "Test Connection");
  const connected = await testConnection(botToken, chatId);

  if (!connected) {
    console.error("\nFailed to connect. Please check your token and chat ID.");
    process.exit(1);
  }

  console.log("Connection successful!");

  printStep(4, 4, "Save Configuration");

  await saveConfig({
    botToken,
    chatId,
    timeout: 3600,
  });
  console.log(`Config saved to: ${getConfigPath()}`);

  const installHooksAnswer = await prompt(
    "\nInstall Claude Code hooks automatically? (Y/n): "
  );

  if (installHooksAnswer.toLowerCase() !== "n") {
    await installHooks();
  }

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    Setup Complete!                         ║
╚═══════════════════════════════════════════════════════════╝

You're all set! Claude Code will now send you Telegram
notifications when it needs your approval.

To test manually:
  claude-telegram --test

To reconfigure:
  claude-telegram --setup

To uninstall:
  claude-telegram --uninstall
`);
}
