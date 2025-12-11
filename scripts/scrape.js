import { parseStringPromise } from "xml2js";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import axios from "axios";

// Load environment variables from .env file
dotenv.config();

// Configure MongoDB client
const mongoClient = new MongoClient(process.env.MONGODB_URI);

await mongoClient.connect();
const db = mongoClient.db("bgg");
const gamesCollection = db.collection("games");
const gameIds2025 = db.collection("2025games");

const fetchGameDetailsWithDelay = async (ids) => {
  const gameDetailsUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(
    ","
  )}`;
  console.log(`Fetching game details from URL: ${gameDetailsUrl}`);
  const gameResponse = await axios.get(gameDetailsUrl, {
    headers: {
      Authorization: `Bearer ${process.env.BGG_API_KEY}`,
    },
  });
  if (gameResponse.status !== 200) {
    throw new Error("Failed to fetch the game details");
  }
  const gameXmlText = await gameResponse.data;
  return parseStringPromise(gameXmlText);
};

const getGamesData = async () => {
  try {
    // Fetch game IDs from the 2025games collection
    const games2025 = await gameIds2025.find().toArray();
    const gameIds = games2025.map((game) => game.id);

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
      const gameResult = await fetchGameDetailsWithDelay(batchIds);
      const gamesToInsert = (gameResult.items.item || []).map((game) => ({
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
        artist:
          game.link
            ?.filter((link) => link.$.type === "boardgameartist")
            .map((link) => link.$.value) || [],
        publisher:
          game.link
            ?.filter((link) => link.$.type === "boardgamepublisher")
            .map((link) => link.$.value) || [],
      }));

      // Insert each game into MongoDB as it is fetched
      for (const game of gamesToInsert) {
        await gamesCollection.insertOne(game);
        console.log(`https://boardgamegeek.com/boardgame/${game.id}`);
        newGames.push(game);
      }

      if (i + 20 < newGameIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 5500));
      }
    }

    // Combine existing and new games
    const allGames = [...existingGames, ...newGames];
    console.log("Finished");
  } catch (error) {
    console.log("Failed to fetch game details");
  }
};

const scrapeBgg = async () => {
  console.log("Received request to scrape");
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    let page = 1;
    while (true) {
      console.log(`Scraping page ${page}`);
      const url = `https://boardgamegeek.com/search/boardgame/page/${page}?advsearch=1&q=&include%5Bdesignerid%5D=&include%5Bpublisherid%5D=&geekitemname=&range%5Byearpublished%5D%5Bmin%5D=2025&range%5Byearpublished%5D%5Bmax%5D&range%5Bminage%5D%5Bmax%5D=&range%5Bnumvoters%5D%5Bmin%5D=&range%5Bminplayers%5D%5Bmax%5D=&range%5Bmaxplayers%5D%5Bmin%5D=&range%5Bleastplaytime%5D%5Bmin%5D=&range%5Bplaytime%5D%5Bmax%5D=&floatrange%5Bavgrating%5D%5Bmin%5D=&floatrange%5Bavgrating%5D%5Bmax%5D=&floatrange%5Bavgweight%5D%5Bmin%5D=&floatrange%5Bavgweight%5D%5Bmax%5D=&colfiltertype=&searchuser=&nosubtypes%5B0%5D=boardgameexpansion&playerrangetype=normal&B1=Submit`;
      const response = await axios.get(url);
      const gameEntries = response.data;
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
        console.log(`Saving ${newGameIds.length} new game IDs to MongoDB`);
        await gameIds2025.insertMany(newGameIds.map((id) => ({ id })));
      }
      page++;

      // Add a delay of 2-5 seconds between requests
      const delayTime = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
      await delay(delayTime);
    }

    console.log("Scraping completed");
    getGamesData();
  } catch (error) {
    console.error("Error scraping BGG:", error);
  }
};

scrapeBgg();
