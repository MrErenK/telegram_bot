import * as TelegramBot from "node-telegram-bot-api";
import { AppDataSource } from "../utils/db";
import { GroupUser, GroupDuello } from "../entity";
import { MIN_FIGHT_SIZE } from "./config/manager";
import { findGroupUserById } from "./db/group-operations";
import { formatNumber } from "./random";
import logger from "./logger";

// Type for style advantages
interface StyleAdvantages {
  [key: string]: string;
}

// Define style advantages: each style has an advantage against one other style
const STYLE_ADVANTAGES: StyleAdvantages = {
  aggressive: "technical",
  defensive: "aggressive",
  technical: "lucky",
  lucky: "defensive",
};

// Interface for history action
interface HistoryAction {
  round: number | string;
  turn?: number;
  action?: string;
  roll?: number;
  modifier?: number;
  damage?: number;
  defense?: number;
  effect?: number;
  message: string;
}

/**
 * Handles a user accepting a duello challenge
 */
export async function handleDuelloAcceptance(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  duelloId: string,
  style: string,
): Promise<void> {
  if (!query.from || !query.message) return;

  const userId = query.from.id;
  const chatId = query.message.chat.id;

  const duelloRepo = AppDataSource.getRepository(GroupDuello);

  try {
    // Get the duello challenge
    const duello = await duelloRepo.findOne({
      where: { id: parseInt(duelloId) },
      relations: ["challenger", "opponent"],
    });

    if (!duello) {
      await bot.answerCallbackQuery(query.id, {
        text: "Challenge not found or has expired.",
        show_alert: true,
      });
      return;
    }

    // Check if challenge is still pending
    if (duello.status !== "pending") {
      await bot.answerCallbackQuery(query.id, {
        text: "This challenge has already been accepted or cancelled.",
        show_alert: true,
      });
      return;
    }

    // Check if challenge has expired
    if (new Date() > duello.expiresAt) {
      duello.status = "expired";
      await duelloRepo.save(duello);

      await bot.answerCallbackQuery(query.id, {
        text: "This challenge has expired.",
        show_alert: true,
      });

      // Update the message
      await bot.editMessageText(
        `🤺 <b>DUELLO CHALLENGE EXPIRED</b> 🤺\n\n` +
          `The challenge from ${duello.challenger.firstName} has expired.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [] },
        },
      );
      return;
    }

    // Check if this challenge was directed at a specific user
    if (duello.opponent && duello.opponent.userId !== userId) {
      await bot.answerCallbackQuery(query.id, {
        text: "This challenge was for another user.",
        show_alert: true,
      });
      return;
    }

    // Find the user
    const user = await findGroupUserById(userId, chatId);

    if (!user) {
      await bot.answerCallbackQuery(query.id, {
        text: "User not found. Please use /start first.",
        show_alert: true,
      });
      return;
    }

    // Check if user has sufficient size
    if (user.size < MIN_FIGHT_SIZE) {
      await bot.answerCallbackQuery(query.id, {
        text: `Your dick is too small for a duello! You need at least ${MIN_FIGHT_SIZE}cm.`,
        show_alert: true,
      });
      return;
    }

    // Check if user can afford the wager
    if (user.size <= duello.wager) {
      await bot.answerCallbackQuery(query.id, {
        text: `You can't afford this wager with your current size of ${formatNumber(user.size)}cm.`,
        show_alert: true,
      });
      return;
    }

    // Update the duello challenge
    duello.opponent = user;
    duello.opponentId = user.id;
    duello.opponentStyle = style;
    duello.status = "active";
    duello.currentTurn = 1; // Challenger goes first

    // Initialize battle history
    const history: HistoryAction[] = [
      {
        round: 1,
        turn: 1,
        message: `The duello has begun! ${duello.challenger.firstName} (${duello.challengerStyle}) vs ${user.firstName} (${style})`,
      },
    ];
    duello.history = JSON.stringify(history);

    await duelloRepo.save(duello);

    // Determine style advantages for cosmetic display
    const challengerStyle = duello.challengerStyle;
    const opponentStyle = style;

    let advantageText = "";
    if (STYLE_ADVANTAGES[challengerStyle] === opponentStyle) {
      advantageText = `\n⚡ ${duello.challenger.firstName}'s ${challengerStyle} style has advantage!`;
    } else if (STYLE_ADVANTAGES[opponentStyle] === challengerStyle) {
      advantageText = `\n⚡ ${user.firstName}'s ${opponentStyle} style has advantage!`;
    }

    // Create inline keyboard for turns
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🎲 Roll Attack",
            callback_data: `duello_attack:${duello.id}`,
          },
          {
            text: "🛡️ Roll Defense",
            callback_data: `duello_defend:${duello.id}`,
          },
        ],
        [
          {
            text: "⚔️ Special Move",
            callback_data: `duello_special:${duello.id}`,
          },
        ],
      ],
    };

    // Update the message
    await bot.editMessageText(
      `🤺 <b>DUELLO BATTLE STARTED</b> 🤺\n\n` +
        `${duello.challenger.firstName} (${challengerStyle}) vs ${user.firstName} (${opponentStyle})\n` +
        `🏆 <b>Wager:</b> ${formatNumber(duello.wager)}cm${advantageText}\n\n` +
        `<b>Round 1 - ${duello.challenger.firstName}'s turn</b>\n` +
        `${duello.challenger.firstName}, choose your action!`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "HTML",
        reply_markup: keyboard,
      },
    );

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    logger.error("Error in handleDuelloAcceptance: ", error as Error);
    await bot.answerCallbackQuery(query.id, {
      text: "An error occurred. Please try again.",
      show_alert: true,
    });
  }
}

