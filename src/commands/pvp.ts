import * as TelegramBot from "node-telegram-bot-api";
import { MIN_FIGHT_SIZE } from "../utils/config/manager";
import {
  createGroupFight,
  getOrCreateGroupUser,
} from "../utils/db/group-operations";
import { formatNumber } from "../utils/random";

/**
 * Handles the /pvp command
 * Allows a user to challenge others to a dick fight
 */
export async function handlePvp(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  wager: number = 1.0
): Promise<void> {
  if (!msg.from) {
    return;
  }

  const initiatorId = msg.from.id;
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

  // Get or create the initiator in this group
  const initiator = await getOrCreateGroupUser(
    {
      id: initiatorId,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name,
      username: msg.from.username,
    },
    groupId
  );

  // Check if initiator has sufficient size
  if (initiator.size < MIN_FIGHT_SIZE) {
    await bot.sendMessage(
      msg.chat.id,
      `Your dick is too small to fight! You need at least ${MIN_FIGHT_SIZE} cm.`,
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  // Calculate max wager (user's full size)
  const MAX_WAGER = initiator.size;

  // Validate wager
  if (isNaN(wager) || wager < MIN_FIGHT_SIZE || wager > MAX_WAGER) {
    await bot.sendMessage(
      msg.chat.id,
      `The wager must be between ${MIN_FIGHT_SIZE} and ${formatNumber(
        MAX_WAGER
      )} cm.`,
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  // No need to check if wager is less than initiator's size since the max wager equals their size

  // Create a new group fight but don't set the target yet (will be set when someone accepts)
  const fight = await createGroupFight(
    initiator,
    null, // No target yet
    groupId,
    wager
  );

  // Create inline keyboard for fight response
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🥊 Accept Challenge",
          callback_data: `accept_fight:${fight.id}`,
        },
      ],
    ],
  };

  await bot.sendMessage(
    msg.chat.id,
    `🥊 <b>DICK FIGHT CHALLENGE</b> 🥊\n\n` +
      `${initiator.firstName} has started a dick fight challenge!\n\n` +
      `📏 <b>Wager:</b> ${formatNumber(wager)}cm\n\n` +
      `Anyone with at least ${MIN_FIGHT_SIZE}cm can accept this challenge!`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
}
