import TelegramBot from "node-telegram-bot-api";
import { findGroupUserById, completeGroupFight } from "./db/group-operations";
import { MIN_FIGHT_SIZE } from "./config/manager";
import { getGroupFightRepository } from "./db";

/**
 * Handles the callback queries for group fight acceptance
 */
export async function handleGroupFightAcceptance(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery,
  fightId: string
): Promise<void> {
  try {
    const msg = callbackQuery.message;
    if (!msg) return;

    const fightRepo = getGroupFightRepository();
    const fight = await fightRepo.findOne({
      where: { id: parseInt(fightId) },
      relations: { initiator: true, target: true }
    });

    if (!fight) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Fight not found!",
      });
      return;
    }

    const userId = callbackQuery.from.id;
    const groupId = msg.chat.id;

    // Can't accept your own challenge
    if (fight.initiator.userId === userId) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "You can't accept your own challenge!",
      });
      return;
    }

    // If target is already set, only they can accept
    if (fight.target && fight.target.userId !== userId) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "This fight challenge was already accepted by someone else!",
      });
      return;
    }

    // Get the accepting user
    const acceptingUser = await findGroupUserById(userId, groupId);

    if (!acceptingUser) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "You need to use /start first!",
      });
      return;
    }

    // Check if user has sufficient size
    if (acceptingUser.size < MIN_FIGHT_SIZE) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `Your dick is too small to fight! You need at least ${MIN_FIGHT_SIZE} cm.`,
      });
      return;
    }

    // Check if wager is too high for the user
    // Maximum wager is now the user's size (can bet their entire size)
    const maxAllowedWager = acceptingUser.size;
    if (fight.wager > maxAllowedWager) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `The wager of ${fight.wager}cm is too high for your ${acceptingUser.size}cm dick! Your max wager is ${maxAllowedWager}cm.`,
      });
      return;
    }

    // Set the target if not already set
    if (!fight.target) {
      fight.target = acceptingUser;
      await fightRepo.save(fight);
    }

    // Check if fight already has a winner
    if (fight.winnerId) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "This fight has already ended!",
      });
      return;
    }

    // Generate random roll values (1-100)
    const initiatorRoll = Math.floor(Math.random() * 100) + 1;
    const targetRoll = Math.floor(Math.random() * 100) + 1;

    // Complete the fight with the roll values
    const completedFight = await completeGroupFight(
      fight.id,
      initiatorRoll,
      targetRoll
    );

    let winner = completedFight.fight.winner;
    let initiator = completedFight.fight.initiator;
    let target = completedFight.fight.target;

    // Handle roll results
    let resultMessage: string;

    if (initiatorRoll === targetRoll) {
      // It's a tie
      resultMessage =
        `🥊 <b>FIGHT RESULTS</b> 🥊\n\n` +
        `<b>It's a tie!</b>\n` +
        `${initiator.firstName} rolled <b>${initiatorRoll}</b>\n` +
        `${target?.firstName} also rolled <b>${targetRoll}</b>\n\n` +
        `No size changes were made.`;
    } else if (winner) {
      // We have a winner
      const loser = winner.id === initiator.id ? target : initiator;

      // Format sizes without decimal if they're whole numbers
      const initiatorSize = Number.isInteger(initiator.size)
        ? initiator.size
        : initiator.size.toFixed(1);
      const targetSize = target
        ? Number.isInteger(target.size)
          ? target.size
          : target.size.toFixed(1)
        : 0;
      const wagerDisplay = Number.isInteger(completedFight.fight.wager)
        ? completedFight.fight.wager
        : completedFight.fight.wager.toFixed(1);

      let winnerRank = "";
      let loserRank = "";

      if (completedFight.oldWinnerRank && completedFight.newWinnerRank) {
        if (completedFight.oldWinnerRank > completedFight.newWinnerRank) {
          winnerRank = `\n🔼 Rank improved! ${completedFight.oldWinnerRank} → ${completedFight.newWinnerRank}`;
        } else {
          winnerRank = `\n🔄 Rank unchanged: ${completedFight.newWinnerRank}`;
        }
      }

      if (completedFight.oldLoserRank && completedFight.newLoserRank) {
        if (completedFight.oldLoserRank < completedFight.newLoserRank) {
          loserRank = `\n🔽 Rank dropped! ${completedFight.oldLoserRank} → ${completedFight.newLoserRank}`;
        } else {
          loserRank = `\n🔄 Rank unchanged: ${completedFight.newLoserRank}`;
        }
      }

      resultMessage =
        `🥊 <b>FIGHT RESULTS</b> 🥊\n\n` +
        `${winner.firstName} won against ${loser?.firstName}!\n` +
        `${initiator.firstName} rolled <b>${initiatorRoll}</b>\n` +
        `${target?.firstName} rolled <b>${targetRoll}</b>\n\n` +
        `${winner.firstName} took ${wagerDisplay}cm from ${loser?.firstName}.\n\n` +
        `New sizes:\n` +
        `${initiator.firstName}: ${initiatorSize}cm\n` +
        `${target?.firstName}: ${targetSize}cm` +
        `${winnerRank}${loserRank}`;
    } else {
      // Shouldn't happen, but just in case
      resultMessage =
        `🥊 <b>FIGHT RESULTS</b> 🥊\n\n` +
        `${initiator.firstName} rolled <b>${initiatorRoll}</b>\n` +
        `${target?.firstName} rolled <b>${targetRoll}</b>\n\n` +
        `There was an error determining the winner.`;
    }

    // Update the message
    await bot.editMessageText(resultMessage, {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [] }, // Remove buttons after fight is complete
    });

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Fight completed!",
    });
  } catch (error) {
    console.error("Error handling fight acceptance:", error);

    // Try to answer the callback query with an error message
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "An error occurred. Please try again.",
        show_alert: true,
      });
    } catch (err) {
      // Ignore errors answering the callback
    }
  }
}
