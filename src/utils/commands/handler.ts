import * as TelegramBot from "node-telegram-bot-api";
import { ErrorType, handleError } from "../error";

// Command handler types
export type CommandHandler = (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  match?: RegExpExecArray | null
) => Promise<void>;
export type CallbackQueryHandler = (
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
) => Promise<void>;

// Command definition interface
export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  regex: RegExp;
  handler: CommandHandler;
  adminOnly?: boolean;
}

// Callback query definition interface
export interface CallbackQuery {
  name: string;
  prefix: string;
  handler: CallbackQueryHandler;
  adminOnly?: boolean;
}

// Global admin user IDs
let adminUserIds: number[] = [];

/**
 * Set the admin user IDs for permission checking
 */
export function setAdminUserIds(userIds: number[]): void {
  adminUserIds = userIds;
}

/**
 * Check if a user is an admin
 */
export function isAdmin(userId: number): boolean {
  return adminUserIds.includes(userId);
}

/**
 * Wraps a command handler with error handling and permission checking
 */
export function createCommandHandler(command: Command): CommandHandler {
  return async (
    bot: TelegramBot,
    msg: TelegramBot.Message,
    match?: RegExpExecArray | null
  ) => {
    if (!msg.from) {
      return;
    }

    // Get bot info to check if command is addressed to this bot
    const botInfo = await bot.getMe();
    const commandText = msg.text || "";

    // Check if the command is specifically addressed to this bot or in a private chat
    const isPrivateChat = msg.chat.type === "private";

    // Check if the command is meant for this bot
    if (!isPrivateChat) {
      // Extract command string from text
      const commandMatch = commandText.match(
        /^\/([a-zA-Z0-9_]+)(@[a-zA-Z0-9_]+)?/
      );
      if (commandMatch) {
        const cmdName = commandMatch[1];
        const botName = commandMatch[2]; // e.g. @botname or undefined

        // If command addressed to specific bot, ensure it's this bot
        if (botName && botName !== `@${botInfo.username}`) {
          // Command is for a different bot, ignore
          return;
        }

        // Check if this command or any of its aliases match
        const validCommands = [command.name, ...(command.aliases || [])];
        if (!validCommands.includes(cmdName)) {
          return;
        }
      }
    }

    // Check admin permissions
    if (command.adminOnly && !isAdmin(msg.from.id)) {
      await handleError(bot, {
        type: ErrorType.PERMISSION,
        message: "You don't have permission to use this command.",
        userId: msg.from.id,
        chatId: msg.chat.id,
        messageId: msg.message_id,
      });
      return;
    }

    try {
      await command.handler(bot, msg, match);
    } catch (error) {
      await handleError(bot, {
        type: ErrorType.INTERNAL,
        message: `Error executing command /${command.name}`,
        originalError: error as Error,
        userId: msg.from.id,
        chatId: msg.chat.id,
        messageId: msg.message_id,
        context: { command: command.name },
      });
    }
  };
}

/**
 * Wraps a callback query handler with error handling and permission checking
 */
export function createCallbackQueryHandler(
  callbackQuery: CallbackQuery
): CallbackQueryHandler {
  return async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    if (!query.from || !query.data) {
      return;
    }

    // Check admin permissions
    if (callbackQuery.adminOnly && !isAdmin(query.from.id)) {
      await bot.answerCallbackQuery(query.id, {
        text: "You don't have permission to perform this action.",
        show_alert: true,
      });
      return;
    }

    try {
      await callbackQuery.handler(bot, query);
    } catch (error) {
      await handleError(bot, {
        type: ErrorType.INTERNAL,
        message: `Error handling callback query '${callbackQuery.name}'`,
        originalError: error as Error,
        userId: query.from.id,
        chatId: query.message?.chat.id,
        context: { callbackQuery: callbackQuery.name, data: query.data },
      });

      // Answer the callback query to remove loading state
      try {
        await bot.answerCallbackQuery(query.id, {
          text: "An error occurred. Please try again.",
        });
      } catch (err) {
        // Ignore errors from answering the callback query
      }
    }
  };
}

/**
 * Register multiple commands with a bot instance
 */
export function registerCommands(bot: TelegramBot, commands: Command[]): void {
  for (const command of commands) {
    const handler = createCommandHandler(command);

    // Register the main command regex
    bot.onText(command.regex, (msg, match) => handler(bot, msg, match));

    // Register aliases if they exist with the same handler but different regexes
    if (command.aliases && command.aliases.length > 0) {
      for (const alias of command.aliases) {
        // Create a more comprehensive regex for each alias that mimics the main command regex format
        // This ensures correct handling of @botname mentions and arguments
        const aliasPattern = command.regex.source.replace(
          `\\/${command.name}`,
          `\\/${alias}`
        );

        const aliasRegex = new RegExp(aliasPattern, command.regex.flags);
        bot.onText(aliasRegex, (msg, match) => handler(bot, msg, match));
      }
    }
  }
}

/**
 * Register multiple callback queries with a bot instance
 */
export function registerCallbackQueries(
  bot: TelegramBot,
  callbackQueries: CallbackQuery[]
): void {
  bot.on("callback_query", async (query) => {
    if (!query.data) return;

    for (const callback of callbackQueries) {
      if (query.data.startsWith(callback.prefix)) {
        const handler = createCallbackQueryHandler(callback);
        await handler(bot, query);
        return;
      }
    }
  });
}
