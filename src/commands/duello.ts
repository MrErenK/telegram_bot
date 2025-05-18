import * as TelegramBot from "node-telegram-bot-api";
import { AppDataSource } from "../utils/db";
import { GroupUser, GroupDuello } from "../entity";
import { MIN_FIGHT_SIZE } from "../utils/config/manager";
import {
  getOrCreateGroupUser,
  findGroupUserByIdentifier,
} from "../utils/db/group-operations";
import { formatNumber } from "../utils/random";
import { ErrorType, handleError } from "../utils/error";

// Define the fighting styles
export const FIGHTING_STYLES = {
  AGGRESSIVE: "aggressive", // Higher damage but less defense
  DEFENSIVE: "defensive", // Better defense but less damage
  TECHNICAL: "technical", // More consistent but average damage
  LUCKY: "lucky", // High variance, can be amazing or terrible
};

/**
 * Handles the /duello command
 * Allows a user to challenge another to a strategic dick duel
 */
export async function handleDuello(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  args?: string,
): Promise<void> {
  try {
    if (!msg.from) {
      return;
    }

    const initiatorId = msg.from.id;
    const groupId = msg.chat.id;

    // Check if this is a private chat
    if (msg.chat.type === "private") {
      await bot.sendMessage(
        msg.chat.id,
        "This command can only be used in group chats.",
        { reply_to_message_id: msg.message_id },
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
      groupId,
    );

    // Check if initiator has sufficient size
    if (initiator.size < MIN_FIGHT_SIZE) {
      await bot.sendMessage(
        msg.chat.id,
        `Your dick is too small for a duello! You need at least ${MIN_FIGHT_SIZE}cm.`,
        { reply_to_message_id: msg.message_id },
      );
      return;
    }

    // If no arguments provided, show help
    if (!args) {
      await sendDuelloHelp(bot, msg);
      return;
    }

    // Parse arguments
    const argParts = args.split(" ");

    if (argParts[0].toLowerCase() === "help") {
      await sendDuelloHelp(bot, msg);
      return;
    }

    if (argParts[0].toLowerCase() === "styles") {
      await sendDuelloStyles(bot, msg);
      return;
    }

    if (argParts[0].toLowerCase() === "challenge") {
      // Format: /duello challenge @username style wager
      if (argParts.length < 3) {
        await bot.sendMessage(
          msg.chat.id,
          "Usage: /duello challenge @username style [wager]\n\nExample: /duello challenge @user aggressive 2.5",
          { reply_to_message_id: msg.message_id },
        );
        return;
      }

      await handleDuelloChallenge(bot, msg, argParts.slice(1));
      return;
    }

    if (argParts[0].toLowerCase() === "open") {
      // Format: /duello open style wager
      if (argParts.length < 2) {
        await bot.sendMessage(
          msg.chat.id,
          "Usage: /duello open style [wager]\n\nExample: /duello open defensive 2.0",
          { reply_to_message_id: msg.message_id },
        );
        return;
      }

      await handleOpenDuello(bot, msg, argParts.slice(1));
      return;
    }

    // If we get here, command format was incorrect
    await sendDuelloHelp(bot, msg);
  } catch (error) {
    await handleError(bot, {
      type: ErrorType.INTERNAL,
      message: "An error occurred while processing the duello command",
      originalError: error as Error,
      chatId: msg.chat.id,
      messageId: msg.message_id,
      userId: msg.from?.id,
    });
  }
}

/**
 * Send duello help information
 */
async function sendDuelloHelp(
  bot: TelegramBot,
  msg: TelegramBot.Message,
): Promise<void> {
  const helpText = `
<b>🤺 Duello - Strategic Dick Duels 🤺</b>

Duello is a strategic PVP system where you can challenge others to dick duels using different fighting styles!

<b>Commands:</b>
• /duello help - Show this help message
• /duello styles - Show information about fighting styles
• /duello challenge @username style [wager] - Challenge a specific user to a duel
• /duello open style [wager] - Create an open challenge anyone can accept

<b>Example:</b>
/duello challenge @username aggressive 2.0

<b>Requirements:</b>
• Minimum dick size: ${MIN_FIGHT_SIZE}cm
• Default wager: 1.0cm (customizable)
• You must wait for your opponent to accept and choose their style

For more details about fighting styles use /duello styles
`;

  await bot.sendMessage(msg.chat.id, helpText, {
    parse_mode: "HTML",
    reply_to_message_id: msg.message_id,
  });
}

/**
 * Send information about duello fighting styles
 */
async function sendDuelloStyles(
  bot: TelegramBot,
  msg: TelegramBot.Message,
): Promise<void> {
  const stylesText = `
<b>🤺 Duello Fighting Styles 🤺</b>

Choose your fighting style wisely as each has different advantages:

<b>🔥 Aggressive</b>
• Higher damage potential
• Lower defense
• Good against Technical

<b>🛡️ Defensive</b>
• Better protection
• Lower attack damage
• Good against Aggressive

<b>⚙️ Technical</b>
• Consistent performance
• Average attack and defense
• Good against Lucky

<b>🍀 Lucky</b>
• Highly unpredictable
• Can deal massive damage or fail entirely
• Good against Defensive

Your fighting style affects how your size advantage is calculated in battle!
`;

  await bot.sendMessage(msg.chat.id, stylesText, {
    parse_mode: "HTML",
    reply_to_message_id: msg.message_id,
  });
}

/**
 * Handle a duello challenge to a specific user
 */
async function handleDuelloChallenge(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  args: string[],
): Promise<void> {
  if (!msg.from) return;

  const groupId = msg.chat.id;
  const challengerId = msg.from.id;

  // Parse target user
  const targetIdentifier = args[0].replace("@", "");

  // Get fighting style
  const style = args[1].toLowerCase();
  if (!Object.values(FIGHTING_STYLES).includes(style)) {
    await bot.sendMessage(
      msg.chat.id,
      `Invalid fighting style: ${style}\n\nUse /duello styles to see available options.`,
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Parse wager (optional)
  let wager = 1.0;
  if (args.length > 2) {
    const parsedWager = parseFloat(args[2]);
    if (isNaN(parsedWager) || parsedWager < 0.5 || parsedWager > 10) {
      await bot.sendMessage(
        msg.chat.id,
        "Wager must be between 0.5 and 10 cm.",
        { reply_to_message_id: msg.message_id },
      );
      return;
    }
    wager = parsedWager;
  }

  // Get challenger
  const challenger = await getOrCreateGroupUser(
    {
      id: challengerId,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name,
      username: msg.from.username,
    },
    groupId,
  );

  // Check if challenger can afford the wager
  if (challenger.size <= wager) {
    await bot.sendMessage(
      msg.chat.id,
      `You can't wager ${wager}cm when your size is only ${formatNumber(challenger.size)}cm. You must keep at least 1cm.`,
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Find target user
  const opponent = await findGroupUserByIdentifier(targetIdentifier, groupId);

  if (!opponent) {
    await bot.sendMessage(
      msg.chat.id,
      `User not found in this group: ${targetIdentifier}`,
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Can't challenge yourself
  if (opponent.userId === challengerId) {
    await bot.sendMessage(
      msg.chat.id,
      "You can't challenge yourself to a duello!",
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Check if target has sufficient size
  if (opponent.size < MIN_FIGHT_SIZE) {
    await bot.sendMessage(
      msg.chat.id,
      `${opponent.firstName}'s dick is too small for a duello! They need at least ${MIN_FIGHT_SIZE}cm.`,
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Create a duello challenge
  const duelloRepo = AppDataSource.getRepository(GroupDuello);

  // Calculate expiration time (30 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);

  // Create the challenge
  const duello = duelloRepo.create({
    groupId,
    challenger,
    challengerId: challenger.id,
    opponent,
    opponentId: opponent.id,
    challengerStyle: style,
    wager,
    status: "pending",
    expiresAt,
    createdAt: new Date(),
  });

  await duelloRepo.save(duello);

  // Create inline keyboard for duello response
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🤺 Accept with Aggressive",
          callback_data: `duello_accept:${duello.id}:aggressive`,
        },
        {
          text: "🛡️ Accept with Defensive",
          callback_data: `duello_accept:${duello.id}:defensive`,
        },
      ],
      [
        {
          text: "⚙️ Accept with Technical",
          callback_data: `duello_accept:${duello.id}:technical`,
        },
        {
          text: "🍀 Accept with Lucky",
          callback_data: `duello_accept:${duello.id}:lucky`,
        },
      ],
      [
        {
          text: "❌ Decline Challenge",
          callback_data: `duello_decline:${duello.id}`,
        },
      ],
    ],
  };

  const styleName = style.charAt(0).toUpperCase() + style.slice(1);

  await bot.sendMessage(
    msg.chat.id,
    `🤺 <b>DUELLO CHALLENGE</b> 🤺\n\n` +
      `${challenger.firstName} has challenged ${opponent.firstName} to a dick duel!\n\n` +
      `🏆 <b>Wager:</b> ${formatNumber(wager)}cm\n` +
      `⚔️ <b>Challenger Style:</b> ${styleName}\n\n` +
      `${opponent.firstName}, choose your fighting style to accept, or decline the challenge.\n` +
      `This challenge expires in 30 minutes.`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    },
  );
}

/**
 * Handle an open duello challenge
 */
async function handleOpenDuello(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  args: string[],
): Promise<void> {
  if (!msg.from) return;

  const groupId = msg.chat.id;
  const challengerId = msg.from.id;

  // Get fighting style
  const style = args[0].toLowerCase();
  if (!Object.values(FIGHTING_STYLES).includes(style)) {
    await bot.sendMessage(
      msg.chat.id,
      `Invalid fighting style: ${style}\n\nUse /duello styles to see available options.`,
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Parse wager (optional)
  let wager = 1.0;
  if (args.length > 1) {
    const parsedWager = parseFloat(args[1]);
    if (isNaN(parsedWager) || parsedWager < 0.5 || parsedWager > 10) {
      await bot.sendMessage(
        msg.chat.id,
        "Wager must be between 0.5 and 10 cm.",
        { reply_to_message_id: msg.message_id },
      );
      return;
    }
    wager = parsedWager;
  }

  // Get challenger
  const challenger = await getOrCreateGroupUser(
    {
      id: challengerId,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name,
      username: msg.from.username,
    },
    groupId,
  );

  // Check if challenger can afford the wager
  if (challenger.size <= wager) {
    await bot.sendMessage(
      msg.chat.id,
      `You can't wager ${wager}cm when your size is only ${formatNumber(challenger.size)}cm. You must keep at least 1cm.`,
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Create a duello challenge
  const duelloRepo = AppDataSource.getRepository(GroupDuello);

  // Calculate expiration time (30 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);

  // Create the challenge
  const duello = duelloRepo.create({
    groupId,
    challenger,
    challengerId: challenger.id,
    challengerStyle: style,
    wager,
    status: "pending",
    expiresAt,
    createdAt: new Date(),
  });

  await duelloRepo.save(duello);

  // Create inline keyboard for duello response
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🤺 Join with Aggressive",
          callback_data: `duello_join:${duello.id}:aggressive`,
        },
        {
          text: "🛡️ Join with Defensive",
          callback_data: `duello_join:${duello.id}:defensive`,
        },
      ],
      [
        {
          text: "⚙️ Join with Technical",
          callback_data: `duello_join:${duello.id}:technical`,
        },
        {
          text: "🍀 Join with Lucky",
          callback_data: `duello_join:${duello.id}:lucky`,
        },
      ],
    ],
  };

  const styleName = style.charAt(0).toUpperCase() + style.slice(1);

  await bot.sendMessage(
    msg.chat.id,
    `🤺 <b>OPEN DUELLO CHALLENGE</b> 🤺\n\n` +
      `${challenger.firstName} has started an open duello challenge!\n\n` +
      `🏆 <b>Wager:</b> ${formatNumber(wager)}cm\n` +
      `⚔️ <b>Challenger Style:</b> ${styleName}\n\n` +
      `Anyone with at least ${MIN_FIGHT_SIZE}cm can join this challenge!\n` +
      `This challenge expires in 30 minutes.`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    },
  );
}
