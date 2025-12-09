import express from "express";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import axios from "axios";
import * as cheerio from "cheerio";

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
const gameIds2025 = db.collection("2025games");
const playsCollection = db.collection("plays");

app.get("/api/games", async (req, res) => {
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

    // Function to fetch game details with a delay
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
    res.json(allGames);
  } catch (error) {
    res.status(500).send("Failed to fetch game details");
  }
});

// New endpoint to return all data from MongoDB
app.get("/api/all-games", async (req, res) => {
  try {
    const games = await gamesCollection.find().toArray();
    res.json(games);
  } catch (error) {
    res.status(500).send("Failed to fetch all games");
  }
});

app.get("/api/scrape", async (req, res) => {
  console.log("Received request for /api/scrape");
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    let page = 1;
    while (true) {
      console.log(`Scraping page ${page}`);
      const url = `https://boardgamegeek.com/search/boardgame/page/${page}?advsearch=1&q=&include%5Bdesignerid%5D=&include%5Bpublisherid%5D=&geekitemname=&range%5Byearpublished%5D%5Bmin%5D=2025&range%5Byearpublished%5D%5Bmax%5D=2030&range%5Bminage%5D%5Bmax%5D=&range%5Bnumvoters%5D%5Bmin%5D=&range%5Bnumweights%5D%5Bmin%5D=&range%5Bminplayers%5D%5Bmax%5D=&range%5Bmaxplayers%5D%5Bmin%5D=&range%5Bleastplaytime%5D%5Bmin%5D=&range%5Bplaytime%5D%5Bmax%5D=&floatrange%5Bavgrating%5D%5Bmin%5D=&floatrange%5Bavgrating%5D%5Bmax%5D=&floatrange%5Bavgweight%5D%5Bmin%5D=&floatrange%5Bavgweight%5D%5Bmax%5D=&colfiltertype=&searchuser=&nosubtypes%5B0%5D=boardgameexpansion&playerrangetype=normal&B1=Submit`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${process.env.BGG_API_KEY}`,
        },
      });
      const gameEntries = response.data;
      if (gameEntries.items.length === 0) {
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

    res.json({ message: "Scraping completed" });
  } catch (error) {
    console.error("Error scraping BGG:", error);
    res.status(500).send("Failed to scrape BGG");
  }
});

app.get("/api/plays/:username", async (req, res) => {
  try {
    const { username } = req.params;
    console.log(`Fetching 2025 plays for user: ${username}`);

    const allPlays = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const url = `https://boardgamegeek.com/xmlapi2/plays?username=${username}&mindate=2025-01-01&maxdate=2025-12-31&page=${page}`;
      console.log(`Fetching page ${page}: ${url}`);

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${process.env.BGG_API_KEY}`,
        },
      });
      const playsData = await parseStringPromise(response.data);

      // Check if we have plays in the response
      if (playsData.plays && playsData.plays.play) {
        const plays = playsData.plays.play;
        console.log(`Found ${plays.length} plays on page ${page}`);

        // Parse and format the plays
        const formattedPlays = plays.map((play) => ({
          id: play.$.id,
          date: play.$.date,
          quantity: play.$.quantity,
          length: play.$.length,
          incomplete: play.$.incomplete === "1",
          nowinstats: play.$.nowinstats === "1",
          location: play.$.location,
          item: {
            name: play.item[0].$.name,
            objecttype: play.item[0].$.objecttype,
            objectid: play.item[0].$.objectid,
          },
          comments: play.comments?.[0] || "",
        }));

        allPlays.push(...formattedPlays);

        // Check if there are more pages
        const total = parseInt(playsData.plays.$.total);
        const currentCount = page * 100;
        hasMorePages = currentCount < total;

        if (hasMorePages) {
          page++;
          // Add delay to respect BGG rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } else {
        // No plays found or no more pages
        hasMorePages = false;
      }
    }

    console.log(
      `Total plays found for ${username} in 2025: ${allPlays.length}`
    );

    // Save plays to MongoDB
    if (allPlays.length > 0) {
      // Add username to each play document
      const playsWithUsername = allPlays.map((play) => ({
        ...play,
        username,
        year: 2025,
      }));

      // Remove existing plays for this user and year, then insert new ones
      await playsCollection.deleteMany({ username, year: 2025 });
      await playsCollection.insertMany(playsWithUsername);
      console.log(
        `Saved ${allPlays.length} plays to MongoDB for user ${username}`
      );

      // Extract unique game IDs from plays
      const gameIds = [
        ...new Set(allPlays.map((play) => parseInt(play.item.objectid))),
      ];
      console.log(`Found ${gameIds.length} unique games in plays`);

      // Check which games already exist in the database
      const existingGames = await gamesCollection
        .find({ id: { $in: gameIds } })
        .toArray();
      const existingGameIds = existingGames.map((game) => game.id);
      const newGameIds = gameIds.filter((id) => !existingGameIds.includes(id));

      console.log(`Need to fetch ${newGameIds.length} new games`);

      // Fetch game details in batches of 20
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

      const newGames = [];
      for (let i = 0; i < newGameIds.length; i += 20) {
        const batchIds = newGameIds.slice(i, i + 20);
        console.log(`Fetching details for game IDs: ${batchIds.join(", ")}`);
        const gameResult = await fetchGameDetailsWithDelay(batchIds);
        const gamesToInsert = (gameResult.items.item || []).map((game) => ({
          id: parseInt(game.$?.id) || "N/A",
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
          dateAdded: new Date(),
        }));

        // Insert each game into MongoDB as it is fetched
        for (const game of gamesToInsert) {
          await gamesCollection.insertOne(game);
          console.log(
            `Saved game: https://boardgamegeek.com/boardgame/${game.id}`
          );
          newGames.push(game);
        }

        if (i + 20 < newGameIds.length) {
          console.log("Waiting 5.5 seconds before next batch...");
          await new Promise((resolve) => setTimeout(resolve, 5500));
        }
      }

      console.log(`Fetched and saved ${newGames.length} new games`);
    }

    res.json({
      username,
      year: 2025,
      totalPlays: allPlays.length,
      plays: allPlays,
    });
  } catch (error) {
    console.error("Error fetching user plays:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch user plays", message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
