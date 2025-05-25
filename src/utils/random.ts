import { getConfig } from "./config/manager";

/**
 * Generates a random float between min and max
 */
export function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generates a random integer between min (inclusive) and max (inclusive)
 */
export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random growth value for the dick
 * Has a chance to return negative value based on GROW_SHRINK_RATIO
 * Always returns a whole number (-15 to 15 cm)
 *
 * @param totalGrowths Optional number of previous growths for the user
 */
export function getGrowthAmount(totalGrowths?: number): number {
  const config = getConfig();
  // For first-time users (totalGrowths < 3), always grow or reduce shrink chance
  const shrinkRatio =
    totalGrowths === undefined || totalGrowths < 3
      ? Math.min(0.2, config.growShrinkRatio / 3) // Much lower shrink chance for new users
      : config.growShrinkRatio;

  // Determine if growth is positive or negative
  const isPositive = Math.random() > shrinkRatio;

  // Generate base growth amount between 1 and 15 cm (whole numbers only)
  const amount = getRandomInt(1, 15);

  // Apply sign based on whether it's positive or negative
  return isPositive ? amount : -amount;
}

/**
 * Returns a random growth value for the dick of the day
 * Always returns a positive whole number (1-15 cm)
 */
export function getDickOfTheDayAmount(): number {
  // Generate random growth amount between 1 and 15 cm (whole numbers only)
  return getRandomInt(1, 15);
}

/**
 * Returns an emoji based on growth amount
 */
export function getGrowthEmoji(amount: number): string {
  if (amount <= -3) return "😱"; // Extremely negative
  if (amount < 0) return "😓"; // Negative
  if (amount === 0) return "😐"; // No change
  if (amount < 2) return "😊"; // Small positive
  if (amount < 4) return "😄"; // Medium positive
  return "🤩"; // Large positive
}

/**
 * Returns a random user ID from an array of user IDs, excluding the given ID
 */
export function getRandomUserId(
  userIds: number[],
  excludeId: number
): number | undefined {
  const eligibleIds = userIds.filter((id) => id !== excludeId);
  if (eligibleIds.length === 0) return undefined;

  return eligibleIds[getRandomInt(0, eligibleIds.length - 1)];
}