/**
 * Handles a duello attack action
 */
export async function handleDuelloAttack(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  duelloId: string,
): Promise<void> {
  if (!query.from || !query.message) return;

  const userId = query.from.id;
  const chatId = query.message.chat.id;

  const duelloRepo = AppDataSource.getRepository(GroupDuello);

  try {
    // Get the duello
    const duello = await duelloRepo.findOne({
      where: { id: parseInt(duelloId) },
      relations: ["challenger", "opponent"],
    });

    if (!duello || !duello.opponent) {
      await bot.answerCallbackQuery(query.id, {
        text: "Duello not found or not active.",
        show_alert: true,
      });
      return;
    }

    // Check if duello is active
    if (duello.status !== "active") {
      await bot.answerCallbackQuery(query.id, {
        text: "This duello battle has ended.",
        show_alert: true,
      });
      return;
    }

    // Check if it's the user's turn
    const currentUser =
      duello.currentTurn === 1 ? duello.challenger : duello.opponent;
    if (currentUser.userId !== userId) {
      await bot.answerCallbackQuery(query.id, {
        text: "It's not your turn!",
        show_alert: true,
      });
      return;
    }

    // Get the current history
    const history = JSON.parse(duello.history) as HistoryAction[];
    const currentRound = history[history.length - 1].round;

    // Calculate attack based on style
    const attackerStyle =
      duello.currentTurn === 1 ? duello.challengerStyle : duello.opponentStyle!;
    const defenderStyle =
      duello.currentTurn === 1 ? duello.opponentStyle! : duello.challengerStyle;

    // Basic roll (1-10)
    let attackRoll = Math.floor(Math.random() * 10) + 1;

    // Style-based modifiers
    let attackModifier = 1.0;

    // Apply style modifiers
    switch (attackerStyle) {
      case "aggressive":
        attackModifier = 1.5;
        break;
      case "defensive":
        attackModifier = 0.7;
        break;
      case "technical":
        attackModifier = 1.2;
        break;
      case "lucky":
        // Lucky has a wide variance
        attackModifier = Math.random() < 0.3 ? 2.0 : 0.5;
        break;
    }

    // Apply style advantage
    if (STYLE_ADVANTAGES[attackerStyle] === defenderStyle) {
      attackModifier *= 1.3;
    }

    // Calculate final damage
    const rawDamage = attackRoll * attackModifier;
    const finalDamage = Math.max(
      0.1,
      Math.min(5, Number(rawDamage.toFixed(1))),
    );

    // Add the action to history
    history.push({
      round: currentRound as number,
      turn: duello.currentTurn,
      action: "attack",
      roll: attackRoll,
      modifier: attackModifier,
      damage: finalDamage,
      message: `${currentUser.firstName} attacks for ${finalDamage}cm damage!`,
    });

    // Update turn
    duello.currentTurn = duello.currentTurn === 1 ? 2 : 1;

    // Check if round completed (both players have taken a turn)
    const isNewRound =
      history.filter((h: HistoryAction) => h.round === currentRound).length >=
      2;

    // Update history
    duello.history = JSON.stringify(history);

    await duelloRepo.save(duello);

    // Format the battle log
    const lastActions = history.slice(-4); // Show last 4 actions
    const battleLog = lastActions
      .map((action: HistoryAction) => {
        return `• ${action.message}`;
      })
      .join("\n");

    // Create message content
    let messageContent =
      `🤺 <b>DUELLO BATTLE</b> 🤺\n\n` +
      `${duello.challenger.firstName} (${duello.challengerStyle}) vs ${duello.opponent.firstName} (${duello.opponentStyle})\n` +
      `🏆 <b>Wager:</b> ${formatNumber(duello.wager)}cm\n\n` +
      `<b>${isNewRound ? `Round ${Number(currentRound) + 1}` : `Round ${currentRound}`} - ${duello.currentTurn === 1 ? duello.challenger.firstName : duello.opponent.firstName}'s turn</b>\n\n` +
      `<b>Battle Log:</b>\n${battleLog}\n\n`;

    // Create inline keyboard for turns
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🎲 Roll Attack",
            callback_data: `duello_attack:${duello.id}`,
          },
          {
            text: "🛡️ Roll Defense",
            callback_data: `duello_defend:${duello.id}`,
          },
        ],
        [
          {
            text: "⚔️ Special Move",
            callback_data: `duello_special:${duello.id}`,
          },
        ],
      ],
    };

    // Update the message
    await bot.editMessageText(messageContent, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    logger.error("Error in handleDuelloAttack: ", error as Error);
    await bot.answerCallbackQuery(query.id, {
      text: "An error occurred. Please try again.",
      show_alert: true,
    });
  }
}

