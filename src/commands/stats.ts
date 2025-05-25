import * as TelegramBot from "node-telegram-bot-api";
import {
  formatCooldownTime,
  getTimeUntilNextGrowth,
} from "../utils/config/manager";
import {
  getOrCreateGroupUser,
  getGroupUserGrowthHistory,
} from "../utils/db/group-operations";
import { sendSafeHTML } from "../utils/formatting";
import { ErrorType, handleError } from "../utils/error";
import logger from "../utils/logger";
import { formatNumber } from "../utils/formatting-utils";

/**
 * Handles the /stats command
 * Shows a user's dick statistics
 */
export async function handleStats(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  try {
    if (!msg.from) {
      logger.warn("Stats command received without user information");
      return;
    }

    const userId = msg.from.id;
    const groupId = msg.chat.id;

    // Check if this is a private chat
    if (msg.chat.type === "private") {
      await bot.sendMessage(
        msg.chat.id,
        "This bot now works in group chats only. Add me to a group and use the commands there!",
        { reply_to_message_id: msg.message_id }
      );
      return;
    }

    // Get or create group user
    const groupUser = await getOrCreateGroupUser(
      {
        id: userId,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name,
        username: msg.from.username,
      },
      groupId
    );

    // Get latest growth records for this group
    const recentGrowths = await getGroupUserGrowthHistory(userId, groupId, 5);

    // Calculate stats for this group
    const growthPercentage =
      groupUser.totalGrowths > 0
        ? ((groupUser.positiveGrowths / groupUser.totalGrowths) * 100).toFixed(
            1
          )
        : "0.0";

    const shrinkPercentage =
      groupUser.totalGrowths > 0
        ? ((groupUser.negativeGrowths / groupUser.totalGrowths) * 100).toFixed(
            1
          )
        : "0.0";

    // Calculate cooldown for this group
    const cooldown = getTimeUntilNextGrowth(groupUser.lastGrowTime);
    const nextGrowthTime =
      cooldown > 0 ? `in ${formatCooldownTime(cooldown)}` : "now";

    // Get actual size for database
    const actualSize = groupUser.size;

    // Format displayable size (minimum 1cm for display only)
    const displaySize = formatNumber(Math.max(1, actualSize));

    // Build message parts
    const messageTemplates = [
      `<b>🍆 ${groupUser.firstName}'s Dick Stats in this Group 🍆</b>\n\n` +
        `Current size: <b>${displaySize}cm</b>` +
        (actualSize < 1 ? ` (actual: ${formatNumber(actualSize)}cm)` : ``) +
        `\n` +
        `Total growth attempts: <b>${groupUser.totalGrowths}</b>\n` +
        `Growth rate: <b>${growthPercentage}%</b> (${groupUser.positiveGrowths} times)\n` +
        `Shrink rate: <b>${shrinkPercentage}%</b> (${groupUser.negativeGrowths} times)`,

      `<b>🥊 Fight Stats in this Group:</b>\n` +
        `Wins: <b>${groupUser.wins || 0}</b>\n` +
        `Losses: <b>${groupUser.losses || 0}</b>\n` +
        `Win rate: <b>${
          groupUser.wins + groupUser.losses > 0
            ? (
                ((groupUser.wins || 0) /
                  ((groupUser.wins || 0) + (groupUser.losses || 0))) *
                100
              ).toFixed(1)
            : "0.0"
        }%</b>`,

      `Next growth available: <b>${nextGrowthTime}</b>`,
    ];

    // Add recent history if available
    if (recentGrowths.length > 0) {
      let historyText = `<b>Recent Growth History:</b>\n`;

      recentGrowths.forEach((growth) => {
        const date = growth.timestamp.toLocaleDateString();
        const sign = growth.amount > 0 ? "+" : "";
        // Format growth amount without decimal if it's a whole number
        const displayAmount = Number.isInteger(growth.amount)
          ? growth.amount
          : growth.amount.toFixed(1);
        historyText += `${date}: ${sign}${displayAmount}cm\n`;
      });

      messageTemplates.push(historyText);
    }

    // Send the message with all parts
    await sendSafeHTML(bot, msg.chat.id, messageTemplates.join("\n\n"), {
      reply_to_message_id: msg.message_id,
    });

    // Stats displayed successfully
  } catch (error) {
    await handleError(bot, {
      type: ErrorType.INTERNAL,
      message: "An error occurred while processing the stats command",
      originalError: error as Error,
      chatId: msg.chat.id,
      messageId: msg.message_id,
      userId: msg.from?.id,
    });
  }
}
