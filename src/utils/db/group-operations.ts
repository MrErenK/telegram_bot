import logger from "../logger";
import { GroupUser, GroupGrowth, GroupFight, User } from "../../entity";
import { getTimeUntilNextGrowth } from "../config/manager";
import { getDatabase } from ".";

/**
 * Gets or creates a user for a specific group
 * Handles both new user creation and updating existing user information
 *
 * @param userData User details from Telegram
 * @param groupId The group ID where the user is located
 * @returns The group user object (existing or newly created)
 */
export async function getOrCreateGroupUser(
  userData: {
    id: number;
    first_name: string;
    last_name?: string | undefined;
    username?: string | undefined;
  },
  groupId: number
): Promise<GroupUser> {
  // Validate input parameters
  if (!userData || !userData.id || !userData.first_name) {
    logger.error(
      `Invalid user data provided to getOrCreateGroupUser: ${JSON.stringify(
        userData
      )}`
    );
    throw new Error("Invalid user data: User ID and first name are required");
  }

  if (!groupId) {
    logger.error(
      `Invalid group ID provided to getOrCreateGroupUser: ${groupId}`
    );
    throw new Error("Invalid group ID: Group ID is required");
  }

  const db = getDatabase();

  // Make sure database is initialized
  if (!db.isInitialized) {
    logger.error("Database is not initialized in getOrCreateGroupUser");
    throw new Error("Database connection not initialized");
  }

  const groupUserRepo = db.getRepository(GroupUser);
  const userRepo = db.getRepository(User);

  return await db.transaction(async (transactionManager) => {
    try {
      // Try to find existing group user
      let groupUser = await transactionManager
        .getRepository(GroupUser)
        .findOneBy({
          userId: userData.id,
          groupId,
        });

      // Check if User entity exists, create if not
      let user = await transactionManager.getRepository(User).findOneBy({
        id: userData.id,
      });

      if (!user) {
        logger.info(
          `Creating new user: ${userData.first_name} (${userData.id})`
        );
        user = transactionManager.getRepository(User).create({
          id: userData.id,
          username: userData.username || null,
          firstName: userData.first_name,
          lastName: userData.last_name || null,
          createdAt: new Date(),
          lastActiveAt: new Date(),
        });
        await transactionManager.getRepository(User).save(user);
      }

      // If group user doesn't exist, create a new one
      if (!groupUser) {
        logger.info(
          `Creating new group user: ${userData.first_name} (${userData.id}) in group ${groupId}`
        );

        groupUser = transactionManager.getRepository(GroupUser).create({
          userId: userData.id,
          groupId,
          firstName: userData.first_name,
          lastName: userData.last_name || null,
          username: userData.username || null,
          size: 0,
          totalGrowths: 0,
          positiveGrowths: 0,
          negativeGrowths: 0,
          wins: 0,
          losses: 0,
          createdAt: new Date(),
          lastGrowTime: null,
        });

        await transactionManager.getRepository(GroupUser).save(groupUser);
        logger.info(
          `Successfully created user: ${userData.id} in group ${groupId}`
        );
      } else {
        // Update user information if it has changed
        let isChanged = false;

        if (groupUser.firstName !== userData.first_name) {
          groupUser.firstName = userData.first_name;
          isChanged = true;
        }

        if (groupUser.lastName !== (userData.last_name || null)) {
          groupUser.lastName = userData.last_name || null;
          isChanged = true;
        }

        if (groupUser.username !== (userData.username || null)) {
          groupUser.username = userData.username || null;
          isChanged = true;
        }

        if (isChanged) {
          await transactionManager.getRepository(GroupUser).save(groupUser);
          logger.debug(
            `Updated user information for: ${userData.id} in group ${groupId}`
          );
        }
      }

      return groupUser;
    } catch (error) {
      logger.error(
        `Error in getOrCreateGroupUser for user ${userData.id} in group ${groupId}:`,
        error as Error
      );
      throw error; // Rethrow to handle at the calling level
    }
  });
}

/**
 * Updates a group user's information
 */
export async function updateGroupUser(
  groupUser: GroupUser
): Promise<GroupUser> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);
  return await groupUserRepo.save(groupUser);
}

/**
 * Creates a new growth record for a group user
 */
export async function createGroupGrowth(data: {
  groupUser: GroupUser;
  amount: number;
  timestamp: Date;
  isSpecial?: boolean;
  specialReason?: string;
}): Promise<GroupGrowth> {
  const db = getDatabase();
  const growthRepo = db.getRepository(GroupGrowth);

  const growth = growthRepo.create({
    groupUser: data.groupUser,
    amount: data.amount,
    timestamp: data.timestamp,
    isSpecial: data.isSpecial || false,
    specialReason: data.specialReason || null,
  });

  return await growthRepo.save(growth);
}

