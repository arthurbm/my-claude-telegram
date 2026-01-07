#!/usr/bin/env bun

import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { getConfigDir, loadConfig } from "./config";
import { TelegramClient } from "./telegram";
import type {
  ClaudeHookInput,
  ClaudeHookOutput,
  NotificationContext,
  TelegramConfig,
  TelegramMessage,
} from "./types";

const VERSION = "1.0.0";
const INSTALL_PATH = "/usr/local/bin/claude-telegram";

function printHelp(): void {
  console.log(`
claude-telegram v${VERSION}

Telegram notifications for Claude Code with interactive approval buttons.

Usage:
  claude-telegram [options]

Options:
  --setup       Run the setup wizard to configure Telegram bot
  --test        Test the Telegram connection
  --uninstall   Remove the binary and configuration
  --version     Show version number
  --help        Show this help message

Examples:
  claude-telegram --setup      # Configure your Telegram bot
  claude-telegram --test       # Send a test notification
  claude-telegram              # Normal mode (called by Claude Code hooks)

Documentation: https://github.com/arthurbm/my-claude-telegram
`);
}

async function runSetup(): Promise<void> {
  // Dynamically import setup to avoid circular dependencies
  const scriptDir = dirname(Bun.main);
  const setupPath = join(scriptDir, "..", "setup.ts");

  try {
    // Try to import setup.ts relative to this file
    await import(setupPath);
  } catch {
    // If running from compiled binary, setup functions are embedded
    const { runSetupWizard } = await import("./setup-wizard");
    await runSetupWizard();
  }
}

async function runUninstall(): Promise<void> {
  console.log("Uninstalling claude-telegram...\n");

  // Remove config directory
  const configDir = getConfigDir();
  try {
    await rm(configDir, { recursive: true, force: true });
    console.log(`Removed config: ${configDir}`);
  } catch {
    console.log(`Config not found: ${configDir}`);
  }

  // Remove binary if it exists at standard location
  try {
    await rm(INSTALL_PATH, { force: true });
    console.log(`Removed binary: ${INSTALL_PATH}`);
  } catch {
    // Binary might be elsewhere or not installed via curl
  }

  // Remove hooks from Claude Code settings
  const claudeSettingsPath = join(homedir(), ".claude", "settings.json");
  try {
    const file = Bun.file(claudeSettingsPath);
    if (await file.exists()) {
      const settings = (await file.json()) as {
        hooks?: Record<string, unknown>;
      };
      if (settings.hooks) {
        settings.hooks.Notification = undefined;
        settings.hooks.Stop = undefined;
        await Bun.write(claudeSettingsPath, JSON.stringify(settings, null, 2));
        console.log(`Removed hooks from: ${claudeSettingsPath}`);
      }
    }
  } catch {
    // Settings file might not exist
  }

  console.log("\nUninstall complete!");
  console.log(
    "If installed via npm/bun, also run: bun remove -g @arthurbm/claude-telegram"
  );
}

async function getGitBranch(cwd: string): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    return output.trim() || undefined;
  } catch {
    return undefined;
  }
}

function formatNotificationMessage(context: NotificationContext): string {
  let msg = "<b>Claude Code</b>\n\n";

  msg += `<b>Project:</b> ${escapeHtml(context.projectName)}`;
  if (context.gitBranch) {
    msg += ` (<code>${escapeHtml(context.gitBranch)}</code>)`;
  }
  msg += "\n";

  if (context.toolName) {
    msg += `<b>Tool:</b> ${escapeHtml(context.toolName)}\n`;
  }

  msg += `<b>Event:</b> ${escapeHtml(context.eventType)}\n\n`;

  if (context.message) {
    // Truncate long messages
    const maxLen = 2000;
    let messageText = context.message;
    if (messageText.length > maxLen) {
      messageText = `${messageText.substring(0, maxLen)}...`;
    }
    msg += `<pre>${escapeHtml(messageText)}</pre>`;
  }

  return msg;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function readStdinJson(): Promise<ClaudeHookInput | null> {
  try {
    const stdin = await Bun.stdin.text();
    if (!stdin.trim()) {
      return null;
    }
    return JSON.parse(stdin);
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Handle help and version first (no config needed)
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    process.exit(0);
  }

  // Handle setup (no config needed)
  if (args.includes("--setup")) {
    await runSetup();
    process.exit(0);
  }

  // Handle uninstall (no config needed)
  if (args.includes("--uninstall")) {
    await runUninstall();
    process.exit(0);
  }

  const isTest = args.includes("--test");
  const isStopEvent = args.includes("--event=stop");

  // Load config
  let config: TelegramConfig;
  try {
    config = await loadConfig();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  const client = new TelegramClient(config);

  // Test mode
  if (isTest) {
    console.log("Testing Telegram connection...");
    const connected = await client.testConnection();
    if (connected) {
      await client.sendSimpleNotification(
        "<b>Claude Code Telegram</b>\n\nTest notification successful!"
      );
      console.log("Success! Check your Telegram.");
      process.exit(0);
    } else {
      console.error("Failed to connect to Telegram. Check your config.");
      process.exit(1);
    }
  }

  // Read input from stdin (Claude Code hook input)
  const input = await readStdinJson();

  // If no input, might be called directly for stop event
  const cwd = input?.cwd ?? process.cwd();
  const projectName = basename(cwd);
  const gitBranch = await getGitBranch(cwd);

  // Handle Stop event (notification only, no approval needed)
  if (isStopEvent) {
    const context: NotificationContext = {
      projectName,
      gitBranch,
      eventType: "Task Completed",
      message: "Claude has finished and is waiting for your next instruction.",
    };

    await client.sendSimpleNotification(formatNotificationMessage(context));
    process.exit(0);
  }

  // Handle Notification event (needs approval)
  if (input) {
    const notificationType = input.notification_type ?? "notification";
    const isPermissionPrompt = notificationType === "permission_prompt";

    const context: NotificationContext = {
      projectName,
      gitBranch,
      eventType: notificationType.replace(/_/g, " "),
      message: input.message ?? "",
      toolName: input.tool_name,
    };

    const formattedMessage = formatNotificationMessage(context);

    // Send notification
    let sentMessage: TelegramMessage;
    if (isPermissionPrompt) {
      sentMessage = await client.sendNotificationWithButtons(
        formattedMessage,
        true
      );
    } else {
      // For non-permission notifications, just notify without blocking
      await client.sendSimpleNotification(formattedMessage);
      process.exit(0);
    }

    // Wait for user response
    const response = await client.waitForResponse(sentMessage.message_id);

    // Process response and return to Claude Code
    const output: ClaudeHookOutput = {};

    switch (response.type) {
      case "approve":
        // Exit 0 = success, Claude proceeds
        process.exit(0);
        break;

      case "deny":
        // Exit 2 = blocking error, stderr is feedback
        console.error("User denied this action via Telegram.");
        process.exit(2);
        break;

      case "skip":
        // Just continue without feedback
        process.exit(0);
        break;

      case "text":
        // Return text response as system message
        output.systemMessage = `User response via Telegram: ${response.content}`;
        console.log(JSON.stringify(output));
        process.exit(0);
        break;

      case "timeout":
        // Timeout - deny by default for safety
        console.error(
          "Timeout waiting for response via Telegram. Action denied for safety."
        );
        process.exit(2);
        break;

      default:
        // Handle any unexpected response type
        console.error("Unexpected response type");
        process.exit(1);
    }
  }

  // No input provided
  console.error(
    "No input received. This script should be called by Claude Code hooks."
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
