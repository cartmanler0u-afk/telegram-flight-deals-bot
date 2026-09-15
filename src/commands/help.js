export function registerHelp(bot) {
  bot.command("help", (ctx) => {
    ctx.reply(
      [
        "✈️ *Bot de bons plans billets d'avion*",
        "",
        "/setchannel — définir ce salon comme destination des drops (admin)",
        "/addfeed <url> — ajouter un flux RSS de bons plans (admin)",
        "/removefeed <url> — retirer un flux RSS (admin)",
        "/listfeeds — lister les flux RSS configurés",
        "/addroute <ORIGINE> <DESTINATION> <PRIX_MAX> [devise] — surveiller une route (admin, nécessite KIWI_API_KEY)",
        "/removeroute <id> — retirer une route surveillée (admin)",
        "/listroutes — lister les routes surveillées",
        "/testdrop — forcer un cycle de recherche immédiat (admin)",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