/**
 * Creates a new group fight
 */
export async function createGroupFight(
  initiator: GroupUser,
  targetId: number | null,
  groupId: number,
  wager: number = 1.0
): Promise<GroupFight> {
  return await getDatabase().transaction(async (manager) => {
    const fightRepo = manager.getRepository(GroupFight);
    const groupUserRepo = manager.getRepository(GroupUser);

    // Find target user if provided
    let target: GroupUser | null = null;
    if (targetId) {
      target = await groupUserRepo.findOneBy({
        userId: targetId,
        groupId: groupId,
      });
    }

    // Create the fight
    const fight = fightRepo.create({
      initiator,
      target,
      groupId,
      wager,
      timestamp: new Date(),
    });

    return await fightRepo.save(fight);
  });
}

/**
 * Finds top users by size for a specific group
 */
export async function findTopGroupUsers(
  groupId: number,
  limit: number = 10,
  offset: number = 0
): Promise<GroupUser[]> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);

  return await groupUserRepo.find({
    where: {
      groupId,
    },
    order: {
      size: "DESC",
    },
    take: limit,
    skip: offset,
  });
}

/**
 * Counts the number of users in a specific group
 */
export async function countGroupUsers(groupId: number): Promise<number> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);

  return await groupUserRepo.count({
    where: {
      groupId,
    },
  });
}

/**
 * Gets a group user's growth history
 */
export async function getGroupUserGrowthHistory(
  userId: number,
  groupId: number,
  limit: number = 5
): Promise<GroupGrowth[]> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);
  const growthRepo = db.getRepository(GroupGrowth);

  try {
    // Find the group user
    const groupUser = await groupUserRepo.findOneBy({
      userId,
      groupId,
    });

    if (!groupUser) {
      return [];
    }

    // Get growth history for this user in this group
    return await growthRepo.find({
      where: {
        groupUser: {
          id: groupUser.id,
        },
      },
      order: {
        timestamp: "DESC",
      },
      take: limit,
    });
  } catch (error) {
    logger.error(
      `Error getting growth history for user ${userId} in group ${groupId}:`,
      error as Error
    );
    return [];
  }
}

/**
 * Helper function to find a group user by either username or ID
 * Used by admin commands to locate users
 *
 * @param identifier A username (without @) or user ID
 * @param groupId The Telegram group ID
 * @returns GroupUser or null if not found
 */
export async function findGroupUserByIdentifier(
  identifier: string,
  groupId: number
): Promise<GroupUser | null> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);

  // Remove @ symbol if present
  identifier = identifier.replace("@", "");

  // Try to find by ID first
  if (!isNaN(parseInt(identifier))) {
    const user = await groupUserRepo.findOneBy({
      userId: parseInt(identifier),
      groupId: groupId,
    });
    if (user) return user;
  }

  // Try to find by username
  return await groupUserRepo.findOneBy({
    username: identifier,
    groupId: groupId,
  });
}

/**
 * Gets all active fights for a user in a group
 */
export async function getActiveUserFights(
  userId: number,
  groupId: number
): Promise<GroupFight[]> {
  const fightRepo = getDatabase().getRepository(GroupFight);
  
  // Get all fights where user is initiator or target and fight is not completed
  return await fightRepo.find({
    where: [
      {
        initiator: { id: userId },
        groupId: groupId,
        status: "pending"
      },
      {
        target: { id: userId },
        groupId: groupId,
        status: "pending"
      }
    ],
    relations: ["initiator", "target"]
  });
}

/**
 * Completes a group fight
 */
