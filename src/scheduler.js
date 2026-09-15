import cron from "node-cron";
import { fetchAllRssDeals } from "./sources/rss.js";
import { searchKiwiDeals } from "./sources/kiwi.js";
import { getChannelId, listFeeds, listRoutes, isDealSeen, markDealSeen } from "./store.js";
import { postDeal } from "./poster.js";
import { config } from "./config.js";

export async function runDropCycle(bot) {
  const chatId = (await getChannelId()) || config.defaultChannelId;

  if (!chatId) {
    console.log("Aucun salon configuré (utilisez /setchannel) — cycle ignoré.");
    return;
  }

  const deals = [];

  const feeds = await listFeeds();
  if (feeds.length > 0) {
    deals.push(...(await fetchAllRssDeals(feeds)));
  }

  const routes = await listRoutes();
  if (config.kiwiApiKey && routes.length > 0) {
    for (const route of routes) {
      try {
        deals.push(...(await searchKiwiDeals(route, config.kiwiApiKey)));
      } catch (err) {
        console.error(`Erreur recherche Kiwi pour la route ${route.from}-${route.to} :`, err.message);
      }
    }
  }

  for (const deal of deals) {
    if (!deal.id) continue;
    if (await isDealSeen(deal.id)) continue;
    try {
      await postDeal(bot, chatId, deal);
      await markDealSeen(deal.id);
    } catch (err) {
      console.error(`Erreur envoi Telegram pour le deal ${deal.id} :`, err.message);
    }
  }
}

export function startScheduler(bot) {
  runDropCycle(bot);

  const minutes = Math.max(1, Math.min(59, config.checkIntervalMinutes));
  cron.schedule(`*/${minutes} * * * *`, () => runDropCycle(bot));
  console.log(`Cycle de recherche planifié toutes les ${minutes} minute(s).`);
}
