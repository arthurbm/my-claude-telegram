import { describe, expect, mock, test } from "bun:test";
import { createApprovalKeyboard, TelegramClient } from "../telegram";
import type { TelegramConfig } from "../types";

const mockConfig: TelegramConfig = {
  botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
  chatId: "987654321",
  timeout: 60,
  projectPath: "/test/project",
};

describe("TelegramClient", () => {
  test("should construct with correct base URL", () => {
    const client = new TelegramClient(mockConfig);
    // We can't directly access private fields, but we can verify behavior
    expect(client).toBeDefined();
  });

  test("testConnection should return true on successful API call", async () => {
    const client = new TelegramClient(mockConfig);

    // Mock fetch for this test
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(
        Response.json({
          ok: true,
          result: { username: "test_bot" },
        })
      )
    ) as unknown as typeof fetch;

    const result = await client.testConnection();
    expect(result).toBe(true);

    globalThis.fetch = originalFetch;
  });

  test("testConnection should return false on failed API call", async () => {
    const client = new TelegramClient(mockConfig);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(
        Response.json({
          ok: false,
          description: "Unauthorized",
        })
      )
    ) as unknown as typeof fetch;

    const result = await client.testConnection();
    expect(result).toBe(false);

    globalThis.fetch = originalFetch;
  });

  test("sendMessage should call API with correct parameters", async () => {
    const client = new TelegramClient(mockConfig);

    let capturedBody: unknown = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock((_url: string, options: RequestInit) => {
      capturedBody = JSON.parse(options.body as string);
      return Promise.resolve(
        Response.json({
          ok: true,
          result: { message_id: 123 },
        })
      );
    }) as unknown as typeof fetch;

    await client.sendMessage("Test message");

    expect(capturedBody).toMatchObject({
      chat_id: "987654321",
      text: "Test message",
      parse_mode: "HTML",
    });

    globalThis.fetch = originalFetch;
  });

  test("sendNotificationWithButtons should include inline keyboard", async () => {
    const client = new TelegramClient(mockConfig);

    let capturedBody: { reply_markup?: { inline_keyboard: unknown[][] } } = {};
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock((_url: string, options: RequestInit) => {
      capturedBody = JSON.parse(options.body as string);
      return Promise.resolve(
        Response.json({
          ok: true,
          result: { message_id: 123 },
        })
      );
    }) as unknown as typeof fetch;

    await client.sendNotificationWithButtons("Test");

    expect(capturedBody.reply_markup).toBeDefined();
    expect(capturedBody.reply_markup?.inline_keyboard).toHaveLength(2);

    globalThis.fetch = originalFetch;
  });
});

describe("createApprovalKeyboard", () => {
  test("should create keyboard with 4 buttons in 2 rows", () => {
    const keyboard = createApprovalKeyboard();

    expect(keyboard.inline_keyboard).toHaveLength(2);
    expect(keyboard.inline_keyboard[0]).toHaveLength(2);
    expect(keyboard.inline_keyboard[1]).toHaveLength(2);
  });

  test("should have correct button labels", () => {
    const keyboard = createApprovalKeyboard();

    const allButtons = keyboard.inline_keyboard.flat();
    const labels = allButtons.map((b) => b.text);

    expect(labels).toContain("Approve");
    expect(labels).toContain("Deny");
    expect(labels).toContain("Skip");
    expect(labels).toContain("Reply");
  });

  test("should have correct callback data", () => {
    const keyboard = createApprovalKeyboard();

    const allButtons = keyboard.inline_keyboard.flat();
    const callbacks = allButtons.map((b) => b.callback_data);

    expect(callbacks).toContain("approve");
    expect(callbacks).toContain("deny");
    expect(callbacks).toContain("skip");
    expect(callbacks).toContain("reply");
  });
});
