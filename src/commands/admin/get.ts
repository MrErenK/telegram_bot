import * as TelegramBot from "node-telegram-bot-api";
import { AppDataSource } from "../../utils/db";
import { GroupUser, GroupGrowth, GroupFight } from "../../entity";
import * as fs from "fs";
import { DB_PATH } from "../../utils/config/manager";
import { formatNumber } from "../../utils/formatting-utils";

/**
 * Admin command to get detailed database information
 * Usage: /admin_get <type>
 * Examples:
 * - /admin_get db_info - Get database file info
 * - /admin_get user 123456789 - Get detailed info about a specific user in this group
 * - /admin_get inactive - Get list of inactive users in this group
 */
export async function getCommand(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  args?: string
): Promise<void> {
  // Check if this is a group chat
  if (msg.chat.type === "private") {
    await bot.sendMessage(
      msg.chat.id,
      "This command can only be used in group chats.",
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  if (!args) {
    await bot.sendMessage(
      msg.chat.id,
      "Usage: /admin_get <type> [params]\n\n" +
        "Available types:\n" +
        "- db_info - Database file and stats info\n" +
        "- user <user_id or @username> - Detailed info about a specific user in this group\n" +
        "- inactive [days=30] - List users who haven't grown in X days in this group\n" +
        "- top_growers [count=10] - Users with most growth attempts in this group\n" +
        "- top_fighters [count=10] - Users with most fights in this group\n" +
        "- wagers - List all active wagers in this group\n",
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  const argParts = args.split(" ");
  const getType = argParts[0].toLowerCase();
  const groupId = msg.chat.id;

  try {
    switch (getType) {
      case "db_info":
        await getDatabaseInfo(bot, msg);
        break;

      case "user":
        if (argParts.length < 2) {
          await bot.sendMessage(
            msg.chat.id,
            "Please specify a user ID or username: /admin_get user <user_id or @username>",
            { reply_to_message_id: msg.message_id }
          );
          return;
        }
        await getUserInfo(bot, msg, argParts[1]);
        break;

      case "inactive":
        const days = argParts.length > 1 ? parseInt(argParts[1]) : 30;
        await getInactiveUsers(bot, msg, days);
        break;

      case "top_growers":
        const growCount = argParts.length > 1 ? parseInt(argParts[1]) : 10;
        await getTopGrowers(bot, msg, growCount);
        break;

      case "top_fighters":
        const fightCount = argParts.length > 1 ? parseInt(argParts[1]) : 10;
        await getTopFighters(bot, msg, fightCount);
        break;

      case "wagers":
        await getActiveWagers(bot, msg);
        break;

      default:
        await bot.sendMessage(
          msg.chat.id,
          `Unknown get type: ${getType}. Use /admin_get for help.`,
          { reply_to_message_id: msg.message_id }
        );
    }
  } catch (error) {
    await bot.sendMessage(
      msg.chat.id,
      `Error executing get command: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      { reply_to_message_id: msg.message_id }
    );
  }
}

/**
 * Get database file and stats info
 */
async function getDatabaseInfo(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  const groupId = msg.chat.id;
  // Get database file info
  let dbFileInfo = "Database file not found";

  try {
    const stats = fs.statSync(DB_PATH);
    const fileSizeInMB = stats.size / (1024 * 1024);

    dbFileInfo =
      `Database file: ${DB_PATH}\n` +
      `Size: ${fileSizeInMB.toFixed(2)} MB\n` +
      `Created: ${stats.birthtime.toISOString()}\n` +
      `Last modified: ${stats.mtime.toISOString()}`;
  } catch (error) {
    dbFileInfo = `Error getting database file info: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }

  // Get record counts for group-specific entities
  const groupUserCount = await AppDataSource.getRepository(GroupUser).count();
  const groupGrowthCount = await AppDataSource.getRepository(
    GroupGrowth
  ).count();
  const groupFightCount = await AppDataSource.getRepository(GroupFight).count();

  // Get group-specific counts for this group
  const thisGroupUserCount = await AppDataSource.getRepository(GroupUser).count(
    {
      where: { groupId },
    }
  );
  const thisGroupGrowthCount = await AppDataSource.getRepository(GroupGrowth)
    .createQueryBuilder("groupGrowth")
    .innerJoin("groupGrowth.groupUser", "groupUser")
    .where("groupUser.groupId = :groupId", { groupId })
    .getCount();
  const thisGroupFightCount = await AppDataSource.getRepository(
    GroupFight
  ).count({
    where: { groupId },
  });

  // Get database version
  let dbVersion = "Unknown";
  try {
    const result = await AppDataSource.query(
      "SELECT sqlite_version() as version"
    );
    dbVersion = result[0].version;
  } catch (error) {
    dbVersion = "Error getting version";
  }

  // Get number of tables
  let tableCount = "Unknown";
  try {
    const result = await AppDataSource.query(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table'"
    );
    tableCount = result[0].count;
  } catch (error) {
    tableCount = "Error getting table count";
  }

  // Build message
  const message =
    `📊 <b>DATABASE INFORMATION</b>\n\n` +
    `<b>File Information:</b>\n${dbFileInfo}\n\n` +
    `<b>Database Engine:</b>\n` +
    `Type: SQLite\n` +
    `Version: ${dbVersion}\n` +
    `Table count: ${tableCount}\n\n` +
    `<b>Global Record Counts:</b>\n` +
    `Group Users: ${groupUserCount}\n` +
    `Group Growth records: ${groupGrowthCount}\n` +
    `Group Fight records: ${groupFightCount}\n\n` +
    `<b>This Group Record Counts:</b>\n` +
    `Group Users: ${thisGroupUserCount}\n` +
    `Group Growth records: ${thisGroupGrowthCount}\n` +
    `Group Fight records: ${thisGroupFightCount}\n\n` +
    `<b>Average Records Per User (This Group):</b>\n` +
    `Growths: ${
      thisGroupUserCount
        ? (thisGroupGrowthCount / thisGroupUserCount).toFixed(1)
        : 0
    }\n` +
    `Fights: ${
      thisGroupUserCount
        ? (thisGroupFightCount / thisGroupUserCount).toFixed(1)
        : 0
    }`;

  await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
}

/**
 * Get detailed info about a specific user in the current group
 */
async function getUserInfo(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  userIdentifier: string
): Promise<void> {
  const groupId = msg.chat.id;
  const groupUserRepository = AppDataSource.getRepository(GroupUser);
  const groupGrowthRepository = AppDataSource.getRepository(GroupGrowth);
  const groupFightRepository = AppDataSource.getRepository(GroupFight);

  // Clean up user identifier
  userIdentifier = userIdentifier.replace("@", "");

  // Find group user by ID or username
  let groupUser: GroupUser | null = null;

  if (!isNaN(parseInt(userIdentifier))) {
    groupUser = await groupUserRepository.findOne({
      where: {
        userId: parseInt(userIdentifier),
        groupId: groupId,
      },
    });
  }

  if (!groupUser) {
    groupUser = await groupUserRepository.findOne({
      where: {
        username: userIdentifier,
        groupId: groupId,
      },
    });
  }

  if (!groupUser) {
    await bot.sendMessage(
      msg.chat.id,
      `User not found in this group: ${userIdentifier}`,
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  // Get growth stats
  const growthCount = await groupGrowthRepository.count({
    where: { groupUser: { id: groupUser.id } },
  });

  // Get fight stats
  const initiatedFights = await groupFightRepository.count({
    where: {
      initiator: { id: groupUser.id },
      groupId: groupId,
    },
  });

  const targetedFights = await groupFightRepository.count({
    where: {
      target: { id: groupUser.id },
      groupId: groupId,
    },
  });

  // Get last activity
  const lastGrowth = await groupGrowthRepository.findOne({
    where: { groupUser: { id: groupUser.id } },
    order: { timestamp: "DESC" },
  });

  const lastFight = await groupFightRepository.findOne({
    where: [
      { initiator: { id: groupUser.id }, groupId: groupId },
      { target: { id: groupUser.id }, groupId: groupId },
    ],
    order: { timestamp: "DESC" },
  });

  // Build activity info
  let lastActivity = "Unknown";

  if (lastGrowth && lastFight) {
    lastActivity = new Date(
      Math.max(lastGrowth.timestamp.getTime(), lastFight.timestamp.getTime())
    ).toISOString();
  } else if (lastGrowth) {
    lastActivity = lastGrowth.timestamp.toISOString();
  } else if (lastFight) {
    lastActivity = lastFight.timestamp.toISOString();
  }

  // Calculate days since activity
  const daysSinceActivity =
    lastActivity !== "Unknown"
      ? Math.floor(
          (Date.now() - new Date(lastActivity).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : "Unknown";

  // Build message
  const message =
    `👤 <b>USER INFORMATION (IN THIS GROUP)</b>\n\n` +
    `<b>User ID:</b> ${groupUser.userId}\n` +
    `<b>Username:</b> ${groupUser.username || "Not set"}\n` +
    `<b>Name:</b> ${groupUser.firstName} ${groupUser.lastName || ""}\n` +
    `<b>Created at:</b> ${groupUser.createdAt.toISOString()}\n\n` +
    `<b>Size Information:</b>\n` +
    `Current size: ${groupUser.size.toFixed(1)}cm\n` +
    `Total growths: ${groupUser.totalGrowths}\n` +
    `Positive growths: ${groupUser.positiveGrowths} (${
      groupUser.totalGrowths
        ? ((groupUser.positiveGrowths / groupUser.totalGrowths) * 100).toFixed(
            1
          )
        : 0
    }%)\n` +
    `Negative growths: ${groupUser.negativeGrowths} (${
      groupUser.totalGrowths
        ? ((groupUser.negativeGrowths / groupUser.totalGrowths) * 100).toFixed(
            1
          )
        : 0
    }%)\n\n` +
    `<b>Fight Information:</b>\n` +
    `Wins: ${groupUser.wins}\n` +
    `Losses: ${groupUser.losses}\n` +
    `Win rate: ${
      groupUser.wins + groupUser.losses > 0
        ? (
            (groupUser.wins / (groupUser.wins + groupUser.losses)) *
            100
          ).toFixed(1)
        : 0
    }%\n` +
    `Initiated fights: ${initiatedFights}\n` +
    `Targeted in fights: ${targetedFights}\n\n` +
    `<b>Activity Information:</b>\n` +
    `Last grow attempt: ${
      groupUser.lastGrowTime ? groupUser.lastGrowTime.toISOString() : "Never"
    }\n` +
    `Last activity: ${lastActivity}\n` +
    `Days since activity: ${daysSinceActivity}`;

  await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
}

/**
 * Get list of inactive users in the current group
 */
async function getInactiveUsers(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  days: number
): Promise<void> {
  const groupId = msg.chat.id;
  const groupUserRepository = AppDataSource.getRepository(GroupUser);

  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Find users who haven't grown in X days in this group
  const inactiveUsers = await groupUserRepository
    .createQueryBuilder("groupUser")
    .where("groupUser.groupId = :groupId", { groupId })
    .andWhere(
      "groupUser.lastGrowTime IS NULL OR groupUser.lastGrowTime < :cutoffDate",
      { cutoffDate }
    )
    .orderBy("groupUser.lastGrowTime", "ASC")
    .getMany();

  if (inactiveUsers.length === 0) {
    await bot.sendMessage(
      msg.chat.id,
      `No users found who have been inactive for ${days} days or more.`,
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  // Build message
  let message = `<b>INACTIVE USERS IN THIS GROUP (${days}+ days)</b>\n\n`;
  message += `Found ${inactiveUsers.length} inactive users:\n\n`;

  inactiveUsers.forEach((user, index) => {
    if (index < 20) {
      // Limit to 20 users to avoid message too long
      const lastGrowth = user.lastGrowTime
        ? `${Math.floor(
            (Date.now() - user.lastGrowTime.getTime()) / (1000 * 60 * 60 * 24)
          )} days ago`
        : "Never";

      message += `${index + 1}. ${user.firstName} (ID: ${
        user.userId
      }) - Last growth: ${lastGrowth}\n`;
    }
  });

  if (inactiveUsers.length > 20) {
    message += `\n...and ${inactiveUsers.length - 20} more inactive users.`;
  }

  await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
}

/**
 * Get top growers (users with most growth attempts) in the current group
 */
async function getTopGrowers(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  count: number
): Promise<void> {
  const groupId = msg.chat.id;
  const groupUserRepository = AppDataSource.getRepository(GroupUser);

  // Find users with most growths in this group
  const topGrowers = await groupUserRepository.find({
    where: { groupId },
    order: { totalGrowths: "DESC" },
    take: count,
  });

  if (topGrowers.length === 0) {
    await bot.sendMessage(msg.chat.id, `No users found with growth attempts.`, {
      reply_to_message_id: msg.message_id,
    });
    return;
  }

  // Build message
  let message = `<b>TOP ${count} GROWERS IN THIS GROUP</b>\n\n`;

  topGrowers.forEach((user, index) => {
    // Show actual size without minimum constraint
    const actualSize = user.size;
    const displaySize =
      actualSize < 1
        ? `${formatNumber(Math.max(1, actualSize))}cm (actual: ${formatNumber(
            actualSize
          )}cm)`
        : `${formatNumber(actualSize)}cm`;

    message += `${index + 1}. ${user.firstName} - ${
      user.totalGrowths
    } growths (${displaySize})\n`;
  });

  await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
}

/**
 * Get top fighters (users with most fights) in the current group
 */
async function getTopFighters(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  count: number
): Promise<void> {
  const groupId = msg.chat.id;
  const groupUserRepository = AppDataSource.getRepository(GroupUser);

  // Find users with most fights in this group
  const topFighters = await groupUserRepository
    .createQueryBuilder("groupUser")
    .select("groupUser.userId, groupUser.firstName, groupUser.username")
    .addSelect("(groupUser.wins + groupUser.losses)", "totalFights")
    .addSelect("groupUser.wins", "wins")
    .addSelect("groupUser.losses", "losses")
    .where("groupUser.groupId = :groupId", { groupId })
    .orderBy("totalFights", "DESC")
    .limit(count)
    .getRawMany();

  if (topFighters.length === 0) {
    await bot.sendMessage(msg.chat.id, `No users found with fights.`, {
      reply_to_message_id: msg.message_id,
    });
    return;
  }

  // Build message
  let message = `<b>TOP ${count} FIGHTERS IN THIS GROUP</b>\n\n`;

  topFighters.forEach((fighter, index) => {
    const totalFights = parseInt(fighter.totalFights);
    const winRate =
      totalFights > 0 ? ((fighter.wins / totalFights) * 100).toFixed(1) : "0.0";

    message += `${index + 1}. ${fighter.firstName} - ${totalFights} fights (${
      fighter.wins
    }W/${fighter.losses}L, ${winRate}% WR)\n`;
  });

  await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
}

/**
 * Get list of active wagers in the current group
 */
async function getActiveWagers(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  const groupId = msg.chat.id;
  const groupFightRepo = AppDataSource.getRepository(GroupFight);

  // Find all pending fights in this group
  const activeWagers = await groupFightRepo.find({
    where: { groupId, status: "pending" },
    relations: ["initiator", "target"],
    order: { timestamp: "DESC" },
  });

  if (activeWagers.length === 0) {
    await bot.sendMessage(msg.chat.id, "No active wagers in this group.", {
      reply_to_message_id: msg.message_id,
    });
    return;
  }

  // Build message
  let message = `<b>ACTIVE WAGERS IN THIS GROUP</b>\n\n`;
  message += `Found ${activeWagers.length} active wagers:\n\n`;

  activeWagers.forEach((fight, index) => {
    const timeAgo = Math.floor(
      (Date.now() - fight.timestamp.getTime()) / (1000 * 60)
    );
    const initiatorName = fight.initiator.firstName.replace(/[<>]/g, "");
    const targetName = fight.target
      ? fight.target.firstName.replace(/[<>]/g, "")
      : "Open challenge";

    // Create a clickable message link using the stored messageId
    const messageLink = fight.messageId
      ? `https://t.me/c/${Math.abs(groupId).toString().slice(3)}/${
          fight.messageId
        }`
      : null;

    message +=
      `${index + 1}. <code>Fight #${fight.id}</code>${
        messageLink ? ` (<a href="${messageLink}">Go to fight</a>)` : ""
      }\n` +
      `   • Initiator: ${initiatorName}\n` +
      `   • Target: ${targetName}\n` +
      `   • Wager: ${formatNumber(fight.wager)}cm\n` +
      `   • Started: ${timeAgo} minutes ago\n\n`;
  });

  message +=
    "\nUse <code>/admin_reset wager &lt;fight_id&gt;</code> to delete a specific wager.";

  await bot.sendMessage(msg.chat.id, message, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}
