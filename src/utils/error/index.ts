import * as TelegramBot from "node-telegram-bot-api";
import { sendSafeHTML } from "../formatting";
import logger from "../logger";

// Custom error types
export enum ErrorType {
  DATABASE = "DATABASE",
  TELEGRAM_API = "TELEGRAM_API",
  USER_INPUT = "USER_INPUT",
  PERMISSION = "PERMISSION",
  COOLDOWN = "COOLDOWN",
  INTERNAL = "INTERNAL",
}

// Error details interface
export interface ErrorDetails {
  type: ErrorType;
  message: string;
  originalError?: Error;
  userId?: number;
  chatId?: number | string;
  messageId?: number;
  context?: Record<string, any>;
}

/**
 * Log an error with standardized formatting
 */
export function logError(details: ErrorDetails): void {
  const { type, message, originalError, userId, chatId, context } = details;

  logger.error(`[${type}] ${message}`, originalError, {
    userId,
    chatId,
    context,
  });
}

/**
 * Handle an error and optionally send a user-friendly message
 */
export async function handleError(
  bot: TelegramBot,
  details: ErrorDetails,
  sendUserMessage: boolean = true
): Promise<void> {
  // Only log errors that are not permission or cooldown related
  if (
    details.type !== ErrorType.PERMISSION &&
    details.type !== ErrorType.COOLDOWN
  ) {
    logError(details);
  }

  // Send user-friendly message if requested and chatId exists
  if (sendUserMessage && details.chatId) {
    let userMessage: string;

    switch (details.type) {
      case ErrorType.COOLDOWN:
        userMessage = `⏳ ${details.message}`;
        break;
      case ErrorType.PERMISSION:
        userMessage = `🚫 ${details.message}`;
        break;
      case ErrorType.USER_INPUT:
        userMessage = `⚠️ ${details.message}`;
        break;
      case ErrorType.DATABASE:
      case ErrorType.TELEGRAM_API:
      case ErrorType.INTERNAL:
      default:
        userMessage = "Sorry, something went wrong. Please try again later.";
        break;
    }

    try {
      const options: TelegramBot.SendMessageOptions = {};

      if (details.messageId) {
        options.reply_to_message_id = details.messageId;
      }

      await sendSafeHTML(bot, details.chatId, userMessage, options);
    } catch (sendError) {
      logger.error("Error sending error message to user:", sendError as Error);
    }
  }
}

/**
 * Wraps an async function with error handling
 */
export function withErrorHandling<T>(
  bot: TelegramBot,
  fn: () => Promise<T>,
  errorInfo: Partial<ErrorDetails>,
  sendUserMessage: boolean = true
): Promise<T | null> {
  return fn().catch((error) => {
    handleError(
      bot,
      {
        type: ErrorType.INTERNAL,
        message: "An unexpected error occurred",
        originalError: error,
        ...errorInfo,
      },
      sendUserMessage
    );
    return null;
  });
}
