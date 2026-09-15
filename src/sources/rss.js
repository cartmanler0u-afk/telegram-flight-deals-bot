import Parser from "rss-parser";

const parser = new Parser();

export async function fetchDealsFromFeed(feedUrl) {
  try {
    const feed = await parser.parseURL(feedUrl);
    return feed.items.map((item) => ({
      id: item.guid || item.link,
      title: item.title || "Bon plan billet d'avion",
      link: item.link,
      summary: item.contentSnippet || item.content || "",
      publishedAt: item.isoDate || item.pubDate || null,
      source: feed.title || feedUrl,
    }));
  } catch (err) {
    console.error(`Erreur lecture du flux RSS ${feedUrl} :`, err.message);
    return [];
  }
}

export async function fetchAllRssDeals(feedUrls) {
  const results = await Promise.all(feedUrls.map(fetchDealsFromFeed));
  return results.flat();
}
