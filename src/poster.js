function escapeMarkdown(text = "") {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export function formatDealMessage(deal) {
  const lines = [
    `✈️ *${escapeMarkdown(deal.title)}*`,
    deal.summary ? escapeMarkdown(deal.summary) : null,
    deal.link ? `🔗 [Voir l'offre](${deal.link})` : null,
    deal.source ? `_Source : ${escapeMarkdown(deal.source)}_` : null,
  ].filter(Boolean);

  return lines.join("\n\n");
}

export async function postDeal(bot, chatId, deal) {
  await bot.telegram.sendMessage(chatId, formatDealMessage(deal), {
    parse_mode: "MarkdownV2",
  });
}
