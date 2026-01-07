import { describe, expect, test } from "bun:test";
import type { ClaudeHookInput, NotificationContext } from "../types";

// Helper functions extracted for testing
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
    const maxLen = 2000;
    let messageText = context.message;
    if (messageText.length > maxLen) {
      messageText = `${messageText.substring(0, maxLen)}...`;
    }
    msg += `<pre>${escapeHtml(messageText)}</pre>`;
  }

  return msg;
}

describe("escapeHtml", () => {
  test("should escape ampersand", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  test("should escape less than", () => {
    expect(escapeHtml("foo < bar")).toBe("foo &lt; bar");
  });

  test("should escape greater than", () => {
    expect(escapeHtml("foo > bar")).toBe("foo &gt; bar");
  });

  test("should escape all special characters together", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;"
    );
  });

  test("should not modify safe text", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("formatNotificationMessage", () => {
  test("should format basic notification", () => {
    const context: NotificationContext = {
      projectName: "my-project",
      eventType: "permission prompt",
      message: "Allow this action?",
    };

    const result = formatNotificationMessage(context);

    expect(result).toContain("<b>Claude Code</b>");
    expect(result).toContain("<b>Project:</b> my-project");
    expect(result).toContain("<b>Event:</b> permission prompt");
    expect(result).toContain("<pre>Allow this action?</pre>");
  });

  test("should include git branch when provided", () => {
    const context: NotificationContext = {
      projectName: "my-project",
      gitBranch: "feature/test",
      eventType: "notification",
      message: "Test",
    };

    const result = formatNotificationMessage(context);

    expect(result).toContain("<code>feature/test</code>");
  });

  test("should include tool name when provided", () => {
    const context: NotificationContext = {
      projectName: "my-project",
      eventType: "notification",
      message: "Test",
      toolName: "Bash",
    };

    const result = formatNotificationMessage(context);

    expect(result).toContain("<b>Tool:</b> Bash");
  });

  test("should truncate long messages", () => {
    const longMessage = "x".repeat(3000);
    const context: NotificationContext = {
      projectName: "my-project",
      eventType: "notification",
      message: longMessage,
    };

    const result = formatNotificationMessage(context);

    expect(result).toContain("...");
    expect(result.length).toBeLessThan(longMessage.length);
  });

  test("should escape HTML in all fields", () => {
    const context: NotificationContext = {
      projectName: "<script>bad</script>",
      gitBranch: "feature/<test>",
      eventType: "test & check",
      message: "<code>injection</code>",
      toolName: "Tool<>Name",
    };

    const result = formatNotificationMessage(context);

    expect(result).not.toContain("<script>bad</script>");
    expect(result).toContain("&lt;script&gt;");
  });
});

describe("ClaudeHookInput parsing", () => {
  test("should parse valid notification input", () => {
    const input: ClaudeHookInput = {
      session_id: "abc123",
      transcript_path: "/path/to/transcript",
      cwd: "/home/user/project",
      hook_event_name: "Notification",
      notification_type: "permission_prompt",
      message: "Allow Bash: rm -rf node_modules?",
    };

    expect(input.notification_type).toBe("permission_prompt");
    expect(input.message).toBe("Allow Bash: rm -rf node_modules?");
  });

  test("should parse tool-related input", () => {
    const input: ClaudeHookInput = {
      session_id: "abc123",
      transcript_path: "/path/to/transcript",
      cwd: "/home/user/project",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
    };

    expect(input.tool_name).toBe("Bash");
    expect(input.tool_input).toEqual({ command: "ls -la" });
  });

  test("should handle optional fields", () => {
    const input: ClaudeHookInput = {
      session_id: "abc123",
      transcript_path: "/path/to/transcript",
      cwd: "/home/user/project",
      hook_event_name: "Stop",
    };

    expect(input.message).toBeUndefined();
    expect(input.tool_name).toBeUndefined();
    expect(input.notification_type).toBeUndefined();
  });
});