/**
 * Handles a duello defend action
 */
export async function handleDuelloDefend(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  duelloId: string,
): Promise<void> {
  if (!query.from || !query.message) return;

  const userId = query.from.id;
  const chatId = query.message.chat.id;

  const duelloRepo = AppDataSource.getRepository(GroupDuello);

  try {
    // Get the duello
    const duello = await duelloRepo.findOne({
      where: { id: parseInt(duelloId) },
      relations: ["challenger", "opponent"],
    });

    if (!duello || !duello.opponent) {
      await bot.answerCallbackQuery(query.id, {
        text: "Duello not found or not active.",
        show_alert: true,
      });
      return;
    }

    // Check if duello is active
    if (duello.status !== "active") {
      await bot.answerCallbackQuery(query.id, {
        text: "This duello battle has ended.",
        show_alert: true,
      });
      return;
    }

    // Check if it's the user's turn
    const currentUser =
      duello.currentTurn === 1 ? duello.challenger : duello.opponent;
    if (currentUser.userId !== userId) {
      await bot.answerCallbackQuery(query.id, {
        text: "It's not your turn!",
        show_alert: true,
      });
      return;
    }

    // Get the current history
    const history = JSON.parse(duello.history) as HistoryAction[];
    const currentRound = history[history.length - 1].round;

    // Basic roll (1-10)
    let defenseRoll = Math.floor(Math.random() * 10) + 1;

    // Get the defender's style
    const defenderStyle =
      duello.currentTurn === 1 ? duello.challengerStyle : duello.opponentStyle!;

    // Style-based modifiers
    let defenseModifier = 1.0;

    // Apply style modifiers
    switch (defenderStyle) {
      case "aggressive":
        defenseModifier = 0.7;
        break;
      case "defensive":
        defenseModifier = 1.8;
        break;
      case "technical":
        defenseModifier = 1.2;
        break;
      case "lucky":
        // Lucky has a wide variance
        defenseModifier = Math.random() < 0.3 ? 2.0 : 0.5;
        break;
    }

    // Calculate defense boost
    const defenseBoost = defenseRoll * defenseModifier;
    const finalDefense = Math.max(
      0.1,
      Math.min(5, Number(defenseBoost.toFixed(1))),
    );

    // Add the action to history
    history.push({
      round: currentRound as number,
      turn: duello.currentTurn,
      action: "defend",
      roll: defenseRoll,
      modifier: defenseModifier,
      defense: finalDefense,
      message: `${currentUser.firstName} gains ${finalDefense}cm defense boost!`,
    });

    // Update turn
    duello.currentTurn = duello.currentTurn === 1 ? 2 : 1;

    // Check if round completed (both players have taken a turn)
    const isNewRound =
      history.filter((h: HistoryAction) => h.round === currentRound).length >=
      2;

    // Update history
    duello.history = JSON.stringify(history);

    await duelloRepo.save(duello);

    // Format the battle log
    const lastActions = history.slice(-4); // Show last 4 actions
    const battleLog = lastActions
      .map((action: HistoryAction) => {
        return `• ${action.message}`;
      })
      .join("\n");

    // Create message content
    let messageContent =
      `🤺 <b>DUELLO BATTLE</b> 🤺\n\n` +
      `${duello.challenger.firstName} (${duello.challengerStyle}) vs ${duello.opponent.firstName} (${duello.opponentStyle})\n` +
      `🏆 <b>Wager:</b> ${formatNumber(duello.wager)}cm\n\n` +
      `<b>${isNewRound ? `Round ${Number(currentRound) + 1}` : `Round ${currentRound}`} - ${duello.currentTurn === 1 ? duello.challenger.firstName : duello.opponent.firstName}'s turn</b>\n\n` +
      `<b>Battle Log:</b>\n${battleLog}\n\n`;

    // Create inline keyboard for turns
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🎲 Roll Attack",
            callback_data: `duello_attack:${duello.id}`,
          },
          {
            text: "🛡️ Roll Defense",
            callback_data: `duello_defend:${duello.id}`,
          },
        ],
        [
          {
            text: "⚔️ Special Move",
            callback_data: `duello_special:${duello.id}`,
          },
        ],
      ],
    };

    // Update the message
    await bot.editMessageText(messageContent, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    logger.error("Error in handleDuelloDefend: ", error as Error);
    await bot.answerCallbackQuery(query.id, {
      text: "An error occurred. Please try again.",
      show_alert: true,
    });
  }
}

