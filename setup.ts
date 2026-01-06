#!/usr/bin/env bun

import { saveConfig, getConfigPath, configExists } from "./src/config";
import { TelegramClient } from "./src/telegram";
import { homedir } from "os";
import { join } from "path";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

async function promptSecret(question: string): Promise<string> {
  // Note: Bun doesn't have a built-in way to hide input
  // For security, we just warn the user
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

function printHeader() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         Claude Code Telegram Notifier - Setup             ║
╚═══════════════════════════════════════════════════════════╝
`);
}

function printStep(step: number, total: number, message: string) {
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

  const token = await promptSecret("Paste your bot token: ");

  if (!token || !token.includes(":")) {
    throw new Error("Invalid token format. Should be like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz");
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

  // Try to get chat ID from recent messages
  const client = new TelegramClient({
    botToken,
    chatId: "0",
    timeout: 10,
    projectPath: process.cwd(),
  });

  console.log("\nFetching chat ID...");

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates`
    );
    const data = await response.json();

    if (data.ok && data.result?.length > 0) {
      // Get the most recent message's chat ID
      const lastUpdate = data.result[data.result.length - 1];
      const chatId =
        lastUpdate.message?.chat?.id?.toString() ??
        lastUpdate.callback_query?.message?.chat?.id?.toString();

      if (chatId) {
        console.log(`Found chat ID: ${chatId}`);
        return chatId;
      }
    }

    // If no messages found, ask for manual input
    console.log("\nCouldn't detect chat ID automatically.");
    const manualChatId = await prompt("Enter your chat ID manually: ");
    return manualChatId;
  } catch (error) {
    console.error("Error fetching updates:", error);
    const manualChatId = await prompt("Enter your chat ID manually: ");
    return manualChatId;
  }
}

async function testConnection(botToken: string, chatId: string): Promise<boolean> {
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

  const notifyScriptPath = join(process.cwd(), "src", "notify.ts");

  const hooksConfig = {
    Notification: [
      {
        matcher: "permission_prompt",
        hooks: [
          {
            type: "command",
            command: `bun run "${notifyScriptPath}"`,
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
            command: `bun run "${notifyScriptPath}" --event=stop`,
            timeout: 30,
          },
        ],
      },
    ],
  };

  try {
    // Read existing settings
    const settingsFile = Bun.file(CLAUDE_SETTINGS_PATH);
    let settings: Record<string, unknown> = {};

    if (await settingsFile.exists()) {
      settings = await settingsFile.json();
    }

    // Merge hooks
    const existingHooks = (settings.hooks as Record<string, unknown[]>) ?? {};

    // Add our hooks
    settings.hooks = {
      ...existingHooks,
      ...hooksConfig,
    };

    // Write back
    const { mkdir } = await import("fs/promises");
    await mkdir(join(homedir(), ".claude"), { recursive: true });
    await Bun.write(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));

    console.log(`Hooks installed in: ${CLAUDE_SETTINGS_PATH}`);
    return true;
  } catch (error) {
    console.error("Failed to install hooks:", (error as Error).message);
    return false;
  }
}

async function main() {
  printHeader();

  // Check if already configured
  if (await configExists()) {
    const reconfigure = await prompt(
      "Configuration already exists. Reconfigure? (y/N): "
    );
    if (reconfigure.toLowerCase() !== "y") {
      console.log("Setup cancelled.");
      process.exit(0);
    }
  }

  // Step 1: Get bot token
  printStep(1, 4, "Create Telegram Bot");
  const botToken = await getBotToken();

  // Step 2: Get chat ID
  printStep(2, 4, "Get Chat ID");
  const chatId = await getChatId(botToken);

  // Step 3: Test connection
  printStep(3, 4, "Test Connection");
  const connected = await testConnection(botToken, chatId);

  if (!connected) {
    console.error("\nFailed to connect. Please check your token and chat ID.");
    process.exit(1);
  }

  console.log("Connection successful!");

  // Step 4: Save config and install hooks
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
    const installed = await installHooks();
    if (!installed) {
      console.log("\nYou can install hooks manually later.");
    }
  }

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    Setup Complete!                         ║
╚═══════════════════════════════════════════════════════════╝

You're all set! Claude Code will now send you Telegram
notifications when it needs your approval.

To test manually:
  bun run src/notify.ts --test

To reconfigure:
  bun run setup.ts
`);
}

main().catch((error) => {
  console.error("Setup failed:", error.message);
  process.exit(1);
});
