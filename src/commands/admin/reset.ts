import * as TelegramBot from "node-telegram-bot-api";
import { AppDataSource } from "../../utils/db";
import { GroupUser, GroupGrowth } from "../../entity";
import { logSystemEvent } from "../../utils/logger";
import { findGroupUserByIdentifier } from "../../utils/db/group-operations";

/**
 * Admin command to reset a user's data or all user data in a group
 * Usage: /admin_reset <type> [username or ID]
 * Examples:
 * - /admin_reset user @username - Resets a specific user to default values in this group
 * - /admin_reset growth @username - Resets a specific user's growth history in this group
 * - /admin_reset all_growths - Resets growth history for all users in this group
 */
export async function resetCommand(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  args?: string
): Promise<void> {
  const groupId = msg.chat.id;

  if (!args) {
    await bot.sendMessage(
      msg.chat.id,
      "Usage: /admin_reset <type> [username or ID]\n\n" +
        "Available reset types:\n" +
        "- user @username - Reset a specific user to default values in this group\n" +
        "- growth @username - Reset a specific user's growth history in this group\n" +
        "- all_growths - Reset growth history for all users in this group\n\n" +
        "Examples:\n" +
        "/admin_reset user @username\n" +
        "/admin_reset growth 123456789",
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  // Parse the arguments
  const argParts = args.split(" ");
  const resetType = argParts[0].toLowerCase();

  // Handle different reset types
  if (resetType === "user" && argParts.length >= 2) {
    await resetUser(bot, msg, argParts[1]);
  } else if (resetType === "growth" && argParts.length >= 2) {
    await resetGrowthHistory(bot, msg, argParts[1]);
  } else if (resetType === "all_growths") {
    await resetAllGrowthHistory(bot, msg);
  } else {
    await bot.sendMessage(
      msg.chat.id,
      "Invalid reset type or missing user identifier. Use /admin_reset for help.",
      { reply_to_message_id: msg.message_id }
    );
  }
}

/**
 * Reset a specific user to default values in the current group
 */
async function resetUser(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  userIdentifier: string
): Promise<void> {
  const groupId = msg.chat.id;
  const user = await findGroupUserByIdentifier(userIdentifier, groupId);

  if (!user) {
    await bot.sendMessage(
      msg.chat.id,
      `User not found in this group: ${userIdentifier}`,
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  // Ask for confirmation before resetting
  const confirmationMsg = await bot.sendMessage(
    msg.chat.id,
    `⚠️ Are you sure you want to reset ${user.firstName}'s data in this group? This will:\n` +
      `- Set size back to 0cm\n` +
      `- Reset grow cooldown time\n` +
      `- Reset wins and losses\n` +
      `- Reset growth statistics\n\n` +
      `This action cannot be undone!`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Yes, reset user",
              callback_data: `reset_user_confirm:${user.id}`,
            },
            { text: "❌ Cancel", callback_data: "reset_cancel" },
          ],
        ],
      },
      reply_to_message_id: msg.message_id,
    }
  );

  // Store the confirmation context
  (global as any).pendingResets = (global as any).pendingResets || {};
  (global as any).pendingResets[user.id] = {
    type: "user",
    confirmationMessageId: confirmationMsg.message_id,
    chatId: msg.chat.id,
    groupId: groupId,
  };
}

/**
 * Reset growth history for a specific user
 */
async function resetGrowthHistory(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  userIdentifier: string
): Promise<void> {
  const groupId = msg.chat.id;
  const user = await findGroupUserByIdentifier(userIdentifier, groupId);

  if (!user) {
    await bot.sendMessage(
      msg.chat.id,
      `User not found in this group: ${userIdentifier}`,
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  // Ask for confirmation
  const confirmationMsg = await bot.sendMessage(
    msg.chat.id,
    `⚠️ Are you sure you want to reset ${user.firstName}'s growth history in this group? This will:\n` +
      `- Delete all growth records\n` +
      `- Reset growth statistics\n` +
      `- Reset grow cooldown time\n\n` +
      `Current size will remain unchanged.\n` +
      `This action cannot be undone!`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Yes, reset growth history",
              callback_data: `reset_growth_confirm:${user.id}`,
            },
            { text: "❌ Cancel", callback_data: "reset_cancel" },
          ],
        ],
      },
      reply_to_message_id: msg.message_id,
    }
  );

  // Store the confirmation context
  (global as any).pendingResets = (global as any).pendingResets || {};
  (global as any).pendingResets[user.id] = {
    type: "growth",
    confirmationMessageId: confirmationMsg.message_id,
    chatId: msg.chat.id,
    groupId: groupId,
  };
}