/**
 * Handles a duello special move action
 */
export async function handleDuelloSpecial(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  duelloId: string,
): Promise<void> {
  if (!query.from || !query.message) return;

  const userId = query.from.id;
  const chatId = query.message.chat.id;

  const duelloRepo = AppDataSource.getRepository(GroupDuello);

  try {
    // Get the duello
    const duello = await duelloRepo.findOne({
      where: { id: parseInt(duelloId) },
      relations: ["challenger", "opponent"],
    });

    if (!duello || !duello.opponent) {
      await bot.answerCallbackQuery(query.id, {
        text: "Duello not found or not active.",
        show_alert: true,
      });
      return;
    }

    // Check if duello is active
    if (duello.status !== "active") {
      await bot.answerCallbackQuery(query.id, {
        text: "This duello battle has ended.",
        show_alert: true,
      });
      return;
    }

    // Check if it's the user's turn
    const currentUser =
      duello.currentTurn === 1 ? duello.challenger : duello.opponent;
    if (currentUser.userId !== userId) {
      await bot.answerCallbackQuery(query.id, {
        text: "It's not your turn!",
        show_alert: true,
      });
      return;
    }

    // Get the current history
    const history = JSON.parse(duello.history) as HistoryAction[];
    const currentRound = history[history.length - 1].round;

    // Get the user's style
    const userStyle =
      duello.currentTurn === 1 ? duello.challengerStyle : duello.opponentStyle!;

    // Special moves based on style
    let specialMessage: string;
    let specialEffect: number;

    // Each style has a different special move
    switch (userStyle) {
      case "aggressive":
        // Critical Strike: High damage but always takes some recoil damage
        specialEffect = Math.floor(Math.random() * 4) + 2; // 2-5
        specialMessage = `${currentUser.firstName} uses <b>Critical Strike</b> for ${specialEffect}cm damage, but takes 1cm recoil damage!`;
        break;
      case "defensive":
        // Counterattack: Returns damage from last attack
        // Find the last attack against this user
        const lastOpponentAttack = [...history]
          .reverse()
          .find(
            (action: HistoryAction) =>
              action.action === "attack" && action.turn !== duello.currentTurn,
          );

        if (lastOpponentAttack && lastOpponentAttack.damage) {
          specialEffect = lastOpponentAttack.damage;
          specialMessage = `${currentUser.firstName} uses <b>Counterattack</b>, returning ${specialEffect}cm damage!`;
        } else {
          specialEffect = 1;
          specialMessage = `${currentUser.firstName} uses <b>Counterattack</b>, but there's nothing to counter! Deals 1cm damage.`;
        }
        break;
      case "technical":
        // Precision Strike: Consistent medium damage
        specialEffect = 3;
        specialMessage = `${currentUser.firstName} uses <b>Precision Strike</b> for exactly 3cm damage!`;
        break;
      case "lucky":
        // Gamble: Can be very powerful or completely fail
        const gambleRoll = Math.random();
        if (gambleRoll < 0.1) {
          // Super critical! (10% chance)
          specialEffect = 7;
          specialMessage = `${currentUser.firstName} uses <b>Gamble</b> and hits a <b>SUPER CRITICAL</b> for 7cm damage!`;
        } else if (gambleRoll < 0.4) {
          // Success (30% chance)
          specialEffect = 4;
          specialMessage = `${currentUser.firstName} uses <b>Gamble</b> successfully for 4cm damage!`;
        } else if (gambleRoll < 0.7) {
          // Mild success (30% chance)
          specialEffect = 2;
          specialMessage = `${currentUser.firstName} uses <b>Gamble</b> for 2cm damage.`;
        } else {
          // Failure (30% chance)
          specialEffect = 0;
          specialMessage = `${currentUser.firstName} uses <b>Gamble</b> and fails completely!`;
        }
        break;
      default:
        specialEffect = 1;
        specialMessage = `${currentUser.firstName} uses a basic special move for 1cm damage.`;
    }

    // Add the action to history
    history.push({
      round: currentRound as number,
      turn: duello.currentTurn,
      action: "special",
      effect: specialEffect,
      message: specialMessage,
    });

    // Check if we need to account for recoil damage
    if (userStyle === "aggressive") {
      // Add recoil effect to history
      history.push({
        round: currentRound as number,
        turn: duello.currentTurn,
        action: "recoil",
        effect: 1,
        message: `${currentUser.firstName} takes 1cm recoil damage!`,
      });
    }

    // Update turn
    duello.currentTurn = duello.currentTurn === 1 ? 2 : 1;

    // Check if round completed (both players have taken a turn)
    const isNewRound =
      history.filter((h: HistoryAction) => h.round === currentRound).length >=
      2;

    // Update history
    duello.history = JSON.stringify(history);

    // Check if the battle should end (3 rounds completed)
    if (Number(currentRound) >= 3 && isNewRound) {
      // Complete the duello battle
      await completeDuello(bot, duello, query.message);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    await duelloRepo.save(duello);

    // Format the battle log
    const lastActions = history.slice(-4); // Show last 4 actions
    const battleLog = lastActions
      .map((action: HistoryAction) => {
        return `• ${action.message}`;
      })
      .join("\n");

    // Create message content
    let messageContent =
      `🤺 <b>DUELLO BATTLE</b> 🤺\n\n` +
      `${duello.challenger.firstName} (${duello.challengerStyle}) vs ${duello.opponent.firstName} (${duello.opponentStyle})\n` +
      `🏆 <b>Wager:</b> ${formatNumber(duello.wager)}cm\n\n` +
      `<b>${isNewRound ? `Round ${Number(currentRound) + 1}` : `Round ${currentRound}`} - ${duello.currentTurn === 1 ? duello.challenger.firstName : duello.opponent.firstName}'s turn</b>\n\n` +
      `<b>Battle Log:</b>\n${battleLog}\n\n`;

    // Create inline keyboard for turns
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🎲 Roll Attack",
            callback_data: `duello_attack:${duello.id}`,
          },
          {
            text: "🛡️ Roll Defense",
            callback_data: `duello_defend:${duello.id}`,
          },
        ],
        [
          {
            text: "⚔️ Special Move",
            callback_data: `duello_special:${duello.id}`,
          },
        ],
      ],
    };

    // Update the message
    await bot.editMessageText(messageContent, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    logger.error("Error in handleDuelloSpecial: ", error as Error);
    await bot.answerCallbackQuery(query.id, {
      text: "An error occurred. Please try again.",
      show_alert: true,
    });
  }
}

