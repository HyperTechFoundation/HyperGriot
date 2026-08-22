/**
 * Network module entry point — combines Federation and Log Channel.
 */

import { Composer, type Context } from "grammy";
import { federationComposer } from "./federation.js";
import { logChannelComposer } from "./logchannel.js";

export { federationComposer } from "./federation.js";
export { logChannelComposer } from "./logchannel.js";

export const federationModuleComposer = new Composer<Context>();
federationModuleComposer.use(federationComposer);
federationModuleComposer.use(logChannelComposer);

export function registerFederation(bot: { use: (c: Composer<Context>) => void }): void {
  bot.use(federationModuleComposer);
}
