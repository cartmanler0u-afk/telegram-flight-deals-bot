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
        "",
        "🏢 *QG des agents IA*",
        "/office — ouvrir la mini app 3D de vos agents (directeur, managers, studio web, bibliothèque, secrétariat, salle de réunion)",
        "",
        "🏚️ *THE MADHOUSE — Bâtiment 0* (simulation autonome, univers fictif)",
        "/building — vue d'ensemble et menu · /report — « Pendant ton absence »",
        "/news · /floors · /agents · /agent <nom> · /organizations · /economy",
        "/mysteries · /investigate · /rumors · /anomalies · /laws · /plots · /history",
        "/madhouse\\_config — réglages (cycle, notifications, IA) (admin)",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });
}