/**
 * Completes a duello battle and determines the winner
 */
async function completeDuello(
  bot: TelegramBot,
  duello: GroupDuello,
  message: TelegramBot.Message,
): Promise<void> {
  try {
    // Calculate total damage for each player
    const history = JSON.parse(duello.history) as HistoryAction[];

    let challengerDamage = 0;
    let opponentDamage = 0;

    // Calculate damage dealt by each player
    history.forEach((action: HistoryAction) => {
      if (action.action === "attack" || action.action === "special") {
        if (action.turn === 1) {
          // Challenger's action
          opponentDamage += action.damage || action.effect || 0;
        } else {
          // Opponent's action
          challengerDamage += action.damage || action.effect || 0;
        }
      } else if (action.action === "recoil") {
        if (action.turn === 1) {
          // Challenger's recoil
          challengerDamage += action.effect || 0;
        } else {
          // Opponent's recoil
          opponentDamage += action.effect || 0;
        }
      }
    });

    // Determine winner
    let winner: GroupUser | null = null;
    let loser: GroupUser | null = null;

    if (challengerDamage > opponentDamage) {
      winner = duello.opponent;
      loser = duello.challenger;
    } else if (opponentDamage > challengerDamage) {
      winner = duello.challenger;
      loser = duello.opponent;
    } // If equal, it's a tie and no one wins

    // Update duello with result
    duello.status = "completed";
    duello.completedAt = new Date();

    if (winner) {
      duello.winner = winner;
      duello.winnerId = winner.id;

      // Add final result to history
      history.push({
        round: "end",
        message: `${winner.firstName} wins the duello by dealing ${winner === duello.challenger ? opponentDamage : challengerDamage}cm vs ${winner === duello.challenger ? challengerDamage : opponentDamage}cm!`,
      });

      // Update user sizes
      const groupUserRepo = AppDataSource.getRepository(GroupUser);

      winner.size += duello.wager;
      if (loser) {
        loser.size = Math.max(1, loser.size - duello.wager); // Don't go below 1cm

        // Update win/loss counts
        winner.wins += 1;
        loser.losses += 1;

        await groupUserRepo.save(loser);
      }

      await groupUserRepo.save(winner);
    } else {
      // Tie
      history.push({
        round: "end",
        message: `The duello ends in a tie! Both players dealt ${challengerDamage}cm damage.`,
      });
    }

    duello.history = JSON.stringify(history);

    const duelloRepo = AppDataSource.getRepository(GroupDuello);
    await duelloRepo.save(duello);

    // Generate battle summary
    const battleLog = history
      .filter((action: HistoryAction) => action.message) // Only show actions with messages
      .slice(-8) // Show last 8 actions including result
      .map((action: HistoryAction) => `• ${action.message}`)
      .join("\n");

    // Create final message
    let finalMessage =
      `🤺 <b>DUELLO COMPLETE</b> 🤺\n\n` +
      `${duello.challenger.firstName} (${duello.challengerStyle}) vs ${duello.opponent?.firstName} (${duello.opponentStyle})\n` +
      `🏆 <b>Wager:</b> ${formatNumber(duello.wager)}cm\n\n` +
      `<b>Final Score:</b>\n` +
      `${duello.challenger.firstName}: ${opponentDamage}cm damage dealt\n` +
      `${duello.opponent?.firstName}: ${challengerDamage}cm damage dealt\n\n` +
      `<b>Battle Log:</b>\n${battleLog}\n\n`;

    if (winner && loser) {
      finalMessage +=
        `<b>${winner.firstName} wins and takes ${formatNumber(duello.wager)}cm from ${loser.firstName}!</b>\n\n` +
        `New sizes:\n` +
        `${duello.challenger.firstName}: ${formatNumber(duello.challenger.size)}cm\n` +
        `${duello.opponent?.firstName}: ${formatNumber(duello.opponent?.size ?? 0)}cm`;
    } else {
      finalMessage += `<b>The duello ends in a tie! No size changes.</b>`;
    }

    // Update the message with the final result (no keyboard)
    await bot.editMessageText(finalMessage, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [] },
    });
  } catch (error) {
    logger.error("Error in completeDuello: ", error as Error);
    // Try to send a message about the error
    try {
      await bot.sendMessage(
        message.chat.id,
        "An error occurred while completing the duello.",
      );
    } catch (err) {
      // Ignore errors in sending the error message
    }
  }
}

