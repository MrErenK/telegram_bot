import * as TelegramBot from "node-telegram-bot-api";
import {
  findTopGroupUsers,
  countGroupUsers,
} from "../utils/db/group-operations";
import { sendPaginatedMessage } from "../utils/message";
import { createPaginationKeyboard } from "../utils/message";
import { sendSafeHTML } from "../utils/formatting";
import { ErrorType, handleError } from "../utils/error";
import logger from "../utils/logger";
import { PAGE_SIZE } from "../utils/config/manager";
import { formatNumber } from "../utils/formatting-utils";

/**
 * Handles the /top command
 * Shows a leaderboard of users with the largest dicks
 * Supports pagination
 */
export async function handleTop(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  page: number = 1
): Promise<void> {
  try {
    if (!msg.from) {
      logger.warn("Top command received without user information");
      return;
    }

    // Check if this is a private chat
    if (msg.chat.type === "private") {
      await bot.sendMessage(
        msg.chat.id,
        "This bot now works in group chats only. Add me to a group and use the commands there!",
        { reply_to_message_id: msg.message_id }
      );
      return;
    }

    // Default page size from config
    const pageSize = PAGE_SIZE || 10;
    const offset = (page - 1) * pageSize;

    // Get the group ID from the message
    const groupId = msg.chat.id;

    // Get total count of users in this group for pagination
    const totalUsers = await countGroupUsers(groupId);

    if (totalUsers === 0) {
      await sendSafeHTML(
        bot,
        msg.chat.id,
        "No users found yet! Be the first to use /start and /grow to get on the leaderboard.",
        { reply_to_message_id: msg.message_id }
      );
      return;
    }

    // Get users for the current page in this group
    const topUsers = await findTopGroupUsers(groupId, pageSize, offset);

    // Format user entries
    const userEntries = topUsers.map((user, index) => {
      const actualRank = offset + index + 1;

      // Emojis for top 3
      let prefix = `${actualRank}.`;

      // Get actual size from database
      const actualSize = user.size;

      // Format size without decimal if it's a whole number (but keep it minimum 1cm for display)
      const sizeDisplay = Number.isInteger(Math.max(1, actualSize))
        ? Math.max(1, actualSize).toString()
        : Math.max(1, actualSize).toFixed(1);

      // For users with negative sizes, show the actual value in parentheses
      const displayText =
        actualSize < 1
          ? `${sizeDisplay}cm (actual: ${formatNumber(actualSize)}cm)`
          : `${sizeDisplay}cm`;

      return `${prefix} <b>${user.firstName}</b>: ${displayText}`;
    });

    // Create header text
    const headerText =
      `<b>🏆 DICK LEADERBOARD 🏆</b>\n` +
      `<i>Page ${page} of ${Math.ceil(totalUsers / pageSize)}</i>\n\n` +
      `Total participants: ${totalUsers}`;

    // Send paginated message
    await sendPaginatedMessage(
      bot,
      msg.chat.id,
      headerText,
      userEntries,
      page,
      pageSize,
      "top_page",
      { reply_to_message_id: msg.message_id }
    );

    // Top leaderboard displayed successfully
  } catch (error) {
    await handleError(bot, {
      type: ErrorType.INTERNAL,
      message: "An error occurred while processing the top command",
      originalError: error as Error,
      chatId: msg.chat.id,
      messageId: msg.message_id,
      userId: msg.from?.id,
    });
  }
}

/**
 * Handles pagination callbacks for the top command
 */
export async function handleTopPagination(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  try {
    if (!callbackQuery.data || !callbackQuery.message) {
      // Invalid callback query, return silently
      return;
    }

    // No-op callback for current page indicator
    if (callbackQuery.data.startsWith("top_noop:")) {
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Extract page number from callback data
    const [action, pageStr] = callbackQuery.data.split(":");
    if (action !== "top_page") return;

    const page = parseInt(pageStr);
    if (isNaN(page)) {
      // Invalid page number, return silently
      return;
    }

    const msg = callbackQuery.message;
    const pageSize = PAGE_SIZE || 10;
    const groupId = msg.chat.id;

    // Get total count of users in this group for pagination
    const totalUsers = await countGroupUsers(groupId);

    if (totalUsers === 0) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "No users found in the leaderboard",
      });
      return;
    }

    // Calculate offset for current page
    const offset = (page - 1) * pageSize;

    // Get users for the current page in this group
    const topUsers = await findTopGroupUsers(groupId, pageSize, offset);

    // Format user entries
    const userEntries = topUsers.map((user, index) => {
      const actualRank = offset + index + 1;

      // Set rank number
      const prefix = `${actualRank}.`;

      // Format size without decimal if it's a whole number
      const sizeDisplay = Number.isInteger(user.size)
        ? user.size.toString()
        : user.size.toFixed(1);

      return `${prefix} <b>${user.firstName}</b>: ${sizeDisplay}cm`;
    });

    // Create header text
    const headerText =
      `<b>🏆 DICK LEADERBOARD 🏆</b>\n` +
      `<i>Page ${page} of ${Math.ceil(totalUsers / pageSize)}</i>\n\n` +
      `Total participants: ${totalUsers}`;

    // Create pagination keyboard
    const keyboard = createPaginationKeyboard(
      page,
      Math.ceil(totalUsers / pageSize),
      "top_page"
    );

    // Update message with new content
    await bot.editMessageText(`${headerText}\n\n${userEntries.join("\n")}`, {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    // Answer callback query to remove loading state
    await bot.answerCallbackQuery(callbackQuery.id);

    // Top pagination updated successfully
  } catch (error) {
    // Handle error silently

    // Answer callback query with error
    if (callbackQuery.id) {
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "An error occurred. Please try again.",
          show_alert: true,
        });
      } catch (err) {
        // Ignore errors from answering callback
      }
    }
  }
}
