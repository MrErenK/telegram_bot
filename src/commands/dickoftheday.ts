import * as TelegramBot from "node-telegram-bot-api";
import { getDickOfTheDayAmount } from "../utils/random";
import {
  getOrCreateGroupUser,
  updateGroupUser,
  createGroupGrowth,
  getUserRank,
  getRandomGroupUser,
} from "../utils/db/group-operations";
import { sendSafeHTML } from "../utils/formatting";
import { ErrorType, handleError } from "../utils/error";

/**
 * Handles the /dickoftheday command
 * Selects a random user and gives them a bonus growth
 */
export async function handleDickOfTheDay(
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

    const groupId = msg.chat.id;

    // Get a random user from the group
    let randomUser = await getRandomGroupUser(groupId);

    // If no users exist in the group and the message sender exists, use them
    if (!randomUser && msg.from) {
      randomUser = await getOrCreateGroupUser(
        {
          id: msg.from.id,
          first_name: msg.from.first_name,
          last_name: msg.from.last_name,
          username: msg.from.username,
        },
        groupId
      );
    } else if (!randomUser) {
      // No users in the group and no sender info
      await sendSafeHTML(
        bot,
        groupId,
        "No users available in this group. Someone needs to use /start first!",
        { reply_to_message_id: msg.message_id }
      );
      return;
    }

    // Get old rank before updating
    const oldRank = await getUserRank(randomUser.userId, groupId);

    // Generate a special bonus growth amount
    const growthAmount = getDickOfTheDayAmount();

    // Update the user's size
    const oldSize = randomUser.size;
    randomUser.size += growthAmount;

    // Update growth statistics
    randomUser.totalGrowths += 1;
    randomUser.positiveGrowths += 1;

    // Create a special growth record
    await createGroupGrowth({
      groupUser: randomUser,
      amount: growthAmount,
      timestamp: new Date(),
      isSpecial: true,
      specialReason: "Dick of the Day",
    });

    // Save the updated user
    await updateGroupUser(randomUser);

    // Get new rank after update
    const newRank = await getUserRank(randomUser.userId, groupId);

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

    // Send success message with more descriptive text
    await sendSafeHTML(
      bot,
      groupId,
      `🎉 <b>DICK OF THE DAY</b> 🎉\n\n` +
        `Congratulations to <b>${randomUser.firstName}</b>! 🍆\n\n` +
        `You've been selected as today's lucky winner and received a bonus growth of <b>+${growthAmount}cm</b>!\n\n` +
        `Size: ${oldSize.toFixed(1)}cm → ${randomUser.size.toFixed(
          1
        )}cm${rankMessage}`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    await handleError(bot, {
      type: ErrorType.INTERNAL,
      message: "An error occurred while processing the dick of the day command",
      originalError: error as Error,
      chatId: msg.chat.id,
      messageId: msg.message_id,
      userId: msg.from?.id,
    });
  }
}
