import * as TelegramBot from 'node-telegram-bot-api';
import { sendSafeHTML } from './formatting';

// Message templates interface
export interface MessageTemplates {
  [key: string]: string;
}

// Global message templates
const templates: MessageTemplates = {
  welcome: 'Welcome to DGW Bot, <b>${userName}</b>! 🍆\n\nUse /grow to grow your dick, /stats to see your stats, and /help for more info.',
  help: '<b>DGW Bot Commands</b>\n\n' +
        '/grow - Grow your dick (once per cooldown period)\n' +
        '/stats - View your stats\n' +
        '/top - See the leaderboard\n' +
        '/pvp [amount] - Challenge someone to a pvp battle',
  error: 'Sorry, an error occurred: ${message}',
  cooldown: '<b>${userName}</b>, you need to wait ${time} before trying again!',
  statsHeader: '<b>${userName}</b>\'s Stats 📊',
  statsSize: 'Current size: <b>${size}cm</b>',
  statsGrowth: 'Total growths: <b>${total}</b> (${positive} ↑, ${negative} ↓)',
  pvpChallenge: '<b>${challenger}</b> has challenged <b>${target}</b> to a dick fight! 🍆⚔️\nWager: ${amount}cm'
};

/**
 * Set custom message templates
 */
export function setMessageTemplates(newTemplates: MessageTemplates): void {
  Object.assign(templates, newTemplates);
}

/**
 * Get a template by key
 */
export function getTemplate(key: string): string {
  return templates[key] || `Template '${key}' not found`;
}

/**
 * Replace variables in a template string
 */
export function formatTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\${(\w+)}/g, (match, varName) => {
    return variables[varName] !== undefined ? String(variables[varName]) : match;
  });
}

/**
 * Get a formatted message using a template and variables
 */
export function getMessage(templateKey: string, variables: Record<string, any> = {}): string {
  const template = getTemplate(templateKey);
  return formatTemplate(template, variables);
}

/**
 * Send a message using a template
 */
export async function sendTemplatedMessage(
  bot: TelegramBot,
  chatId: number | string,
  templateKey: string,
  variables: Record<string, any> = {},
  options: TelegramBot.SendMessageOptions = {}
): Promise<TelegramBot.Message> {
  const message = getMessage(templateKey, variables);
  return sendSafeHTML(bot, chatId, message, options);
}

/**
 * Build and send a multi-part message with different templates
 */
export async function sendMultiPartMessage(
  bot: TelegramBot,
  chatId: number | string,
  templateKeys: string[],
  variables: Record<string, any> = {},
  separator: string = '\n',
  options: TelegramBot.SendMessageOptions = {}
): Promise<TelegramBot.Message> {
  const messageParts = templateKeys.map(key => getMessage(key, variables));
  const fullMessage = messageParts.join(separator);
  return sendSafeHTML(bot, chatId, fullMessage, options);
}

/**
 * Create inline keyboard markup for pagination
 */
export function createPaginationKeyboard(
  currentPage: number,
  totalPages: number,
  callbackPrefix: string = 'page'
): TelegramBot.InlineKeyboardMarkup {
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  const buttons: TelegramBot.InlineKeyboardButton[] = [];
  
  // Previous button
  if (currentPage > 1) {
    buttons.push({
      text: '⬅️ Previous',
      callback_data: `${callbackPrefix}:${currentPage - 1}`
    });
  }
  
  // Page indicator (non-functional button)
  buttons.push({
    text: `${currentPage}/${totalPages}`,
    callback_data: `${callbackPrefix}_noop:${currentPage}`
  });
  
  // Next button
  if (currentPage < totalPages) {
    buttons.push({
      text: 'Next ➡️',
      callback_data: `${callbackPrefix}:${currentPage + 1}`
    });
  }
  
  keyboard.push(buttons);
  return { inline_keyboard: keyboard };
}

/**
 * Send paginated data with navigation buttons
 */
export async function sendPaginatedMessage(
  bot: TelegramBot,
  chatId: number | string,
  headerText: string,
  contentItems: string[],
  currentPage: number,
  itemsPerPage: number,
  callbackPrefix: string = 'page',
  options: TelegramBot.SendMessageOptions = {}
): Promise<TelegramBot.Message> {
  const totalItems = contentItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Ensure currentPage is within bounds
  currentPage = Math.max(1, Math.min(currentPage, totalPages));
  
  // Get items for current page
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, totalItems);
  const pageItems = contentItems.slice(startIdx, endIdx);
  
  // Build message
  const message = `${headerText}\n\n${pageItems.join('\n')}`;
  
  // Create keyboard for pagination
  const keyboardMarkup = createPaginationKeyboard(currentPage, totalPages, callbackPrefix);
  
  // Send message with keyboard
  return sendSafeHTML(bot, chatId, message, {
    ...options,
    reply_markup: keyboardMarkup
  });
}