import { parseStringPromise } from "xml2js";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import axios from "axios";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

// Load environment variables from .env file
dotenv.config();

/** BGG wraps the public site in Cloudflare; plain HTTP (axios) gets a 403 challenge. Use a real browser for advanced search only. */
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Advanced search form (year 2026 + searchuser), same as geeksearch.php in the browser.
 * Page 1: POST-style GET on geeksearch.php; later pages use the paginated search path with the same filters.
 */
const ADV_SEARCH_PARAMS =
  "advsearch=1&objecttype=boardgame&q=&include%5Bdesignerid%5D=&geekitemname=&geekitemname=&include%5Bpublisherid%5D=&range%5Byearpublished%5D%5Bmin%5D=2026&range%5Byearpublished%5D%5Bmax%5D=2026&range%5Bminage%5D%5Bmax%5D=&floatrange%5Bavgrating%5D%5Bmin%5D=&floatrange%5Bavgrating%5D%5Bmax%5D=&range%5Bnumvoters%5D%5Bmin%5D=&floatrange%5Bavgweight%5D%5Bmin%5D=&floatrange%5Bavgweight%5D%5Bmax%5D=&range%5Bnumweights%5D%5Bmin%5D=&colfiltertype=&searchuser=&nosubtypes%5B%5D=boardgameexpansion&range%5Bminplayers%5D%5Bmax%5D=&range%5Bmaxplayers%5D%5Bmin%5D=&playerrangetype=normal&range%5Bleastplaytime%5D%5Bmin%5D=&range%5Bplaytime%5D%5Bmax%5D=&B1=Submit";

const advancedSearchUrl = (pageNum) =>
  pageNum === 1
    ? `https://boardgamegeek.com/geeksearch.php?action=search&${ADV_SEARCH_PARAMS}`
    : `https://boardgamegeek.com/search/boardgame/page/${pageNum}?${ADV_SEARCH_PARAMS}`;

/**
 * One tab: load BGG first so Cloudflare / cookies apply, then navigate to search (document loads pass checks more often than in-page fetch).
 *
 * @param {import('puppeteer').Browser} browser
 */
async function createBggSearchSession(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(CHROME_UA);
  await page.setViewport({ width: 1366, height: 900 });
  console.log("Loading boardgamegeek.com (session / Cloudflare)...");
  await page.goto("https://boardgamegeek.com/", {
    waitUntil: "networkidle2",
    timeout: 120_000,
  });
  await new Promise((r) => setTimeout(r, 2500));
  return page;
}

/**
 * Advanced search: page 1 via geeksearch.php; page 2+ via /search/boardgame/page/N with the same query string.
 * Uses full navigation (not fetch) + stealth; BGG may return JSON or HTML.
 *
 * @param {import('puppeteer').Page} page
 * @param {number} pageNum
 */
async function fetchAdvancedSearchPage(page, pageNum) {
  const url = advancedSearchUrl(pageNum);
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  });

  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  if (!response) {
    throw new Error("Navigation returned no response.");
  }

  const status = response.status();
  let text = await response.text();
  if (!text || text.length < 20) {
    text = await page.content();
  }

  if (status === 403 || text.includes("Just a moment")) {
    throw new Error(
      "Cloudflare blocked the search. Use a visible browser: do not set PUPPETEER_HEADLESS=true (default is headed). Optionally set PUPPETEER_CHANNEL=chrome. Complete any challenge in the window."
    );
  }
  if (status >= 400) {
    const preview = text.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`Search HTTP ${status}: ${preview}`);
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed;
    }
  } catch {
    /* HTML or other */
  }

  const ids = [];
  const re = /href="\/boardgame\/(\d+)\//g;
  let m;
  while ((m = re.exec(text)) !== null) {
    ids.push(parseInt(m[1], 10));
  }
  const unique = [...new Set(ids)];
  return { items: unique.map((id) => ({ id })) };
}

// Configure MongoDB client
const mongoClient = new MongoClient(process.env.MONGODB_URI);

await mongoClient.connect();
const db = mongoClient.db("bgg");
const gamesCollection = db.collection("games");
const gameIds2025 = db.collection("2026games");
const metaCollection = db.collection("meta");
const SCRAPE_META_ID = "2026-games-scrape";

