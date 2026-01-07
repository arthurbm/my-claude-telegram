// ============================================
// Claude Code Hook Input Types
// ============================================

export interface ClaudeHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  // Notification-specific fields
  message?: string;
  notification_type?:
    | "permission_prompt"
    | "idle_prompt"
    | "auth_success"
    | "elicitation_dialog";
  // Tool-related fields
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  tool_use_id?: string;
  // Stop hook fields
  stop_hook_active?: boolean;
}

export interface ClaudeHookOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: "approve" | "block";
  reason?: string;
}

// ============================================
// Telegram API Types
// ============================================

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  timeout: number; // in seconds
  projectPath: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  reply_to_message?: TelegramMessage;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  chat_instance: string;
  data?: string;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageParams {
  chat_id: string | number;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: InlineKeyboardMarkup;
  disable_notification?: boolean;
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

// ============================================
// Application Types
// ============================================

export type UserResponse =
  | { type: "approve" }
  | { type: "deny" }
  | { type: "skip" }
  | { type: "text"; content: string }
  | { type: "timeout" };

export interface NotificationContext {
  projectName: string;
  gitBranch?: string;
  eventType: string;
  message: string;
  toolName?: string;
}
