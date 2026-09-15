import { registerHelp } from "./help.js";
import { registerSetChannel } from "./setchannel.js";
import { registerAddFeed } from "./addfeed.js";
import { registerRemoveFeed } from "./removefeed.js";
import { registerListFeeds } from "./listfeeds.js";
import { registerAddRoute } from "./addroute.js";
import { registerRemoveRoute } from "./removeroute.js";
import { registerListRoutes } from "./listroutes.js";
import { registerTestDrop } from "./testdrop.js";

export function registerCommands(bot) {
  registerHelp(bot);
  registerSetChannel(bot);
  registerAddFeed(bot);
  registerRemoveFeed(bot);
  registerListFeeds(bot);
  registerAddRoute(bot);
  registerRemoveRoute(bot);
  registerListRoutes(bot);
  registerTestDrop(bot);
}