/**
 * Reset growth history for all users in the current group
 */
async function resetAllGrowthHistory(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  const groupId = msg.chat.id;

  // Ask for confirmation - this is a critical operation!
  const confirmationMsg = await bot.sendMessage(
    msg.chat.id,
    `⚠️ <b>CRITICAL ACTION</b> ⚠️\n\n` +
      `Are you absolutely sure you want to delete ALL growth records for ALL users in this group?\n\n` +
      `This action cannot be undone!`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Yes, reset ALL growth history",
              callback_data: "reset_all_growths_confirm",
            },
            { text: "❌ Cancel", callback_data: "reset_cancel" },
          ],
        ],
      },
      reply_to_message_id: msg.message_id,
    }
  );

  // Store the confirmation context
  (global as any).pendingResets = (global as any).pendingResets || {};
  (global as any).pendingResets["all_growths"] = {
    type: "all_growths",
    confirmationMessageId: confirmationMsg.message_id,
    chatId: msg.chat.id,
    groupId: groupId,
  };
}

/**
 * Handle reset confirmation callbacks
 */
export async function handleResetConfirmation(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  if (!callbackQuery.data || !callbackQuery.message) return;

  const [action, userId] = callbackQuery.data.split(":");
  const pendingResets = (global as any).pendingResets || {};

  if (action === "reset_user_confirm") {
    const context = pendingResets[userId];
    if (!context) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Reset request not found or expired.",
      });
      return;
    }

    try {
      const groupUserRepo = AppDataSource.getRepository(GroupUser);
      const groupGrowthRepo = AppDataSource.getRepository(GroupGrowth);

      // Get the group user
      const groupUser = await groupUserRepo.findOneBy({
        id: parseInt(userId),
        groupId: context.groupId,
      });

      if (!groupUser) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "User not found in this group.",
        });
        return;
      }

      // Delete all growth records
      await groupGrowthRepo.delete({ groupUser: { id: groupUser.id } });

      // Reset user to default values in this group
      groupUser.size = 0;
      groupUser.totalGrowths = 0;
      groupUser.positiveGrowths = 0;
      groupUser.negativeGrowths = 0;
      groupUser.wins = 0;
      groupUser.losses = 0;
      groupUser.lastGrowTime = new Date(0); // Reset grow time to epoch time

      await groupUserRepo.save(groupUser);

      // Log the action
      logSystemEvent(
        `Admin ${
          callbackQuery.from.username || callbackQuery.from.id
        } reset user ${groupUser.firstName} (${groupUser.userId}) in group ${
          context.groupId
        }`
      );

      // Update the confirmation message
      await bot.editMessageText(
        `✅ Successfully reset ${groupUser.firstName}'s data to default values in this group.`,
        {
          chat_id: context.chatId,
          message_id: context.confirmationMessageId,
          reply_markup: { inline_keyboard: [] },
        }
      );
    } catch (error) {
      await bot.editMessageText(
        `❌ Error resetting user: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          chat_id: context.chatId,
          message_id: context.confirmationMessageId,
          reply_markup: { inline_keyboard: [] },
        }
      );
    }

    // Clean up context
    delete pendingResets[userId];
  } else if (action === "reset_growth_confirm") {
    const context = pendingResets[userId];
    if (!context) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Reset request not found or expired.",
      });
      return;
    }

    try {
      const groupUserRepo = AppDataSource.getRepository(GroupUser);
      const groupGrowthRepo = AppDataSource.getRepository(GroupGrowth);

      // Get the group user
      const groupUser = await groupUserRepo.findOneBy({
        id: parseInt(userId),
        groupId: context.groupId,
      });

      if (!groupUser) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "User not found in this group.",
        });
        return;
      }

      // Delete all growth records
      await groupGrowthRepo.delete({ groupUser: { id: groupUser.id } });

      // Reset growth statistics and lastGrowTime
      groupUser.totalGrowths = 0;
      groupUser.positiveGrowths = 0;
      groupUser.negativeGrowths = 0;
      groupUser.lastGrowTime = new Date(0); // Reset grow time to epoch time

      await groupUserRepo.save(groupUser);

      // Log the action
      logSystemEvent(
        `Admin ${
          callbackQuery.from.username || callbackQuery.from.id
        } reset growth history for user ${groupUser.firstName} (${
          groupUser.userId
        }) in group ${context.groupId}`
      );

      // Update the confirmation message
      await bot.editMessageText(
        `✅ Successfully reset ${groupUser.firstName}'s growth history in this group.`,
        {
          chat_id: context.chatId,
          message_id: context.confirmationMessageId,
          reply_markup: { inline_keyboard: [] },
        }
      );
    } catch (error) {
      await bot.editMessageText(
        `❌ Error resetting growth history: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          chat_id: context.chatId,
          message_id: context.confirmationMessageId,
          reply_markup: { inline_keyboard: [] },
        }
      );
    }

    // Clean up context
    delete pendingResets[userId];
  } else if (action === "reset_all_growths_confirm") {
    const context = pendingResets["all_growths"];
    if (!context) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Reset request not found or expired.",
      });
      return;
    }

    try {
      const groupUserRepo = AppDataSource.getRepository(GroupUser);
      const groupGrowthRepo = AppDataSource.getRepository(GroupGrowth);

      // Get all users in this group
      const groupUsers = await groupUserRepo.find({
        where: { groupId: context.groupId },
      });

      // Count growths before deletion
      const groupGrowthCount = await groupGrowthRepo
        .createQueryBuilder("groupGrowth")
        .innerJoin("groupGrowth.groupUser", "groupUser")
        .where("groupUser.groupId = :groupId", { groupId: context.groupId })
        .getCount();

      // Delete ALL growth records for this group
      for (const user of groupUsers) {
        await groupGrowthRepo.delete({ groupUser: { id: user.id } });
      }

      // Reset growth statistics for all users in this group
      await groupUserRepo
        .createQueryBuilder()
        .update(GroupUser)
        .set({
          totalGrowths: 0,
          positiveGrowths: 0,
          negativeGrowths: 0,
          lastGrowTime: new Date(0),
        })
        .where("groupId = :groupId", { groupId: context.groupId })
        .execute();

      // Log the action
      logSystemEvent(
        `Admin ${
          callbackQuery.from.username || callbackQuery.from.id
        } reset ALL growth history in group ${context.groupId}`
      );

      // Update the confirmation message
      await bot.editMessageText(
        `✅ Successfully deleted ${groupGrowthCount} growth records for all users in this group.`,
        {
          chat_id: context.chatId,
          message_id: context.confirmationMessageId,
          reply_markup: { inline_keyboard: [] },
        }
      );
    } catch (error) {
      await bot.editMessageText(
        `❌ Error resetting growth history: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          chat_id: context.chatId,
          message_id: context.confirmationMessageId,
          reply_markup: { inline_keyboard: [] },
        }
      );
    }

    // Clean up context
    delete pendingResets["all_growths"];
  } else if (action === "reset_cancel") {
    // Find the context
    let chatId, messageId;

    for (const key in pendingResets) {
      const context = pendingResets[key];
      if (context.confirmationMessageId === callbackQuery.message.message_id) {
        chatId = context.chatId;
        messageId = context.confirmationMessageId;
        delete pendingResets[key]; // Remove from pending resets
        break;
      }
    }

    if (chatId && messageId) {
      // Update the message
      await bot.editMessageText(`❌ Reset operation cancelled.`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      });
    }
  }

  // Answer the callback query
  await bot.answerCallbackQuery(callbackQuery.id);
}

// Note: findGroupUserByIdentifier is now imported from group-operations.ts
