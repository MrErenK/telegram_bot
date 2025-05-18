import * as TelegramBot from "node-telegram-bot-api";
import { AppDataSource } from "../../utils/db";
import { GroupUser, GroupGrowth, GroupFight } from "../../entity";

/**
 * Admin command to get detailed stats about the bot usage in the current group
 * Usage: /admin_stats
 */
export async function statsCommand(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  const groupId = msg.chat.id;

  const groupUserRepo = AppDataSource.getRepository(GroupUser);
  const groupGrowthRepo = AppDataSource.getRepository(GroupGrowth);
  const groupFightRepo = AppDataSource.getRepository(GroupFight);

  // Get database stats for this group
  const userCount = await groupUserRepo.count({ where: { groupId } });
  const growthCount = await groupGrowthRepo
    .createQueryBuilder("growth")
    .innerJoin("growth.groupUser", "groupUser")
    .where("groupUser.groupId = :groupId", { groupId })
    .getCount();
  const fightCount = await groupFightRepo.count({ where: { groupId } });

  // Get top 5 users in this group
  const topUsers = await groupUserRepo.find({
    where: { groupId },
    order: { size: "DESC" },
    take: 5,
  });

  // Get recent activity in this group
  const recentGrowths = await groupGrowthRepo
    .createQueryBuilder("growth")
    .innerJoinAndSelect("growth.groupUser", "groupUser")
    .where("groupUser.groupId = :groupId", { groupId })
    .orderBy("growth.timestamp", "DESC")
    .take(5)
    .getMany();

  const recentFights = await groupFightRepo.find({
    where: { groupId },
    order: { timestamp: "DESC" },
    take: 5,
    relations: ["initiator", "target", "winner"],
  });

  // Get user signup stats for this group
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const newUsersToday = await groupUserRepo
    .createQueryBuilder("groupUser")
    .where("groupUser.groupId = :groupId", { groupId })
    .andWhere("groupUser.createdAt >= :date", { date: oneDayAgo })
    .getCount();

  const newUsersThisWeek = await groupUserRepo
    .createQueryBuilder("groupUser")
    .where("groupUser.groupId = :groupId", { groupId })
    .andWhere("groupUser.createdAt >= :date", { date: oneWeekAgo })
    .getCount();

  // Calculate some stats
  const avgSize = topUsers.length
    ? topUsers.reduce((sum, user) => sum + user.size, 0) / topUsers.length
    : 0;
  const maxSize = topUsers.length
    ? Math.max(...topUsers.map((user) => user.size))
    : 0;

  // Build the stats message
  let message = `📊 <b>GROUP ADMIN STATISTICS</b> 📊\n\n`;

  // Overview section
  message += `<b>Overview:</b>\n`;
  message += `Total users in group: ${userCount}\n`;
  message += `Total growth attempts: ${growthCount}\n`;
  message += `Total fights: ${fightCount}\n`;
  message += `New users (24h): ${newUsersToday}\n`;
  message += `New users (7d): ${newUsersThisWeek}\n\n`;

  // Size statistics
  message += `<b>Size Stats:</b>\n`;
  message += `Avg size (top 5): ${formatNumber(avgSize)}cm\n`;
  message += `Max size: ${formatNumber(maxSize)}cm\n\n`;

  // Top users
  message += `<b>Top 5 Users:</b>\n`;
  topUsers.forEach((user, i) => {
    message += `${i + 1}. ${user.firstName}: ${formatNumber(user.size)}cm\n`;
  });
  message += "\n";

  // Recent activities
  message += `<b>Recent Growth Activity:</b>\n`;
  if (recentGrowths.length === 0) {
    message += `No growth activity yet.\n`;
  } else {
    recentGrowths.forEach((growth) => {
      const timeAgo = formatTimeAgo(growth.timestamp);
      const sign = growth.amount > 0 ? "+" : "";
      message += `${growth.groupUser.firstName}: ${sign}${formatNumber(
        growth.amount
      )}cm (${timeAgo})\n`;
    });
  }
  message += "\n";

  message += `<b>Recent Fights:</b>\n`;
  if (recentFights.length === 0) {
    message += `No fights yet.\n`;
  } else {
    recentFights.forEach((fight) => {
      const winner = fight.winner ? fight.winner.firstName : "No winner";
      const timeAgo = formatTimeAgo(fight.timestamp);
      message += `${fight.initiator.firstName} vs ${
        fight.target?.firstName || "Unknown"
      } - Winner: ${winner} (${timeAgo})\n`;
    });
  }

  // Send the stats
  await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
}

/**
 * Format a date as a relative time string (e.g., "2 hours ago")
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return `${seconds}s ago`;
  }
}

/**
 * Format a number to remove decimal if it's a whole number
 */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}
