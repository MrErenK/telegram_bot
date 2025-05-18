import * as TelegramBot from 'node-telegram-bot-api';
import { ErrorType, handleError } from './error';

/**
 * Validator types
 */
export type Validator<T> = (value: unknown) => { valid: true, value: T } | { valid: false, error: string };

/**
 * Validates if a value is a number
 */
export const isNumber: Validator<number> = (value: unknown) => {
  if (typeof value === 'number' && !isNaN(value)) {
    return { valid: true, value };
  }
  
  if (typeof value === 'string') {
    const num = Number(value.trim());
    if (!isNaN(num)) {
      return { valid: true, value: num };
    }
  }
  
  return { valid: false, error: 'Value is not a valid number' };
};

/**
 * Validates if a number is within range
 */
export const isNumberInRange = (min: number, max: number): Validator<number> => {
  return (value: unknown) => {
    const result = isNumber(value);
    
    if (!result.valid) {
      return result;
    }
    
    if (result.value < min || result.value > max) {
      return { valid: false, error: `Value must be between ${min} and ${max}` };
    }
    
    return { valid: true, value: result.value };
  };
};

/**
 * Validates if a value is a string
 */
export const isString: Validator<string> = (value: unknown) => {
  if (typeof value === 'string') {
    return { valid: true, value };
  }
  
  return { valid: false, error: 'Value is not a valid string' };
};

/**
 * Validates if a string matches a pattern
 */
export const matchesPattern = (regex: RegExp, errorMsg?: string): Validator<string> => {
  return (value: unknown) => {
    const result = isString(value);
    
    if (!result.valid) {
      return result;
    }
    
    if (!regex.test(result.value)) {
      return { 
        valid: false, 
        error: errorMsg || `Value doesn't match the required pattern: ${regex}` 
      };
    }
    
    return { valid: true, value: result.value };
  };
};

/**
 * Validates command parameters from message text
 */
export function validateCommandParams<T>(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  params: string | null | undefined,
  validator: Validator<T>,
  errorMessage?: string
): T | null {
  if (!params) {
    handleError(bot, {
      type: ErrorType.USER_INPUT,
      message: errorMessage || 'Missing required parameter',
      userId: msg.from?.id,
      chatId: msg.chat.id,
      messageId: msg.message_id
    });
    return null;
  }
  
  const result = validator(params);
  
  if (!result.valid) {
    handleError(bot, {
      type: ErrorType.USER_INPUT,
      message: errorMessage || result.error,
      userId: msg.from?.id,
      chatId: msg.chat.id,
      messageId: msg.message_id
    });
    return null;
  }
  
  return result.value;
}

/**
 * Parse and validate command parameters from RegExp match
 */
export function parseCommandParams<T>(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  match: RegExpExecArray | null,
  validator: Validator<T>,
  matchIndex: number = 3,
  errorMessage?: string
): T | null {
  // Extract parameter from regex match
  const param = match?.[matchIndex]?.trim();
  return validateCommandParams(bot, msg, param, validator, errorMessage);
}