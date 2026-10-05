import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function handler(req, res) {
  const STC_URL = "https://www.stcmu.com/ppm/retail-prices";

  try {
    const file = await readFile(
      path.join(process.cwd(), "data", "fuel-prices.json"),
      "utf8"
    );
    const data = JSON.parse(file);

    if (
      !data?.prices?.mogas?.price ||
      !data?.prices?.gasoil?.price ||
      !data?.date
    ) {
      throw new Error("Invalid local fuel-price data");
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=3600"
    );

    return res.status(200).json({
      ...data,
      retrieval: "scheduled-github",
      warning: null
    });
  } catch (error) {
    console.error("[fuel-prices] local data failed", String(error));

    return res.status(500).json({
      error: "Fuel price data unavailable",
      source: "State Trading Corporation",
      sourceUrl: STC_URL
    });
  }
}
