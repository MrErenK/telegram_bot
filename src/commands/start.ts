import * as TelegramBot from "node-telegram-bot-api";
import { getOrCreateGroupUser } from "../utils/db/group-operations";

/**
 * Handles the /start command
 * Creates a new user if they don't exist already
 */
export async function handleStart(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  if (!msg.from) return;

  // Check if this is a group chat
  if (msg.chat.type === "private") {
    await bot.sendMessage(
      msg.chat.id,
      "This bot now works in group chats only. Add me to a group and use the commands there!",
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  const { id, first_name, last_name, username } = msg.from;
  const groupId = msg.chat.id;

  // Get or create group user
  const groupUser = await getOrCreateGroupUser(
    {
      id,
      first_name,
      last_name,
      username,
    },
    groupId
  );

  // Determine if this is a new user or returning user based on createdAt timestamp
  const isNewUser = new Date().getTime() - groupUser.createdAt.getTime() < 5000; // If created within last 5 seconds, consider it new

  const displaySize = Number.isInteger(groupUser.size)
    ? groupUser.size.toString()
    : groupUser.size.toFixed(1);

  if (isNewUser) {
    await bot.sendMessage(
      msg.chat.id,
      `Welcome to DickGrowerBot, ${first_name}! 🍆\n\n` +
        `Your starting size is ${displaySize}cm.\n\n` +
        `Use /grow to make it grow (or shrink)!\n` +
        `Use /help to see all available commands.`,
      { parse_mode: "HTML" }
    );
  } else {
    // User already exists
    await bot.sendMessage(
      msg.chat.id,
      `Welcome back, ${first_name}! 🍆\n\n` +
        `Your current size is ${displaySize}cm.\n\n` +
        `Use /grow to make it grow (or shrink)!\n` +
        `Use /help to see all available commands.`,
      { parse_mode: "HTML" }
    );
  }
}
