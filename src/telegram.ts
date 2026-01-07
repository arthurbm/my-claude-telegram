import type {
  InlineKeyboardMarkup,
  SendMessageParams,
  TelegramApiResponse,
  TelegramConfig,
  TelegramMessage,
  TelegramUpdate,
  UserResponse,
} from "./types";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

export class TelegramClient {
  private readonly baseUrl: string;
  private readonly chatId: string;
  private readonly timeout: number;
  private lastUpdateId = 0;

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

    const data = (await response.json()) as TelegramApiResponse<T>;

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result as T;
  }

  sendMessage(
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

    return this.apiCall<TelegramMessage>("sendMessage", { ...params });
  }

  editMessageReplyMarkup(
    messageId: number,
    replyMarkup?: InlineKeyboardMarkup
  ): Promise<TelegramMessage | boolean> {
    return this.apiCall<TelegramMessage | boolean>("editMessageReplyMarkup", {
      chat_id: this.chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    });
  }

  answerCallbackQuery(
    callbackQueryId: string,
    text?: string
  ): Promise<boolean> {
    return this.apiCall<boolean>("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    });
  }

  getUpdates(offset?: number, timeout = 30): Promise<TelegramUpdate[]> {
    return this.apiCall<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout,
      allowed_updates: ["message", "callback_query"],
    });
  }

  async clearPendingUpdates(): Promise<void> {
    const updates = await this.getUpdates(undefined, 0);
    const lastUpdate = updates.at(-1);
    if (lastUpdate) {
      this.lastUpdateId = lastUpdate.update_id + 1;
    }
  }

  sendNotificationWithButtons(
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

  sendSimpleNotification(text: string): Promise<TelegramMessage> {
    return this.sendMessage(text);
  }

  private async handleCallbackQuery(
    update: TelegramUpdate,
    sentMessageId: number
  ): Promise<UserResponse | "wait_for_text" | null> {
    if (!update.callback_query) {
      return null;
    }

    const callbackData = update.callback_query.data;
    const callbackMessageId = update.callback_query.message?.message_id;

    if (callbackMessageId !== sentMessageId) {
      return null;
    }

    await this.answerCallbackQuery(update.callback_query.id);
    await this.editMessageReplyMarkup(sentMessageId, undefined);

    if (callbackData === "approve") {
      return { type: "approve" };
    }
    if (callbackData === "deny") {
      return { type: "deny" };
    }
    if (callbackData === "skip") {
      return { type: "skip" };
    }
    if (callbackData === "reply") {
      await this.sendMessage("Type your response (or /cancel to cancel):");
      return "wait_for_text";
    }

    return null;
  }

  private handleTextMessage(
    update: TelegramUpdate,
    waitingForText: boolean
  ): UserResponse | null {
    if (!(update.message?.text && waitingForText)) {
      return null;
    }

    const text = update.message.text;

    if (text === "/cancel") {
      return { type: "skip" };
    }

    return { type: "text", content: text };
  }

  private async processUpdates(
    updates: TelegramUpdate[],
    sentMessageId: number,
    waitingForText: boolean
  ): Promise<{ response: UserResponse | null; waitingForText: boolean }> {
    let currentWaitingForText = waitingForText;

    for (const update of updates) {
      this.lastUpdateId = update.update_id + 1;

      const callbackResult = await this.handleCallbackQuery(
        update,
        sentMessageId
      );
      if (callbackResult === "wait_for_text") {
        currentWaitingForText = true;
      } else if (callbackResult) {
        return {
          response: callbackResult,
          waitingForText: currentWaitingForText,
        };
      }

      const textResult = this.handleTextMessage(update, currentWaitingForText);
      if (textResult) {
        return { response: textResult, waitingForText: currentWaitingForText };
      }
    }

    return { response: null, waitingForText: currentWaitingForText };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async waitForResponse(
    sentMessageId: number,
    timeoutSeconds?: number
  ): Promise<UserResponse> {
    const timeout = timeoutSeconds ?? this.timeout;
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;
    let waitingForText = false;

    await this.clearPendingUpdates();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const updates = await this.getUpdates(this.lastUpdateId, 5);
        const result = await this.processUpdates(
          updates,
          sentMessageId,
          waitingForText
        );

        if (result.response) {
          return result.response;
        }
        waitingForText = result.waitingForText;
      } catch {
        await this.sleep(1000);
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