const fetchGameDetailsWithDelay = async (ids) => {
  try {
    const gameDetailsUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(
      ","
    )}`;
    console.log(`Fetching from URL: ${gameDetailsUrl}`);
    const gameResponse = await axios.get(gameDetailsUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BGG_API_KEY}`,
      },
    });
    console.log(`Response status: ${gameResponse.status}`);
    if (gameResponse.status !== 200) {
      throw new Error(
        `Failed to fetch the game details: ${gameResponse.status}`
      );
    }
    const gameXmlText = gameResponse.data;
    console.log(`XML length: ${gameXmlText.length}`);
    console.log(`First 500 chars: ${gameXmlText.substring(0, 500)}`);

    // Check if the response contains an error
    if (gameXmlText.includes("<error>") || gameXmlText.includes("message=")) {
      throw new Error(`BGG API returned an error: ${gameXmlText}`);
    }

    return parseStringPromise(gameXmlText);
  } catch (error) {
    console.error(`Error in fetchGameDetailsWithDelay: ${error.message}`);
    throw error;
  }
};

const getGamesData = async (previousLastRunCompletedAt) => {
  const now = () => new Date();
  try {
    // Fetch game IDs from the 2026games collection
    const games2026 = await gameIds2025.find().toArray();
    const discoveryById = new Map(
      games2026.map((g) => {
        const id = parseInt(g.id, 10);
        const raw = g.bggDiscoveredAt;
        const discovered =
          raw instanceof Date ? raw : raw ? new Date(raw) : null;
        return [id, discovered];
      })
    );
    // Ensure game IDs are integers for consistent comparison
    const gameIds = games2026.map((game) => parseInt(game.id, 10));

    // Check MongoDB for existing game IDs
    const existingGames = await gamesCollection
      .find({ id: { $in: gameIds } })
      .toArray();
    const existingGameIds = existingGames.map((game) => game.id);
    const newGameIds = gameIds.filter((id) => !existingGameIds.includes(id));
    console.log(`Identified ${newGameIds.length} new game IDs to fetch`);

    // Fetch game details in batches of 20 with a 5.5-second delay
    const newGames = [];
    for (let i = 0; i < newGameIds.length; i += 20) {
      const batchIds = newGameIds.slice(i, i + 20);
      console.log(`Fetching details for game IDs: ${batchIds.join(", ")}`);
      try {
        const gameResult = await fetchGameDetailsWithDelay(batchIds);
        const gamesToInsert = (gameResult.items.item || []).map((game) => {
          const id = parseInt(game.$?.id, 10) || "N/A";
          const discovered = discoveryById.get(id) ?? now();
          return {
            id,
            name: game.name?.[0]?.$.value || "No name available",
            description: game.description?.[0] || "No description available",
            yearPublished: game.yearpublished?.[0]?.$.value || "N/A",
            minPlayers: game.minplayers?.[0]?.$.value || "N/A",
            maxPlayers: game.maxplayers?.[0]?.$.value || "N/A",
            playingTime: game.playingtime?.[0]?.$.value || "N/A",
            minAge: game.minage?.[0]?.$.value || "N/A",
            thumbnail:
              game.thumbnail?.[0] ||
              "https://placehold.co/388x256?text=No+Image",
            categories:
              game.link
                ?.filter((link) => link.$.type === "boardgamecategory")
                .map((link) => link.$.value) || [],
            mechanics:
              game.link
                ?.filter((link) => link.$.type === "boardgamemechanic")
                .map((link) => link.$.value) || [],
            designer:
              game.link
                ?.filter((link) => link.$.type === "boardgamedesigner")
                .map((link) => link.$.value) || [],
            artist:
              game.link
                ?.filter((link) => link.$.type === "boardgameartist")
                .map((link) => link.$.value) || [],
            publisher:
              game.link
                ?.filter((link) => link.$.type === "boardgamepublisher")
                .map((link) => link.$.value) || [],
            bggDiscoveredAt: discovered,
            updatedAt: now(),
          };
        });

        // Insert each game into MongoDB as it is fetched
        for (const game of gamesToInsert) {
          const insertAt = now();
          await gamesCollection.updateOne(
            { id: game.id },
            {
              $set: game,
              $setOnInsert: {
                firstIndexedAt: insertAt,
                dateAdded: insertAt,
              },
            },
            { upsert: true }
          );
          console.log(`https://boardgamegeek.com/boardgame/${game.id}`);
          newGames.push({
            ...game,
            firstIndexedAt: insertAt,
            dateAdded: insertAt,
          });
        }
      } catch (error) {
        console.error(
          `Failed to fetch batch ${Math.floor(i / 20) + 1}: ${error.message}`
        );
        // Continue with next batch instead of stopping
      }

      if (i + 20 < newGameIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 5500));
      }
    }

    const newSinceLastRun = previousLastRunCompletedAt
      ? await gamesCollection
          .find({
            firstIndexedAt: { $gt: previousLastRunCompletedAt },
            yearPublished: "2026",
          })
          .project({
            id: 1,
            name: 1,
            firstIndexedAt: 1,
            bggDiscoveredAt: 1,
          })
          .sort({ firstIndexedAt: -1 })
          .toArray()
      : newGames.map((g) => ({
          id: g.id,
          name: g.name,
          firstIndexedAt: g.firstIndexedAt,
          bggDiscoveredAt: g.bggDiscoveredAt,
        }));

    console.log("\n========== New in DB since last successful run ==========");
    if (newSinceLastRun.length === 0) {
      console.log("(none)");
    } else {
      console.log(`Count: ${newSinceLastRun.length}`);
      for (const g of newSinceLastRun) {
        console.log(
          `  ${g.id}  ${g.name}  (indexed ${
            g.firstIndexedAt?.toISOString?.() ?? g.firstIndexedAt
          })`
        );
      }
    }
    console.log("==========================================================\n");

    await metaCollection.updateOne(
      { _id: SCRAPE_META_ID },
      {
        $set: {
          lastRunCompletedAt: now(),
          priorRunCompletedAt: previousLastRunCompletedAt,
        },
      },
      { upsert: true }
    );

    console.log("Finished");
  } catch (error) {
    console.log("Failed to fetch game details");
    throw error;
  }
};

