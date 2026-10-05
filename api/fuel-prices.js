export default async function handler(req, res) {
  const STC_URL = "https://www.stcmu.com/ppm/retail-prices";
  const FALLBACK = { date: "29 September 2026", mogas: 77.70, gasoil: 78.35 };

  const sources = [
    { name: "STC", url: STC_URL, headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FuelPriceMRU/1.0)",
      "Accept": "text/html,application/xhtml+xml,text/html"
    }},
    { name: "AllOrigins", url: "https://api.allorigins.win/raw?url=" + encodeURIComponent(STC_URL),
      headers: { "Accept": "text/html,application/xhtml+xml,text/html" }}
  ];

  function parsePrices(html) {
    const patterns = [
      /(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{4})[^\d]{0,300}([\d]+(?:\.\d+)?)[^\d]{0,300}([\d]+(?:\.\d+)?)/i,
      /(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{2})[^\d]{0,300}([\d]+(?:\.\d+)?)[^\d]{0,300}([\d]+(?:\.\d+)?)/i
    ];
    for (const re of patterns) {
      const match = html.match(re);
      if (!match) continue;
      const year = match[3].length === 2 ? "20" + match[3] : match[3];
      const mogas = Number(match[4]);
      const gasoil = Number(match[5]);
      if (mogas > 30 && mogas < 200 && gasoil > 30 && gasoil < 200) {
        return { date: `${match[1]}-${match[2]}-${year}`, mogas, gasoil };
      }
    }
    return null;
  }

  async function fetchSource(source) {
    const response = await fetch(source.url, { headers: source.headers, redirect: "follow" });
    if (!response.ok) throw new Error(source.name + " HTTP " + response.status);
    const found = parsePrices(await response.text());
    if (!found) throw new Error(source.name + " price table not found");
    return { ...found, source: source.name };
  }

  for (const source of sources) {
    try {
      const found = await fetchSource(source);
      console.log("[fuel-prices] fetched", found.source, found.date, found.mogas, found.gasoil);
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      return res.status(200).json({
        source: "State Trading Corporation", sourceUrl: STC_URL, retrieval: found.source,
        date: found.date,
        prices: {
          mogas: { price: found.mogas, date: found.date },
          gasoil: { price: found.gasoil, date: found.date }
        }
      });
    } catch (error) {
      console.error("[fuel-prices] source failed", source.name, String(error));
    }
  }

  console.warn("[fuel-prices] all live sources failed; using verified fallback");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).json({
    source: "State Trading Corporation", sourceUrl: STC_URL, retrieval: "fallback",
    date: FALLBACK.date,
    prices: {
      mogas: { price: FALLBACK.mogas, date: FALLBACK.date },
      gasoil: { price: FALLBACK.gasoil, date: FALLBACK.date }
    },
    warning: "Live STC retrieval temporarily unavailable; using last verified fallback prices."
  });
}
