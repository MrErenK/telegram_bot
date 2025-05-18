import * as TelegramBot from "node-telegram-bot-api";
import { AppDataSource } from "../../utils/db";
import { GroupUser } from "../../entity";
import { findGroupUserByIdentifier } from "../../utils/db/group-operations";

/**
 * Admin command to set a user's size or other attributes in the current group chat
 * Usage: /admin_set <username or ID> <attribute> <value>
 * Example: /admin_set @username size 20
 * Example: /admin_set 123456789 size 15.5
 */
export async function setCommand(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  args?: string,
): Promise<void> {
  // Check if this is a group chat
  if (msg.chat.type === "private") {
    await bot.sendMessage(
      msg.chat.id,
      "This command can only be used in group chats.",
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  if (!args) {
    await bot.sendMessage(
      msg.chat.id,
      "Usage: /admin_set <username or ID> <attribute> <value>\n\n" +
        "Available attributes:\n" +
        "- size: Set the user's dick size in this group\n" +
        "- wins: Set the user's win count in this group\n" +
        "- losses: Set the user's loss count in this group\n\n" +
        "Examples:\n" +
        "/admin_set @username size 20\n" +
        "/admin_set 123456789 size 15.5",
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Parse the arguments
  const argParts = args.split(" ");
  if (argParts.length < 3) {
    await bot.sendMessage(
      msg.chat.id,
      "Invalid arguments. Usage: /admin_set <username or ID> <attribute> <value>",
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  const userIdentifier = argParts[0].replace("@", "");
  const attribute = argParts[1].toLowerCase();
  const value = argParts[2];
  const groupId = msg.chat.id;

  // Validate the attribute
  const validAttributes = ["size", "wins", "losses"];
  if (!validAttributes.includes(attribute)) {
    await bot.sendMessage(
      msg.chat.id,
      `Invalid attribute: ${attribute}. Valid attributes are: ${validAttributes.join(
        ", ",
      )}`,
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Validate the value based on the attribute
  let parsedValue: number;

  try {
    parsedValue = parseFloat(value);

    if (isNaN(parsedValue)) {
      throw new Error(`Invalid value: ${value}. Must be a number.`);
    }

    // Additional validation based on attribute type
    if (attribute === "size" && parsedValue < 1) {
      throw new Error(`Size cannot be less than 1cm.`);
    }

    if (
      (attribute === "wins" || attribute === "losses") &&
      (parsedValue < 0 || !Number.isInteger(parsedValue))
    ) {
      throw new Error(
        `${
          attribute.charAt(0).toUpperCase() + attribute.slice(1)
        } must be a non-negative integer.`,
      );
    }
  } catch (error) {
    await bot.sendMessage(
      msg.chat.id,
      error instanceof Error ? error.message : "Invalid value",
      { reply_to_message_id: msg.message_id },
    );
    return;
  }

  // Find the user in this specific group using the helper function
  const groupUser = await findGroupUserByIdentifier(userIdentifier, groupId);

  if (!groupUser) {
    await bot.sendMessage(
      msg.chat.id,
      `User not found in this group: ${userIdentifier}`,
      {
        reply_to_message_id: msg.message_id,
      },
    );
    return;
  }

  // Update the user
  const oldValue = (groupUser as any)[attribute];
  const oldValueDisplay = Number.isInteger(oldValue)
    ? oldValue
    : oldValue.toFixed(1);

  (groupUser as any)[attribute] = parsedValue;

  try {
    // For size updates, ensure it's persisted correctly
    if (attribute === "size") {
      groupUser.size = parsedValue;
    }

    const userRepository = AppDataSource.getRepository(GroupUser);

    // Save the updated user
    await userRepository.save(groupUser);

    // Format the display values to remove decimals if they're whole numbers
    const newValueDisplay = Number.isInteger(parsedValue)
      ? parsedValue
      : parsedValue.toFixed(1);

    await bot.sendMessage(
      msg.chat.id,
      `✅ Successfully updated ${groupUser.firstName}'s ${attribute}:\n` +
        `Old value: ${oldValueDisplay}\n` +
        `New value: ${newValueDisplay}`,
      { reply_to_message_id: msg.message_id },
    );
  } catch (error) {
    await bot.sendMessage(
      msg.chat.id,
      `Error updating user: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      { reply_to_message_id: msg.message_id },
    );
  }
}
