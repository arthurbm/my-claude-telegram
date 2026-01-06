import type {
  TelegramConfig,
  TelegramApiResponse,
  TelegramMessage,
  TelegramUpdate,
  SendMessageParams,
  InlineKeyboardMarkup,
  UserResponse,
} from "./types";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

export class TelegramClient {
  private baseUrl: string;
  private chatId: string;
  private timeout: number;
  private lastUpdateId: number = 0;

  constructor(config: TelegramConfig) {
    this.baseUrl = `${TELEGRAM_API_BASE}${config.botToken}`;
    this.chatId = config.chatId;
    this.timeout = config.timeout;
  }

  private async apiCall<T>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data: TelegramApiResponse<T> = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result as T;
  }

  async sendMessage(
    text: string,
    replyMarkup?: InlineKeyboardMarkup
  ): Promise<TelegramMessage> {
    const params: SendMessageParams = {
      chat_id: this.chatId,
      text,
      parse_mode: "HTML",
    };

    if (replyMarkup) {
      params.reply_markup = replyMarkup;
    }

    return this.apiCall<TelegramMessage>("sendMessage", params);
  }

  async editMessageReplyMarkup(
    messageId: number,
    replyMarkup?: InlineKeyboardMarkup
  ): Promise<TelegramMessage | boolean> {
    return this.apiCall<TelegramMessage | boolean>("editMessageReplyMarkup", {
      chat_id: this.chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    });
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string
  ): Promise<boolean> {
    return this.apiCall<boolean>("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    });
  }

  async getUpdates(offset?: number, timeout = 30): Promise<TelegramUpdate[]> {
    return this.apiCall<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout,
      allowed_updates: ["message", "callback_query"],
    });
  }

  async clearPendingUpdates(): Promise<void> {
    const updates = await this.getUpdates(undefined, 0);
    if (updates.length > 0) {
      this.lastUpdateId = updates[updates.length - 1].update_id + 1;
    }
  }

  async sendNotificationWithButtons(
    text: string,
    includeReplyButton = true
  ): Promise<TelegramMessage> {
    const buttons = [
      [
        { text: "Approve", callback_data: "approve" },
        { text: "Deny", callback_data: "deny" },
      ],
    ];

    if (includeReplyButton) {
      buttons.push([
        { text: "Skip", callback_data: "skip" },
        { text: "Reply", callback_data: "reply" },
      ]);
    }

    return this.sendMessage(text, { inline_keyboard: buttons });
  }

  async sendSimpleNotification(text: string): Promise<TelegramMessage> {
    return this.sendMessage(text);
  }

  async waitForResponse(
    sentMessageId: number,
    timeoutSeconds?: number
  ): Promise<UserResponse> {
    const timeout = timeoutSeconds ?? this.timeout;
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;
    let waitingForText = false;

    // Clear any pending updates first
    await this.clearPendingUpdates();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const updates = await this.getUpdates(this.lastUpdateId, 5);

        for (const update of updates) {
          this.lastUpdateId = update.update_id + 1;

          // Handle callback query (button press)
          if (update.callback_query) {
            const callbackData = update.callback_query.data;
            const callbackMessageId = update.callback_query.message?.message_id;

            // Only process callbacks for our message
            if (callbackMessageId === sentMessageId) {
              await this.answerCallbackQuery(update.callback_query.id);

              // Remove buttons after response
              await this.editMessageReplyMarkup(sentMessageId, undefined);

              if (callbackData === "approve") {
                return { type: "approve" };
              } else if (callbackData === "deny") {
                return { type: "deny" };
              } else if (callbackData === "skip") {
                return { type: "skip" };
              } else if (callbackData === "reply") {
                waitingForText = true;
                await this.sendMessage(
                  "Type your response (or /cancel to cancel):"
                );
              }
            }
          }

          // Handle text message (reply)
          if (update.message?.text && waitingForText) {
            const text = update.message.text;

            if (text === "/cancel") {
              return { type: "skip" };
            }

            return { type: "text", content: text };
          }
        }
      } catch (error) {
        // Network error, retry after a short delay
        await Bun.sleep(1000);
      }
    }

    return { type: "timeout" };
  }

  async testConnection(): Promise<boolean> {
    try {
      const me = await this.apiCall<{ username: string }>("getMe");
      return !!me.username;
    } catch {
      return false;
    }
  }
}

export function createApprovalKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Approve", callback_data: "approve" },
        { text: "Deny", callback_data: "deny" },
      ],
      [
        { text: "Skip", callback_data: "skip" },
        { text: "Reply", callback_data: "reply" },
      ],
    ],
  };
}