export async function completeGroupFight(
  fightId: number,
  initiatorRoll: number,
  targetRoll: number
): Promise<{
  fight: GroupFight;
  oldWinnerRank?: number;
  newWinnerRank?: number;
  oldLoserRank?: number;
  newLoserRank?: number;
}> {
  return await getDatabase().transaction(async (manager) => {
    const fightRepo = manager.getRepository(GroupFight);
    const groupUserRepo = manager.getRepository(GroupUser);

    // Get the fight with related users
    const fight = await fightRepo.findOne({
      where: { id: fightId },
      relations: { initiator: true, target: true },
    });

    if (!fight) {
      throw new Error(`Fight with ID ${fightId} not found`);
    }

    // Set the roll values
    fight.initiatorRoll = initiatorRoll;
    fight.targetRoll = targetRoll;

    // Determine the winner
    let winner: GroupUser | null = null;
    let loser: GroupUser | null = null;

    if (initiatorRoll > targetRoll) {
      winner = fight.initiator;
      loser = fight.target;
    } else if (targetRoll > initiatorRoll) {
      winner = fight.target;
      loser = fight.initiator;
    } else {
      // It's a tie, no size changes
      fight.status = "completed";
      fight.completedAt = new Date();
      await fightRepo.save(fight);
      return { fight };
    }

    // Set the winner and update fight status
    fight.winner = winner;
    fight.winnerId = winner?.id || null;
    fight.loserId = loser?.id || null;
    fight.status = "completed";
    fight.completedAt = new Date();

    // Get ranks before changes
    let oldWinnerRank: number | undefined;
    let oldLoserRank: number | undefined;
    let newWinnerRank: number | undefined;
    let newLoserRank: number | undefined;

    // Only update sizes if both winner and loser are defined
    if (winner && loser) {
      // Get ranks before changes
      oldWinnerRank =
        (await getUserRank(winner.userId, fight.groupId)) || undefined;
      oldLoserRank =
        (await getUserRank(loser.userId, fight.groupId)) || undefined;

      // Update winner's stats
      winner.size += fight.wager;
      winner.wins += 1;

      // Update loser's stats
      loser.size -= fight.wager; // Remove the wager amount
      if (loser.size < 0) loser.size = 0; // Ensure size doesn't go below 0
      loser.losses += 1;

      // Save all changes
      await groupUserRepo.save(winner);
      await groupUserRepo.save(loser);

      // Get ranks after changes
      newWinnerRank =
        (await getUserRank(winner.userId, fight.groupId)) || undefined;
      newLoserRank =
        (await getUserRank(loser.userId, fight.groupId)) || undefined;
    }
    await fightRepo.save(fight);

    return {
      fight,
      oldWinnerRank,
      newWinnerRank,
      oldLoserRank,
      newLoserRank,
    };
  });
}

/**
 * Checks if a user can grow their dick in a specific group
 */
export async function canUserGrow(
  userId: number,
  groupId: number
): Promise<{
  canGrow: boolean;
  timeUntilNextGrowth: number;
  groupUser: GroupUser | null;
}> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);

  // Find the group user for this specific group
  const groupUser = await groupUserRepo.findOneBy({
    userId,
    groupId,
  });

  if (!groupUser) {
    // If group user doesn't exist, they can grow
    return {
      canGrow: true,
      timeUntilNextGrowth: 0,
      groupUser: null,
    };
  }

  // Check cooldown - ensure lastGrowTime is defined
  const lastGrowTime = groupUser.lastGrowTime || new Date(0);
  const timeUntilNextGrowth = getTimeUntilNextGrowth(lastGrowTime);

  return {
    canGrow: timeUntilNextGrowth <= 0,
    timeUntilNextGrowth,
    groupUser,
  };
}

/**
 * Gets group statistics
 */
export async function getGroupStats(groupId: number): Promise<{
  totalUsers: number;
  totalGrowths: number;
  averageSize: number;
  biggestSize: number;
}> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);
  const growthRepo = db.getRepository(GroupGrowth);

  // Count total users in the group
  const totalUsers = await groupUserRepo.count({
    where: {
      groupId,
    },
  });

  // Get user with biggest size
  const topUser = await groupUserRepo.findOne({
    where: { groupId },
    order: { size: "DESC" },
  });

  // Calculate total growths in the group
  const totalGrowths = await growthRepo
    .createQueryBuilder("growth")
    .innerJoin("growth.groupUser", "groupUser")
    .where("groupUser.groupId = :groupId", { groupId })
    .getCount();

  // Calculate average size
  const result = await groupUserRepo
    .createQueryBuilder("groupUser")
    .select("AVG(groupUser.size)", "avgSize")
    .where("groupUser.groupId = :groupId", { groupId })
    .getRawOne();

  return {
    totalUsers,
    totalGrowths,
    averageSize: result?.avgSize ? parseFloat(result.avgSize) : 0,
    biggestSize: topUser?.size || 0,
  };
}

/**
 * Gets a user's rank in their group
 */
export async function getUserRank(
  userId: number,
  groupId: number
): Promise<number | null> {
  const db = getDatabase();
  try {
    const userRank = await db.query(
      `
      SELECT position
      FROM (
        SELECT u.userId, u.size, ROW_NUMBER() OVER (ORDER BY u.size DESC) as position
        FROM group_user u
        WHERE u.groupId = ?
      ) ranked
      WHERE userId = ?
      `,
      [groupId, userId]
    );

    if (userRank && userRank.length > 0) {
      return userRank[0].position;
    }

    return null;
  } catch (error) {
    logger.error(
      `Error getting user rank for user ${userId} in group ${groupId}:`,
      error as Error
    );
    return null;
  }
}

/**
 * Gets a random user from the group
 */
