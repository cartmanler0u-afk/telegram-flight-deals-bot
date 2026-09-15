// Intégration optionnelle avec l'API Kiwi Tequila (https://tequila.kiwi.com/portal/docs/tequila_api)
// pour surveiller des routes précises (ex: PAR -> BKK sous 400€) plutôt que des flux RSS génériques.
// Nécessite une clé KIWI_API_KEY dans .env. À tester/ajuster selon la doc à jour de l'API,
// que ce bot n'appelle pas au moment de l'écriture de ce code.

const TEQUILA_SEARCH_URL = "https://api.tequila.kiwi.com/v2/search";

export async function searchKiwiDeals(route, apiKey) {
  const params = new URLSearchParams({
    fly_from: route.from,
    fly_to: route.to,
    max_price: String(route.maxPrice),
    curr: route.currency || "EUR",
    limit: "5",
    sort: "price",
  });

  const response = await fetch(`${TEQUILA_SEARCH_URL}?${params.toString()}`, {
    headers: { apikey: apiKey },
  });

  if (!response.ok) {
    throw new Error(`L'API Kiwi a répondu avec le statut ${response.status}`);
  }

  const data = await response.json();
  const currency = data.currency || route.currency || "EUR";

  return (data.data || []).map((flight) => ({
    id: `kiwi_${flight.id}`,
    title: `${route.from} → ${route.to} à partir de ${flight.price} ${currency}`,
    link: flight.deep_link,
    summary: flight.local_departure ? `Départ le ${flight.local_departure.slice(0, 10)}` : "",
    publishedAt: new Date().toISOString(),
    source: "Kiwi.com",
  }));
}
