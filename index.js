import express from "express";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// Configure MongoDB client
const mongoClient = new MongoClient(process.env.MONGODB_URI);

await mongoClient.connect();
const db = mongoClient.db("bgg");
const gamesCollection = db.collection("games");

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
      .map((item) => {
        const link = item.link[0];
        return extractBoardGameId(link);
      });

    // Check MongoDB for existing game IDs
    const existingGames = await gamesCollection.find({ id: { $in: gameIds } }).toArray();
    const existingGameIds = existingGames.map(game => game.id);
    const newGameIds = gameIds.filter(id => !existingGameIds.includes(id));

    // Function to fetch game details with a delay
    const fetchGameDetailsWithDelay = async (ids) => {
      const gameDetailsUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(",")}`;
      const gameResponse = await fetch(gameDetailsUrl);
      if (!gameResponse.ok) {
        throw new Error("Failed to fetch the game details");
      }
      const gameXmlText = await gameResponse.text();
      return parseStringPromise(gameXmlText);
    };

    // Fetch game details in batches of 20 with a 5.5-second delay
    const newGames = [];
    for (let i = 0; i < newGameIds.length; i += 20) {
      const batchIds = newGameIds.slice(i, i + 20);
      const gameResult = await fetchGameDetailsWithDelay(batchIds);
      newGames.push(
        ...(gameResult.items.item || []).map((game) => ({
          id: game.$?.id || "N/A",
          name: game.name?.[0]?.$.value || "No name available",
          description: game.description?.[0] || "No description available",
          yearPublished: game.yearpublished?.[0]?.$.value || "N/A",
          minPlayers: game.minplayers?.[0]?.$.value || "N/A",
          maxPlayers: game.maxplayers?.[0]?.$.value || "N/A",
          playingTime: game.playingtime?.[0]?.$.value || "N/A",
          minAge: game.minage?.[0]?.$.value || "N/A",
          thumbnail:
            game.thumbnail?.[0] || "https://placehold.co/388x256?text=No+Image",
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
          publisher:
            game.link
              ?.filter((link) => link.$.type === "boardgamepublisher")
              .map((link) => link.$.value) || [],
        }))
      );
      if (i + 20 < newGameIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 5500));
      }
    }

    // Save new games to MongoDB
    if (newGames.length > 0) {
      await gamesCollection.insertMany(newGames);
    }

    // Combine existing and new games
    const allGames = [...existingGames, ...newGames];

    res.json(allGames);
  } catch (error) {
    console.error("Error fetching game details:", error);
    res.status(500).send("Failed to fetch game details");
  }
});

const extractBoardGameId = (url) => {
  const match = url.match(/\/boardgame\/(\d+)/);
  return match ? match[1] : "";
};

// New endpoint to return all data from MongoDB
app.get("/api/all-games", async (req, res) => {
  try {
    const games = await gamesCollection.find().toArray();
    res.json(games);
  } catch (error) {
    console.error("Error fetching all games from MongoDB:", error);
    res.status(500).send("Failed to fetch all games");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
