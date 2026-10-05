export default async function handler(req, res) {
  const STC_URL = "https://www.stcmu.com/ppm/retail-prices";

  try {
    const response = await fetch(STC_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FuelPriceMRU/1.0)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      throw new Error("STC returned HTTP " + response.status);
    }

    const html = await response.text();

    // STC currently exposes retail-price rows containing date, Mogas and Gas Oil.
    // Keep several patterns so minor HTML/table formatting changes do not immediately break the API.
    const patterns = [
      /(\d{2}[-\s]\w{3}[-\s]\d{4})\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/i,
      /(\d{2}[-\s]\w+[-\s]\d{4})[^\d]{0,120}([\d]+(?:\.\d+)?)\s*[^\d]{0,120}([\d]+(?:\.\d+)?)/i
    ];

    let found = null;
    for (const re of patterns) {
      const match = html.match(re);
      if (match) {
        const mogas = Number(match[2]);
        const gasoil = Number(match[3]);
        if (mogas > 30 && mogas < 200 && gasoil > 30 && gasoil < 200) {
          found = { date: match[1].replace(/\s+/g, " ").trim(), mogas, gasoil };
          break;
        }
      }
    }

    if (!found) {
      throw new Error("Could not find valid STC retail prices");
    }

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({
      source: "State Trading Corporation",
      sourceUrl: STC_URL,
      date: found.date,
      prices: {
        mogas: { price: found.mogas, date: found.date },
        gasoil: { price: found.gasoil, date: found.date }
      }
    });
  } catch (error) {
    res.status(502).json({
      error: "Unable to retrieve STC fuel prices"
    });
  }
}
