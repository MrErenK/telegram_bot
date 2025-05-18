import * as winston from "winston";
import { getConfig } from "./config/manager";

// Create custom log format
const logFormat = winston.format.printf(
  ({ level, message, timestamp, ...meta }) => {
    let logMessage = `[${level.toUpperCase()}] ${message}`;

    // Add contextual information if available
    if (Object.keys(meta).length > 0 && level === "error") {
      logMessage += ` ${JSON.stringify(meta)}`;
    }

    return logMessage;
  }
);

// Create the logger
const logger = winston.createLogger({
  level: getConfig().logLevel,
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
  ],
});

// Add file transport in production
if (getConfig().environment === "production") {
  logger.add(
    new winston.transports.File({
      filename: "bot-error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: "bot-combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

/**
 * Log debug message - only in development mode
 */
export function debug(message: string, meta: Record<string, any> = {}): void {
  if (getConfig().environment === "development") {
    logger.debug(message, meta);
  }
}

/**
 * Log info message - critical info only
 */
export function info(message: string, meta: Record<string, any> = {}): void {
  logger.info(message, meta);
}

/**
 * Log warning message
 */
export function warn(message: string, meta: Record<string, any> = {}): void {
  logger.warn(message, meta);
}

/**
 * Log error message
 */
export function error(
  message: string,
  error?: Error,
  meta: Record<string, any> = {}
): void {
  if (error) {
    logger.error(message, {
      error: { message: error.message, stack: error.stack },
      ...meta,
    });
  } else {
    logger.error(message, meta);
  }
}

/**
 * Log user action - only in development mode
 */
export function logUserAction(
  action: string,
  userId: number,
  username: string,
  chatId: number | string,
  meta: Record<string, any> = {}
): void {
  // Disable most user action logging
  if (getConfig().environment === "development") {
    logger.debug(
      `User action: ${action} by ${username} (${userId}) in chat ${chatId}`,
      meta
    );
  }
}

/**
 * Log bot action - only critical actions
 */
export function logBotAction(
  action: string,
  chatId: number | string,
  meta: Record<string, any> = {}
): void {
  // Only log critical bot actions
  if (
    action.includes("error") ||
    action.includes("start") ||
    action.includes("shutdown")
  ) {
    logger.info(`Bot action: ${action} in chat ${chatId}`, meta);
  }
}

/**
 * Log system event - only critical events
 */
export function logSystemEvent(
  event: string,
  meta: Record<string, any> = {}
): void {
  // Only log critical system events
  if (
    event.includes("error") ||
    event.includes("start") ||
    event.includes("shutdown") ||
    event.includes("admin")
  ) {
    logger.info(`System event: ${event}`, meta);
  }
}

export default {
  debug,
  info,
  warn,
  error,
  logUserAction,
  logBotAction,
  logSystemEvent,
};
