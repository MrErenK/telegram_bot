import * as TelegramBot from "node-telegram-bot-api";
import { isAdmin } from "./admin/utils";

/**
 * Handles the /help command
 * Shows all available commands and their descriptions
 * If user is admin, also shows admin commands
 */
export async function handleHelp(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  // Basic help text for all users
  let helpText = `
<b>🍆 DickGrowerBot Commands 🍆</b>

/start - Start using the bot and get your initial dick
/grow or /g - Grow your dick (can be used once per day)
/stats or /s - View your dick stats and growth history
/top or /t - See the leaderboard of biggest dicks
/pvp or /fight or /f [wager] - Challenge others to a dick fight
/dickoftheday or /dotd - Pick a random user for a special bonus growth
/help or /h - Show this help message

<b>How to Play:</b>
1. Use /grow once per day to increase (or sometimes decrease) your dick size
2. Challenge others to dick fights with /pvp and let anyone join
3. Win fights to take cm from your opponents
4. Try to reach the top of the leaderboard!
5. Use /dickoftheday to give someone a lucky bonus!

<b>Game Rules:</b>
- Your dick starts at 0cm
- Your dick will never shrink below 1cm
- You need at least 5cm to participate in fights
- Fight wagers can be between 0.5cm and 5.0cm
- In a fight, the winner takes the wagered amount from the loser
- When you grow, there's a 60% chance of shrinking
- Dick of the Day gives a random user 1-15cm bonus growth
`;

  // Add admin commands if the user is the bot owner
  if (msg.from && isAdmin(msg.from.id)) {
    helpText += `

<b>🔐 Admin Commands 🔐</b>

/admin_stats - View detailed bot statistics
/admin_set [username/ID] [attribute] [value] - Modify a user's attributes
/admin_reset [type] [username/ID] - Reset user data
/admin_backup - Create a backup of the database
/admin_get [type] [params] - Get specific database information
/reset_time [username/ID] - Reset a user's grow cooldown time

Run any admin command without arguments for detailed help.
`;
  }

  await bot.sendMessage(msg.chat.id, helpText, { parse_mode: "HTML" });
}
