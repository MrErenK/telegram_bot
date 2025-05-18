# DGW Bot

A Telegram bot with enhanced utilities for better code maintainability.

## Features

- User growth system with daily cooldown
- PvP battles between users
- Leaderboard with pagination
- Comprehensive statistics
- Admin commands for management

## Project Structure

The project follows a modular architecture with utility functions for better maintainability:

```
dgwbot/
├── src/
    ├── commands/      # Command handlers
    ├── entity/        # Database entities
    ├── utils/         # Utility functions
    └── index.ts       # Main entry point
```

## Utilities

### Error Handling

The error handling utility provides standardized error reporting:

```typescript
import { ErrorType, handleError } from './utils/error';

// Example usage
await handleError(
  bot,
  {
    type: ErrorType.COOLDOWN,
    message: 'You need to wait before trying again',
    userId: 12345,
    chatId: msg.chat.id
  }
);
```

### Command Handling

The command handler utility simplifies command registration:

```typescript
import { registerCommands, Command } from './utils/commands/handler';

const commands: Command[] = [
  {
    name: 'start',
    description: 'Start the bot',
    regex: /^\/start(@\w+)?$/,
    handler: handleStart
  }
];

registerCommands(bot, commands);
```

### Message Formatting

The message utility provides templated messages:

```typescript
import { sendTemplatedMessage } from './utils/message';

await sendTemplatedMessage(
  bot,
  chatId,
  'welcome',
  { userName: 'John' }
);
```

### Transactions

Database transactions ensure data integrity:

```typescript
import { withTransaction } from './utils/db/transactions';

await withTransaction(async (manager) => {
  // Database operations
  await manager.save(user);
  await manager.save(growth);
});
```

### Validation

Input validation ensures data quality:

```typescript
import { validateCommandParams, isNumber } from './utils/validation';

const wager = validateCommandParams(bot, msg, wagerStr, isNumber);
if (wager === null) return; // Validation failed
```

### Logging

Structured logging throughout the application:

```typescript
import logger from './utils/logger';

logger.info('User action', { userId, action: 'grow' });
```

## Environment Variables

Configure the bot using these environment variables:

- `BOT_TOKEN`: Telegram bot token
- `ADMIN_IDS`: Comma-separated list of admin user IDs
- `COOLDOWN_HOURS`: Hours for growth cooldown (default: 24)
- `DB_PATH`: Database file path (default: dick_grower.db)

## Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and configure variables
3. Install dependencies: `npm install`
4. Build the project: `npm run build`
5. Start the bot: `npm start`

## Development

For development mode with automatic reloading:

```
npm run dev
```