export async function getRandomGroupUser(
  groupId: number
): Promise<GroupUser | null> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);

  try {
    const users = await groupUserRepo.find({
      where: { groupId },
    });

    if (users.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * users.length);
    return users[randomIndex];
  } catch (error) {
    logger.error(
      `Error getting random group user for group ${groupId}:`,
      error as Error
    );
    return null;
  }
}

/**
 * Creates a new group user with specified attributes
 */
/**
 * Creates a new group user with specified attributes
 *
 * @param params User parameters including all required fields
 * @returns The newly created group user
 */
export async function createGroupUser({
  id,
  username,
  first_name,
  last_name,
  size,
  totalGrowths,
  positiveGrowths,
  negativeGrowths,
  lastGrowTime,
  groupId,
}: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  size: number;
  totalGrowths: number;
  positiveGrowths: number;
  negativeGrowths: number;
  lastGrowTime: Date;
  groupId?: number;
}): Promise<GroupUser> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);

  try {
    // Create a new user
    const newUser = groupUserRepo.create({
      userId: id,
      firstName: first_name,
      lastName: last_name || null,
      username: username || null,
      size,
      totalGrowths,
      positiveGrowths,
      negativeGrowths,
      lastGrowTime,
      groupId: groupId,
      createdAt: new Date(),
      wins: 0,
      losses: 0,
    });

    // Save the new user to the database
    await groupUserRepo.save(newUser);
    logger.info(
      `Created user ${id} with manual attributes in group ${groupId}`
    );

    return newUser;
  } catch (error) {
    logger.error(
      `Error creating user ${id} in group ${groupId}:`,
      error as Error
    );
    throw error;
  }
}

/**
 * This function is a utility to find a user by their Telegram ID in any group
 * Use findGroupUserById when you need a specific group user
 *
 * @deprecated Use findGroupUserById with a specific groupId instead
 */
/**
 * Finds a user by their Telegram ID in any group
 *
 * @param userId Telegram user ID
 * @returns The first group user found or null
 * @deprecated Use findGroupUserById with a specific groupId instead
 */
export async function findUserById(userId: number): Promise<GroupUser | null> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);

  try {
    // Find any instance of the user (not recommended, as users might be in multiple groups)
    return await groupUserRepo.findOneBy({
      userId,
    });
  } catch (error) {
    logger.error(`Error finding user ${userId} across groups:`, error as Error);
    return null;
  }
}

/**
 * Finds a user in a specific group by their Telegram user ID
 *
 * @param userId Telegram user ID
 * @param groupId Telegram group ID
 * @returns GroupUser or null if not found
 * Retrieves a user for a specific group by their Telegram user ID
 * Used by multiple commands to look up users
 *
 * @param userId Telegram user ID
 * @param groupId Telegram group ID
 * @returns The group user or null if not found
 */
export async function findGroupUserById(
  userId: number,
  groupId: number
): Promise<GroupUser | null> {
  const db = getDatabase();
  const groupUserRepo = db.getRepository(GroupUser);

  try {
    // Find the group user by user ID and group ID
    const groupUser = await groupUserRepo.findOneBy({
      userId,
      groupId,
    });

    return groupUser;
  } catch (error) {
    logger.error(
      `Error finding user ${userId} in group ${groupId}:`,
      error as Error
    );
    return null;
  }
}

/**
 * Checks if a group is eligible for a new Dick of the Day
 * There's a 24-hour cooldown between DOTD awards for the entire group
 *
 * @param groupId Telegram group ID
 * @returns Object containing whether the group can have a DOTD and time until next eligibility
 */
export async function canGroupReceiveDOTD(groupId: number): Promise<{
  canReceive: boolean;
  timeUntilNextEligible: number;
}> {
  const db = getDatabase();
  const growthRepo = db.getRepository(GroupGrowth);

  // Find the most recent DOTD growth for this group
  const lastDOTD = await growthRepo
    .createQueryBuilder("growth")
    .innerJoin("growth.groupUser", "groupUser")
    .where("groupUser.groupId = :groupId", { groupId })
    .andWhere("growth.isSpecial = :isSpecial", { isSpecial: true })
    .andWhere("growth.specialReason = :specialReason", {
      specialReason: "Dick of the Day",
    })
    .orderBy("growth.timestamp", "DESC")
    .getOne();

  if (!lastDOTD) {
    // If no previous DOTD for this group, they can receive it
    return {
      canReceive: true,
      timeUntilNextEligible: 0,
    };
  }

  // Calculate time since last DOTD
  const now = new Date();
  const timeSinceLastDOTD = now.getTime() - lastDOTD.timestamp.getTime();
  const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const timeUntilNextEligible = Math.max(0, cooldownPeriod - timeSinceLastDOTD);

  return {
    canReceive: timeUntilNextEligible <= 0,
    timeUntilNextEligible,
  };
}
