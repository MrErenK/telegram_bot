import * as TelegramBot from "node-telegram-bot-api";
import { getGrowthAmount, getGrowthEmoji } from "../utils/random";
import {
  updateGroupUser,
  createGroupGrowth,
  canUserGrow,
  getUserRank,
  findGroupUserById,
  getOrCreateGroupUser,
} from "../utils/db/group-operations";
import { formatTimeLeft, formatNumber } from "../utils/formatting-utils";
import { ErrorType, handleError } from "../utils/error";
import logger from "../utils/logger";

/**
 * Handles the /grow command
 * Allows users to grow their dick in a group chat
 */
export async function handleGrow(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  try {
    // Check if this is a private chat
    if (msg.chat.type === "private") {
      await bot.sendMessage(
        msg.chat.id,
        "This bot now works in group chats only. Add me to a group and use the commands there!",
        { reply_to_message_id: msg.message_id }
      );
      return;
    }

    if (!msg.from) {
      return; // No user info available
    }

    const groupId = msg.chat.id;
    const userId = msg.from.id;

    // Check if user exists in database for this specific group
    let groupUser;
    try {
      groupUser = await findGroupUserById(userId, groupId);
    } catch (dbError) {
      logger.error(
        `Failed to find group user: ${userId} in group ${groupId}`,
        dbError as Error
      );
      throw dbError;
    }

    if (!groupUser) {
      try {
        // Create new group user if not found
        logger.info(
          `Creating new user for ${msg.from.first_name} (${userId}) in group ${groupId}`
        );

        // Validate user data before passing to getOrCreateGroupUser
        if (!userId || !msg.from.first_name) {
          throw new Error("Invalid user data: missing required fields");
        }

        groupUser = await getOrCreateGroupUser(
          {
            id: userId,
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
          },
          groupId
        );

        if (!groupUser) {
          throw new Error("User creation returned null");
        }

        // Send welcome message to new users
        await bot.sendMessage(
          groupId,
          `Welcome to YarakUzatmaBot, ${msg.from.first_name}! 🍆\nYou can now use /grow to make it grow (or shrink)!`,
          { reply_to_message_id: msg.message_id }
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(
          `Failed to create user for ${userId} in group ${groupId}: ${errorMessage}`,
          error as Error
        );
        await bot.sendMessage(
          groupId,
          "Failed to create user profile. Please try again or use /start first.",
          { reply_to_message_id: msg.message_id }
        );
        return;
      }
    }

    // Check if user can grow
    const { canGrow, timeUntilNextGrowth } = await canUserGrow(userId, groupId);

    if (!canGrow) {
      await bot.sendMessage(
        groupId,
        `You need to wait ${formatTimeLeft(
          timeUntilNextGrowth
        )} before growing again.`,
        { reply_to_message_id: msg.message_id }
      );
      return;
    }

    // Get old rank before updating
    const oldRank = await getUserRank(userId, groupId);

    // Get the current size before updating
    const oldSize = groupUser.size;

    // Generate growth amount
    const growthAmount = getGrowthAmount(groupUser.totalGrowths);

    // Update user's size - allow negative numbers in the database
    groupUser.size += growthAmount;

    // Update growth statistics
    groupUser.totalGrowths += 1;
    if (growthAmount > 0) {
      groupUser.positiveGrowths += 1;
    } else if (growthAmount < 0) {
      groupUser.negativeGrowths += 1;
    }

    // Update last grow time
    groupUser.lastGrowTime = new Date();

    // Create growth record
    await createGroupGrowth({
      groupUser: groupUser,
      amount: growthAmount,
      timestamp: new Date(),
    });

    // Save the updated user
    await updateGroupUser(groupUser);

    // Get new rank after update
    const newRank = await getUserRank(userId, groupId);

    // Format rank change message
    let rankMessage = "";
    if (oldRank && newRank) {
      if (oldRank > newRank) {
        rankMessage = `\n🔼 Rank improved! ${oldRank} → ${newRank}`;
      } else if (oldRank < newRank) {
        rankMessage = `\n🔽 Rank dropped! ${oldRank} → ${newRank}`;
      } else {
        rankMessage = `\n🔄 Rank unchanged: ${newRank}`;
      }
    } else if (newRank) {
      rankMessage = `\n📊 Current rank: ${newRank}`;
    }

    // Get growth emoji based on amount
    const emoji = getGrowthEmoji(growthAmount);

    // Display the actual size without clamping to a minimum value
    const displaySize = groupUser.size;

    // Send growth message
    await bot.sendMessage(
      groupId,
      `${emoji} <b>${msg.from.first_name}</b>, your dick ${
        growthAmount > 0
          ? "grew"
          : growthAmount < 0
          ? "shrunk"
          : "didn't change"
      } by <b>${growthAmount > 0 ? "+" : ""}${formatNumber(
        growthAmount
      )}cm</b>!\n\n` +
        `Size: ${formatNumber(oldSize)}cm → ${formatNumber(
          displaySize
        )}cm${rankMessage}`,
      { parse_mode: "HTML", reply_to_message_id: msg.message_id }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Error in handleGrow: ${errorMessage}`, error as Error);

    await handleError(bot, {
      type: ErrorType.INTERNAL,
      message: "An error occurred while processing the grow command",
      originalError: error as Error,
      chatId: msg.chat.id,
      messageId: msg.message_id,
      userId: msg.from?.id,
    });
  }
}
