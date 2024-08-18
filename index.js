import express from "express";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

app.get("/api/games", async (req, res) => {
  try {
    // Step 1: Fetch the RSS feed and extract game IDs
    const rssUrl =
      "https://boardgamegeek.com/recentadditions/rss?subdomain=&infilters%5B0%5D=thing&infilters%5B1%5D=thinglinked&domain=boardgame";
    const rssResponse = await fetch(rssUrl);
    if (!rssResponse.ok) {
      throw new Error("Failed to fetch the RSS feed");
    }
    const rssText = await rssResponse.text();
    const rssResult = await parseStringPromise(rssText);

    // Extract the first 20 game IDs from the RSS feed
    const gameIds = rssResult.rss.channel[0].item
      .filter(
        (item) =>
          !item.link[0].includes("boardgameexpansion") &&
          !item.link[0].includes("boardgameaccessory")
      )
      .slice(0, 20)
      .map((item) => {
        const link = item.link[0];
        return extractBoardGameId(link);
      });

    // Step 2: Fetch game details using the extracted IDs
    const idsParam = gameIds.join(",");
    const gameDetailsUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${idsParam}`;
    const gameResponse = await fetch(gameDetailsUrl);
    if (!gameResponse.ok) {
      throw new Error("Failed to fetch the game details");
    }
    const gameXmlText = await gameResponse.text();
    const gameResult = await parseStringPromise(gameXmlText);

    // Extracting relevant details for each game with defensive checks
    const games = (gameResult.items.item || []).map((game) => ({
      id: game.$?.id || "N/A",
      name: game.name?.[0]?.$.value || "No name available",
      description: game.description?.[0] || "No description available",
      yearPublished: game.yearpublished?.[0]?.$.value || "N/A",
      minPlayers: game.minplayers?.[0]?.$.value || "N/A",
      maxPlayers: game.maxplayers?.[0]?.$.value || "N/A",
      playingTime: game.playingtime?.[0]?.$.value || "N/A",
      minAge: game.minage?.[0]?.$.value || "N/A",
      thumbnail:
        game.thumbnail?.[0] || "https://placehold.co/400x600?text=No+Image",
      categories:
        game.link
          ?.filter((link) => link.$.type === "boardgamecategory")
          .map((link) => link.$.value) || [],
      mechanics:
        game.link
          ?.filter((link) => link.$.type === "boardgamemechanic")
          .map((link) => link.$.value) || [],
    }));

    res.json(games);
  } catch (error) {
    console.error("Error fetching game details:", error);
    res.status(500).send("Failed to fetch game details");
  }
});

const extractBoardGameId = (url) => {
  const match = url.match(/\/boardgame\/(\d+)/);
  return match ? match[1] : "";
};

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