/**
 * Handles a user declining a duello challenge
 */
export async function handleDuelloDecline(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  duelloId: string,
): Promise<void> {
  if (!query.from || !query.message) return;

  const userId = query.from.id;
  const chatId = query.message.chat.id;

  const duelloRepo = AppDataSource.getRepository(GroupDuello);

  try {
    // Get the duello challenge
    const duello = await duelloRepo.findOne({
      where: { id: parseInt(duelloId) },
      relations: ["challenger", "opponent"],
    });

    if (!duello) {
      await bot.answerCallbackQuery(query.id, {
        text: "Challenge not found or has expired.",
        show_alert: true,
      });
      return;
    }

    // Check if challenge is still pending
    if (duello.status !== "pending") {
      await bot.answerCallbackQuery(query.id, {
        text: "This challenge has already been accepted or cancelled.",
        show_alert: true,
      });
      return;
    }

    // Check if the user is allowed to decline
    // Only the target or the challenger can decline
    if (
      duello.opponent &&
      duello.opponent.userId !== userId &&
      duello.challenger.userId !== userId
    ) {
      await bot.answerCallbackQuery(query.id, {
        text: "Only the challenged user or the challenger can decline this duello.",
        show_alert: true,
      });
      return;
    }

    // Mark as declined
    duello.status = "declined";
    await duelloRepo.save(duello);

    // Update the message
    await bot.editMessageText(
      `🤺 <b>DUELLO CHALLENGE DECLINED</b> 🤺\n\n` +
        `The duello challenge from ${duello.challenger.firstName} ${duello.opponent ? `to ${duello.opponent.firstName} ` : ``}has been declined.`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      },
    );

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    logger.error("Error in handleDuelloDecline: ", error as Error);
    await bot.answerCallbackQuery(query.id, {
      text: "An error occurred. Please try again.",
      show_alert: true,
    });
  }
}
