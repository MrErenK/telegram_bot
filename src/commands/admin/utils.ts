import * as TelegramBot from "node-telegram-bot-api";
import { ADMIN_IDS } from "../../utils/config/manager";

/**
 * Checks if the user is authorized to execute admin commands
 */
export function isAdmin(userId: number): boolean {
  return ADMIN_IDS.includes(userId);
}

/**
 * Middleware function to check admin permissions before executing a command
 */
export function withAdminCheck(
  commandHandler: (
    bot: TelegramBot,
    msg: TelegramBot.Message,
    args?: string
  ) => Promise<void>
): (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  args?: string
) => Promise<void> {
  return async (bot: TelegramBot, msg: TelegramBot.Message, args?: string) => {
    if (!msg.from) return;

    // Check if this is a group chat
    if (msg.chat.type === "private") {
      await bot.sendMessage(
        msg.chat.id,
        "This command can only be used in group chats.",
        { reply_to_message_id: msg.message_id }
      );
      return;
    }

    if (!isAdmin(msg.from.id)) {
      await bot.sendMessage(
        msg.chat.id,
        "⛔ You are not authorized to use this command.",
        { reply_to_message_id: msg.message_id }
      );
      return;
    }

    await commandHandler(bot, msg, args);
  };
}

/**
 * Parses command arguments
 * @param text The full message text
 * @param commandName The command name to extract arguments from
 * @returns Extracted arguments string or undefined if no arguments
 */
export function parseCommandArgs(
  text: string,
  commandName: string
): string | undefined {
  // Account for potential @ references in the command (like /command@botname)
  const commandRegex = new RegExp(`^\\/${commandName}(?:@\\w+)?\\s*(.*)$`, "s");
  const match = text.match(commandRegex);

  if (match && match[1] && match[1].trim()) {
    return match[1].trim();
  }

  return undefined;
}
