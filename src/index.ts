import TelegramBot from "node-telegram-bot-api";
import { BOT_TOKEN, ADMIN_IDS } from "./utils/config/manager";
import {
  handleStart,
  handleGrow,
  handleStats,
  handleTop,
  handleHelp,
  handleDickOfTheDay,
} from "./commands";
import { handleTopPagination } from "./commands/top";
import { handlePvp } from "./commands/pvp";
import { initializeDatabase } from "./utils/db";
import { handleGroupFightAcceptance } from "./utils/group-callbacks";
import { registerAdminCommands } from "./commands/admin";
import { handleResetConfirmation } from "./commands/admin/reset";
import { handleResetTime } from "./commands/admin/reset-time";
import logger from "./utils/logger";
import {
  Command,
  CallbackQuery,
  registerCommands,
  registerCallbackQueries,
  setAdminUserIds,
} from "./utils/commands/handler";
import { handleDuello } from "./commands/duello";
import {
  handleDuelloAcceptance,
  handleDuelloAttack,
  handleDuelloDefend,
  handleDuelloDecline,
  handleDuelloSpecial,
} from "./utils/duello-callbacks";

// Initialize the bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Set admin user IDs
setAdminUserIds(ADMIN_IDS);

// Define commands
const commands: Command[] = [
  {
    name: "start",
    description: "Start the bot",
    regex: /^\/start(@\w+)?$/,
    handler: handleStart,
  },
  {
    name: "grow",
    aliases: ["g", "uzat", "yarakuzat", "tasakuzat", "sikuzat"],
    description: "Grow your dick",
    regex: /^\/grow(@\w+)?$/,
    handler: handleGrow,
  },
  {
    name: "stats",
    aliases: ["s", "st", "yarakim", "yarak", "sikim", "tasagim", "tasak"],
    description: "View your stats",
    regex: /^\/stats(@\w+)?$/,
    handler: handleStats,
  },
  {
    name: "top",
    aliases: ["t", "l", "leaderboard"],
    description: "View the leaderboard",
    regex: /^\/top(@\w+)?$/,
    handler: async (
      bot: TelegramBot,
      msg: TelegramBot.Message,
      match: RegExpExecArray | null | undefined,
    ) => {
      await handleTop(bot, msg, 1);
    },
  },
  {
    name: "help",
    aliases: ["h"],
    description: "Show help information",
    regex: /^\/help(@\w+)?$/,
    handler: handleHelp,
  },
  {
    name: "pvp",
    aliases: ["fight", "f", "savas", "kavga", "dovus"],
    description: "Challenge someone to a PVP battle",
    regex: /^\/pvp(@\w+)?(\s+(.+))?$/,
    handler: async (
      bot: TelegramBot,
      msg: TelegramBot.Message,
      match: RegExpExecArray | null | undefined,
    ) => {
      const wagerStr = match?.[3]?.trim();
      const wager = wagerStr ? parseFloat(wagerStr) : 1.0;
      await handlePvp(bot, msg, wager);
    },
  },
  {
    name: "dickoftheday",
    aliases: ["dotd", "dick_of_the_day", "dickday"],
    description: "Pick a random user for a special bonus growth",
    regex: /^\/dickoftheday(@\w+)?$/,
    handler: handleDickOfTheDay,
  },
  {
    name: "reset_time",
    description: "Reset cooldown time (admin only)",
    regex: /^\/reset_time(@\w+)?(\s+(.+))?$/,
    handler: handleResetTime,
    adminOnly: true,
  },
  {
    name: "duello",
    aliases: ["duel", "dl"],
    description: "Challenge someone to a strategic dick duel",
    regex: /^\/duello(@\w+)?(?:\s+(.*))?$/,
    handler: async (
      bot: TelegramBot,
      msg: TelegramBot.Message,
      match: RegExpExecArray | null | undefined,
    ) => {
      const args = match?.[2]?.trim();
      await handleDuello(bot, msg, args);
    },
  },
];

// Define callback queries
const callbackQueries: CallbackQuery[] = [
  {
    name: "accept_fight",
    prefix: "accept_fight:",
    handler: async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
      if (!query.data) return;
      const fightId = query.data.split(":")[1];
      await handleGroupFightAcceptance(bot, query, fightId);
    },
  },
  {
    name: "reset_confirmation",
    prefix: "reset_",
    handler: handleResetConfirmation,
  },
  {
    name: "top_pagination",
    prefix: "top_",
    handler: async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
      if (
        query.data?.startsWith("top_page:") ||
        query.data?.startsWith("top_noop:")
      ) {
        await handleTopPagination(bot, query);
      }
    },
  },
  {
    name: "duello_acceptance",
    prefix: "duello_accept:",
    handler: async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
      if (!query.data) return;
      const [_, duelloId, style] = query.data.split(":");
      await handleDuelloAcceptance(bot, query, duelloId, style);
    },
  },
  {
    name: "duello_join",
    prefix: "duello_join:",
    handler: async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
      if (!query.data) return;
      const [_, duelloId, style] = query.data.split(":");
      await handleDuelloAcceptance(bot, query, duelloId, style);
    },
  },
  {
    name: "duello_decline",
    prefix: "duello_decline:",
    handler: async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
      if (!query.data) return;
      const duelloId = query.data.split(":")[1];
      await handleDuelloDecline(bot, query, duelloId);
    },
  },
  {
    name: "duello_turn",
    prefix: "duello_",
    handler: async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
      if (!query.data) return;
      const [action, duelloId] = query.data.split(":");

      if (action === "duello_attack") {
        await handleDuelloAttack(bot, query, duelloId);
      } else if (action === "duello_defend") {
        await handleDuelloDefend(bot, query, duelloId);
      } else if (action === "duello_special") {
        await handleDuelloSpecial(bot, query, duelloId);
      }
    },
  },
];

// Initialize database connection
initializeDatabase()
  .then(() => {
    // Register commands and callbacks
    registerCommands(bot, commands);
    registerCallbackQueries(bot, callbackQueries);

    // Register admin commands
    registerAdminCommands(bot);

    logger.info("Bot has started polling");
  })
  .catch((error) => {
    logger.error("Error during Data Source initialization:", error);
    process.exit(1);
  });
