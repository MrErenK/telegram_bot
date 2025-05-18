import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config();

// Configuration types
interface BotConfig {
  token: string;
  adminIds: number[];
  cooldownHours: number;
  cooldownMinutes: number;
  dbPath: string;
  dbType: "sqlite" | "mysql" | "postgres";
  environment: "development" | "production" | "test";
  logLevel: "error" | "warn" | "info" | "debug";
  pageSize: number;
  minFightSize: number;
  growShrinkRatio: number;
}

// Default configuration
const defaultConfig: BotConfig = {
  token: process.env.BOT_TOKEN || "",
  adminIds: (process.env.ADMIN_IDS || "")
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter((id) => !isNaN(id)),
  cooldownHours: parseInt(process.env.COOLDOWN_HOURS || "12"),
  cooldownMinutes: parseInt(process.env.COOLDOWN_MINUTES || "0"),
  dbPath: process.env.DB_PATH || "dick_grower.db",
  dbType: (process.env.DB_TYPE || "sqlite") as "sqlite" | "mysql" | "postgres",
  environment: (process.env.NODE_ENV || "development") as
    | "development"
    | "production"
    | "test",
  logLevel: (process.env.LOG_LEVEL || "info") as
    | "error"
    | "warn"
    | "info"
    | "debug",
  pageSize: parseInt(process.env.PAGE_SIZE || "10"),
  minFightSize: parseFloat(process.env.MIN_FIGHT_SIZE || "1"), // Set default to 1
  growShrinkRatio: parseFloat(process.env.GROW_SHRINK_RATIO || "0.6"),
};

// Runtime configuration (can be modified during execution)
let runtimeConfig: BotConfig = {
  ...defaultConfig,
};

/**
 * Get the current configuration
 */
export function getConfig(): Readonly<BotConfig> {
  return { ...runtimeConfig };
}

/**
 * Update specific configuration values
 */
export function updateConfig(newConfig: Partial<BotConfig>): BotConfig {
  runtimeConfig = {
    ...runtimeConfig,
    ...newConfig,
  };
  return { ...runtimeConfig };
}

/**
 * Reset configuration to default values
 */
export function resetConfig(): BotConfig {
  runtimeConfig = {
    ...defaultConfig,
  };
  return { ...runtimeConfig };
}

/**
 * Save the current configuration to a JSON file
 */
export function saveConfigToFile(filePath: string): void {
  const dirPath = path.dirname(filePath);

  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Write configuration to file
  fs.writeFileSync(filePath, JSON.stringify(runtimeConfig, null, 2), "utf8");
}

/**
 * Load configuration from a JSON file
 */
export function loadConfigFromFile(filePath: string): BotConfig {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Configuration file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const fileConfig = JSON.parse(fileContent);

  // Apply loaded configuration
  runtimeConfig = {
    ...runtimeConfig,
    ...fileConfig,
  };

  return { ...runtimeConfig };
}

/**
 * Get formatted cooldown time
 */
export function getCooldownTime(): number {
  const hours = runtimeConfig.cooldownHours;
  const minutes = runtimeConfig.cooldownMinutes;
  return (hours * 60 + minutes) * 60 * 1000; // Convert to milliseconds
}

/**
 * Format cooldown time for display
 */
export function formatCooldownTime(timeInMs: number): string {
  const totalSeconds = Math.ceil(timeInMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

/**
 * Calculate time until next growth is available
 */
export function getTimeUntilNextGrowth(lastGrowTime: Date | null): number {
  if (!lastGrowTime) {
    return 0;
  }

  try {
    const cooldownMs = getCooldownTime();
    const nextGrowthTime = new Date(lastGrowTime.getTime() + cooldownMs);
    const currentTime = new Date();

    const timeRemaining = nextGrowthTime.getTime() - currentTime.getTime();
    return Math.max(0, timeRemaining);
  } catch (error) {
    // In case of any error, allow growth
    console.error("Error calculating cooldown time:", error);
    return 0;
  }
}

// Export configuration values
export const BOT_TOKEN = runtimeConfig.token;
export const ADMIN_IDS = runtimeConfig.adminIds;
export const DB_PATH = runtimeConfig.dbPath;
export const DB_TYPE = runtimeConfig.dbType;
export const PAGE_SIZE = runtimeConfig.pageSize;
export const MIN_FIGHT_SIZE = runtimeConfig.minFightSize;
export const GROW_SHRINK_RATIO = runtimeConfig.growShrinkRatio;
export const IS_DEVELOPMENT = runtimeConfig.environment === "development";
