/**
 * Network module entry point — combines Federation and Log Channel.
 */

import { Composer, type Context } from "grammy";
import { federationComposer } from "./federation.js";
import { logChannelComposer } from "./logchannel.js";

export const networkComposer = new Composer<Context>();
networkComposer.use(federationComposer);
networkComposer.use(logChannelComposer);

export function registerNetwork(bot: { use: (c: Composer<Context>) => void }): void {
  bot.use(networkComposer);
}
