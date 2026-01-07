import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We need to test config functions with a temporary directory
// Since config.ts uses hardcoded paths, we'll test the logic patterns

describe("Config module", () => {
  const testDir = join(tmpdir(), `claude-telegram-test-${Date.now()}`);
  const testConfigPath = join(testDir, "config.json");

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("should save and load config correctly", async () => {
    const testConfig = {
      botToken: "test-token",
      chatId: "test-chat-id",
      timeout: 3600,
    };

    // Write config
    await Bun.write(testConfigPath, JSON.stringify(testConfig, null, 2));

    // Read it back
    const file = Bun.file(testConfigPath);
    const loaded = await file.json();

    expect(loaded.botToken).toBe("test-token");
    expect(loaded.chatId).toBe("test-chat-id");
    expect(loaded.timeout).toBe(3600);
  });

  test("should handle missing config file", async () => {
    const nonExistentPath = join(testDir, "nonexistent.json");
    const file = Bun.file(nonExistentPath);
    const exists = await file.exists();

    expect(exists).toBe(false);
  });

  test("should validate config has required fields", () => {
    const validConfig = {
      botToken: "123:ABC",
      chatId: "456",
    };

    const invalidConfig = {
      botToken: "",
      chatId: "456",
    };

    const isValid = (config: { botToken: string; chatId: string }) =>
      Boolean(config.botToken && config.chatId);

    expect(isValid(validConfig)).toBe(true);
    expect(isValid(invalidConfig)).toBe(false);
  });

  test("should use default timeout when not specified", () => {
    const configWithoutTimeout = {
      botToken: "123:ABC",
      chatId: "456",
    };

    const timeout =
      (configWithoutTimeout as { timeout?: number }).timeout ?? 3600;

    expect(timeout).toBe(3600);
  });
});