const scrapeBgg = async () => {
  console.log("Received request to scrape");
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const scrapeMeta =
    (await metaCollection.findOne({ _id: SCRAPE_META_ID })) || null;
  const previousLastRunCompletedAt = scrapeMeta?.lastRunCompletedAt ?? null;
  if (previousLastRunCompletedAt) {
    console.log(
      `Previous successful run ended at: ${previousLastRunCompletedAt.toISOString()}`
    );
  } else {
    console.log(
      "No previous run checkpoint (meta.lastRunCompletedAt). Summary will list only games indexed in this run."
    );
  }

  let browser;
  /** @type {import('puppeteer').Page | undefined} */
  let searchPage;
  try {
    /** Headless is often blocked by Cloudflare; default is a visible window. Set PUPPETEER_HEADLESS=true to hide it. */
    const headless = process.env.PUPPETEER_HEADLESS === "true";
    const useSystemChrome = process.env.PUPPETEER_CHANNEL === "chrome";
    console.log(
      `Launching browser for BGG advanced search (headless=${headless}; PUPPETEER_CHANNEL=chrome=${useSystemChrome}).`
    );
    const launchOpts = {
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    };
    if (useSystemChrome) {
      launchOpts.channel = "chrome";
    }
    browser = await puppeteer.launch(launchOpts);
    searchPage = await createBggSearchSession(browser);

    let page = 1;
    while (true) {
      console.log(
        `Scraping page ${page} (geeksearch.php on page 1, then /search/boardgame/page/…)`
      );
      const gameEntries = await fetchAdvancedSearchPage(searchPage, page);
      if (!gameEntries.items || gameEntries.items.length === 0) {
        console.log("No more games found. Exiting loop.");
        break;
      }
      const gameIds = gameEntries.items.map((item) => item.id);

      // Check MongoDB for existing game IDs

      const existingGameIds = await gameIds2025
        .find()
        .toArray()
        .then((games) => games.map((game) => game.id));

      const newGameIds = gameIds.filter((id) => !existingGameIds.includes(id));
      // Save new game IDs to MongoDB as they are found
      if (newGameIds.length > 0) {
        const discoveredAt = new Date();
        console.log(`Saving ${newGameIds.length} new game IDs to MongoDB`);
        await gameIds2025.insertMany(
          newGameIds.map((id) => ({ id, bggDiscoveredAt: discoveredAt }))
        );
      }
      page++;

      // Add a delay of 2-5 seconds between requests
      const delayTime = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
      await delay(delayTime);
    }

    console.log("Scraping completed");
    await getGamesData(previousLastRunCompletedAt);
  } catch (error) {
    console.error("Error scraping BGG:", error);
  } finally {
    if (searchPage) {
      await searchPage.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    await mongoClient.close();
  }
};

scrapeBgg();
