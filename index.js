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
    const { refetch } = req.query;
    console.log(`Fetching 2025 plays for user: ${username}`);

    // Check if plays already exist for this user
    const existingPlays = await playsCollection
      .find({ username, year: 2025 })
      .toArray();

    if (existingPlays.length > 0 && refetch !== "true") {
      console.log(
        `Found ${existingPlays.length} existing plays for ${username}, skipping fetch`
      );
      return res.json({
        username,
        year: 2025,
        totalPlays: existingPlays.length,
        plays: existingPlays,
        cached: true,
      });
    }

    console.log(`Fetching plays from BGG for ${username}`);
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

// Analytics: Get user's most played games in 2025 with mechanics, categories, and publishers
app.get("/api/analytics/:username/most-played", async (req, res) => {
  try {
    const { username } = req.params;

    // Get most played games
    const mostPlayed = await playsCollection
      .aggregate([
        { $match: { username, year: 2025 } },
        {
          $group: {
            _id: "$item.objectid",
            gameName: { $first: "$item.name" },
            playCount: { $sum: { $toInt: "$quantity" } },
          },
        },
        { $sort: { playCount: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Get game IDs from most played
    const gameIds = mostPlayed.map((game) => parseInt(game._id));

    // Fetch full game details to get mechanics, categories, and publishers
    const gameDetails = await gamesCollection
      .find({ id: { $in: gameIds } })
      .toArray();

    // Create a map for quick lookup
    const gameDetailsMap = {};
    gameDetails.forEach((game) => {
      gameDetailsMap[game.id] = game;
    });

    // Enhance most played with full details
    const enhancedMostPlayed = mostPlayed.map((game) => {
      const details = gameDetailsMap[parseInt(game._id)];
      return {
        gameId: game._id,
        gameName: game.gameName,
        playCount: game.playCount,
        thumbnail:
          details?.thumbnail || "https://placehold.co/388x256?text=No+Image",
        mechanics: details?.mechanics || [],
        categories: details?.categories || [],
        publisher: details?.publisher || [],
      };
    });

    // Calculate most popular mechanics
    const mechanicsCount = {};
    gameDetails.forEach((game) => {
      game.mechanics?.forEach((mechanic) => {
        mechanicsCount[mechanic] = (mechanicsCount[mechanic] || 0) + 1;
      });
    });
    const topMechanics = Object.entries(mechanicsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([mechanic, count]) => ({ mechanic, count }));

    // Calculate most popular categories (themes)
    const categoriesCount = {};
    gameDetails.forEach((game) => {
      game.categories?.forEach((category) => {
        categoriesCount[category] = (categoriesCount[category] || 0) + 1;
      });
    });
    const topCategories = Object.entries(categoriesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, count]) => ({ category, count }));

    // Calculate most popular publishers (using primary/first publisher only)
    const publishersCount = {};
    gameDetails.forEach((game) => {
      // Only count the first/primary publisher to avoid confusion
      const primaryPublisher = game.publisher?.[0];
      if (primaryPublisher) {
        publishersCount[primaryPublisher] =
          (publishersCount[primaryPublisher] || 0) + 1;
      }
    });
    const topPublishers = Object.entries(publishersCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([publisher, count]) => ({ publisher, count }));

    res.json({
      username,
      mostPlayed: enhancedMostPlayed,
      topMechanics,
      topCategories,
      topPublishers,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch analytics", message: error.message });
  }
});

// Analytics: Get user's stats summary
app.get("/api/analytics/:username/stats", async (req, res) => {
  try {
    const { username } = req.params;

    const plays = await playsCollection
      .find({ username, year: 2025 })
      .toArray();

    const totalPlays = plays.reduce(
      (sum, play) => sum + parseInt(play.quantity),
      0
    );
    const uniqueGames = new Set(plays.map((play) => play.item.objectid)).size;

    // Plays by month
    const playsByMonth = plays.reduce((acc, play) => {
      const month = play.date.substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + parseInt(play.quantity);
      return acc;
    }, {});

    // Get unique game IDs from plays
    const gameIds = [
      ...new Set(plays.map((play) => parseInt(play.item.objectid))),
    ];

    // Fetch game details to get publication years
    const gameDetails = await gamesCollection
      .find({ id: { $in: gameIds } })
      .toArray();

    // Count publication years
    const yearCounts = {};
    gameDetails.forEach((game) => {
      const year = game.yearPublished;
      if (year && year !== "N/A") {
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      }
    });

    // Find most common year
    let mostCommonYear = null;
    let maxCount = 0;
    Object.entries(yearCounts).forEach(([year, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonYear = year;
      }
    });

    // Calculate "board gamer age" (2025 - most common year)
    const boardGamerAge = mostCommonYear
      ? 2025 - parseInt(mostCommonYear)
      : null;

    res.json({
      username,
      year: 2025,
      totalPlays,
      uniqueGames,
      playsByMonth,
      mostCommonYear,
      boardGamerAge,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch stats", message: error.message });
  }
});

// Analytics: Get popular games across all users
app.get("/api/analytics/popular-games", async (req, res) => {
  try {
    const popularGames = await playsCollection
      .aggregate([
        { $match: { year: 2025 } },
        {
          $group: {
            _id: "$item.objectid",
            gameName: { $first: "$item.name" },
            playCount: { $sum: { $toInt: "$quantity" } },
            uniquePlayers: { $addToSet: "$username" },
          },
        },
        {
          $project: {
            gameName: 1,
            playCount: 1,
            playerCount: { $size: "$uniquePlayers" },
          },
        },
        { $sort: { playCount: -1 } },
        { $limit: 20 },
      ])
      .toArray();

    res.json({ popularGames });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch popular games", message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
