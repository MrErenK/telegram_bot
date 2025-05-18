import * as TelegramBot from "node-telegram-bot-api";
import { ADMIN_IDS } from "../../utils/config/manager";
import { AppDataSource } from "../../utils/db";
import { GroupUser } from "../../entity";
import { logSystemEvent } from "../../utils/logger";
import { findGroupUserByIdentifier } from "../../utils/db/group-operations";

/**
 * Handles the /reset_time command for bot admins
 * Allows resetting a user's grow cooldown time in the current group
 */
export async function handleResetTime(
  bot: TelegramBot,
  msg: TelegramBot.Message,
): Promise<void> {
  const groupId = msg.chat.id;

  // Check if the command is executed by an admin
  if (!msg.from || !ADMIN_IDS.includes(msg.from.id)) {
    await bot.sendMessage(
      msg.chat.id,
      "You don't have permission to use this command.",
    );
    return;
  }

  // Extract username or ID from the command
  const match = msg.text?.match(/\/reset_time(?:@\w+)?\s+(.+)/);
  if (!match) {
    await bot.sendMessage(
      msg.chat.id,
      "Please specify a username or user ID: /reset_time username",
    );
    return;
  }

  const userIdentifier = match[1].trim();

  // Find the group user using the helper function
  const groupUser = await findGroupUserByIdentifier(userIdentifier, groupId);

  if (!groupUser) {
    await bot.sendMessage(
      msg.chat.id,
      "User not found in this group. Please check the username or ID.",
    );
    return;
  }

  // Reset the user's last grow time to epoch time (so they can grow immediately)
  groupUser.lastGrowTime = new Date(0);
  const groupUserRepo = AppDataSource.getRepository(GroupUser);
  await groupUserRepo.save(groupUser);

  // Log the action
  logSystemEvent(
    `Admin ${msg.from.username || msg.from.id} reset grow cooldown for ${
      groupUser.firstName
    } (${groupUser.userId}) in group ${groupId}`,
  );

  // Send confirmation to the chat
  await bot.sendMessage(
    msg.chat.id,
    `Successfully reset grow cooldown for ${groupUser.firstName} in this group.`,
  );
}
