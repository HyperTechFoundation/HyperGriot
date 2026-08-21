/**
 * Dual-prefix normalization middleware.
 *
 * Allows commands to be triggered with either '!' or '/'.
 * Rewrites leading '!' to '/' and injects a bot_command entity into message entities
 * so that grammY's built-in command handlers match '!command' seamlessly.
 */

import type { Context, MiddlewareFn } from "grammy";
import type { MessageEntity } from "grammy/types";

/** Normalizes '!' prefix commands to standard Telegram '/' bot_commands. */
export const normalizePrefixMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const msg = ctx.message ?? ctx.editedMessage ?? ctx.channelPost;
  if (!msg) return next();

  if (msg.text && msg.text.startsWith("!")) {
    const match = /^!([a-zA-Z0-9_]+(@[a-zA-Z0-9_]+)?)/.exec(msg.text);
    if (match) {
      const cmdLength = match[0].length; // Includes '!'
      msg.text = "/" + msg.text.slice(1);
      const entity: MessageEntity = {
        type: "bot_command",
        offset: 0,
        length: cmdLength, // now corresponds to '/command' or '/command@Bot'
      };
      if (!msg.entities) {
        msg.entities = [entity];
      } else {
        msg.entities = [entity, ...msg.entities];
      }
    }
  } else if (msg.caption && msg.caption.startsWith("!")) {
    const match = /^!([a-zA-Z0-9_]+(@[a-zA-Z0-9_]+)?)/.exec(msg.caption);
    if (match) {
      const cmdLength = match[0].length;
      msg.caption = "/" + msg.caption.slice(1);
      const entity: MessageEntity = {
        type: "bot_command",
        offset: 0,
        length: cmdLength,
      };
      if (!msg.caption_entities) {
        msg.caption_entities = [entity];
      } else {
        msg.caption_entities = [entity, ...msg.caption_entities];
      }
    }
  }

  return next();
};
