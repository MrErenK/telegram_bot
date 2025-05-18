import * as TelegramBot from 'node-telegram-bot-api';

/**
 * Escape HTML special characters to prevent rendering issues with Telegram's parse_mode: HTML
 * 
 * @param text The text to escape
 * @returns Escaped text safe for use with parse_mode: HTML
 */
export function escapeHTML(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Safely format a message with HTML tags for Telegram
 * 
 * Telegram supports a limited subset of HTML tags:
 * <b>, <i>, <u>, <s>, <a>, <code>, <pre>
 * 
 * @param message The message to format
 * @returns A message safe for use with parse_mode: HTML
 */
export function formatTelegramHTML(message: string): string {
  if (!message) return '';
  
  // List of allowed HTML tags in Telegram
  const allowedTags = ['b', 'i', 'u', 's', 'a', 'code', 'pre'];
  
  // Create regular expression to match all HTML tags
  const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s[^>]*)?>/g;
  
  // Replace unsupported tags with escaped versions
  return message.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match; // Keep supported tags
    } else {
      return escapeHTML(match); // Escape unsupported tags
    }
  });
}

/**
 * Send a message safely with HTML formatting to avoid Telegram API errors
 * 
 * @param bot The Telegram bot instance
 * @param chatId Chat ID to send the message to
 * @param message Message text which may contain HTML
 * @param options Additional options for sendMessage
 * @returns Promise from bot.sendMessage
 */
export function sendSafeHTML(
  bot: TelegramBot,
  chatId: number | string,
  message: string,
  options: TelegramBot.SendMessageOptions = {}
): Promise<TelegramBot.Message> {
  const safeMessage = formatTelegramHTML(message);
  
  return bot.sendMessage(
    chatId,
    safeMessage,
    {
      ...options,
      parse_mode: 'HTML'
    }
  );
}