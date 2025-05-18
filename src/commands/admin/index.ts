import * as TelegramBot from "node-telegram-bot-api";
import { withAdminCheck } from "./utils";
import { statsCommand } from "./stats";
import { setCommand } from "./set";
import { resetCommand } from "./reset";
import { getCommand } from "./get";

/**
 * Register admin command handlers
 */
export function registerAdminCommands(bot: TelegramBot): void {
  // Admin stats command
  bot.onText(/^\/admin_stats(@\w+)?(?:\s+(.*))?$/, async (msg) => {
    await withAdminCheck(statsCommand)(bot, msg);
  });

  // Admin set command
  bot.onText(/^\/admin_set(@\w+)?(?:\s+(.*))?$/, async (msg, match) => {
    const args = match?.[2]?.trim();
    await withAdminCheck(setCommand)(bot, msg, args);
  });

  // Admin reset command
  bot.onText(/^\/admin_reset(@\w+)?(?:\s+(.*))?$/, async (msg, match) => {
    const args = match?.[2]?.trim();
    await withAdminCheck(resetCommand)(bot, msg, args);
  });

  // Admin get command
  bot.onText(/^\/admin_get(@\w+)?(?:\s+(.*))?$/, async (msg, match) => {
    const args = match?.[2]?.trim();
    await withAdminCheck(getCommand)(bot, msg, args);
  });
}

export { statsCommand, setCommand, resetCommand, getCommand };
