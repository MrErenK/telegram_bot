/**
 * Utility functions for formatting values in the application
 */

/**
 * Formats a number to display without decimal places if it's a whole number
 * @param value Number to format
 * @returns Formatted string representation of the number
 */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

/**
 * Formats a size value in cm to display without decimal if it's a whole number
 * @param value Size value to format
 * @returns Formatted string representation with cm suffix
 */
export function formatSize(value: number): string {
  return `${formatNumber(value)}cm`;
}

/**
 * Format a date as a relative time string (e.g., "2 hours ago")
 * @param date Date to format
 * @returns Formatted relative time string
 */
export function formatTimeAgo(date: Date): string {
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
 * Formats a time duration in milliseconds into a human-readable string.
 *
 * @param ms - The time in milliseconds to format
 * @returns A formatted string with hours (h), minutes (m), and seconds (s)
 *
 * @example
 * // returns "1h 30m 45s"
 * formatTimeLeft(5445000);
 *
 * @example
 * // returns "45s"
 * formatTimeLeft(45000);
 */
export function formatTimeLeft(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}
