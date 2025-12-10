import express from "express";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import axios from "axios";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Configure MongoDB client - reuse the same instance
const mongoClient = new MongoClient(process.env.MONGODB_URI, {
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
});

// In-memory cache for analytics
const analyticsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(endpoint, username) {
  return `${endpoint}:${username}`;
}

function getFromCache(key) {
  const cached = analyticsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCache(key, data) {
  analyticsCache.set(key, { data, timestamp: Date.now() });
  // Clear old cache entries periodically
  if (analyticsCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of analyticsCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        analyticsCache.delete(k);
      }
    }
  }
}

// Connect to MongoDB
let db, gamesCollection, gameIds2025, playsCollection;

try {
  await mongoClient.connect();
  console.log("Connected to MongoDB");
  db = mongoClient.db("bgg");
  gamesCollection = db.collection("games");
  gameIds2025 = db.collection("2025games");
  playsCollection = db.collection("plays");
} catch (error) {
  console.error("Failed to connect to MongoDB:", error);
  process.exit(1);
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Closing MongoDB connection...");
  await mongoClient.close();
  process.exit(0);
});

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

    // Function to fetch game details with a delay
    const fetchGameDetailsWithDelay = async (ids) => {
      const gameDetailsUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(
        ","
      )}`;
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
      const gameResult = await fetchGameDetailsWithDelay(batchIds);
      const gamesToInsert = (gameResult.items.item || []).map((game) => ({
        id: parseInt(game.$?.id) || 0,
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
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    let page = 1;
    while (true) {
      const url = `https://boardgamegeek.com/search/boardgame/page/${page}?advsearch=1&q=&include%5Bdesignerid%5D=&include%5Bpublisherid%5D=&geekitemname=&range%5Byearpublished%5D%5Bmin%5D=2025&range%5Byearpublished%5D%5Bmax%5D=2030&range%5Bminage%5D%5Bmax%5D=&range%5Bnumvoters%5D%5Bmin%5D=&range%5Bnumweights%5D%5Bmin%5D=&range%5Bminplayers%5D%5Bmax%5D=&range%5Bmaxplayers%5D%5Bmin%5D=&range%5Bleastplaytime%5D%5Bmin%5D=&range%5Bplaytime%5D%5Bmax%5D=&floatrange%5Bavgrating%5D%5Bmin%5D=&floatrange%5Bavgrating%5D%5Bmax%5D=&floatrange%5Bavgweight%5D%5Bmin%5D=&floatrange%5Bavgweight%5D%5Bmax%5D=&colfiltertype=&searchuser=&nosubtypes%5B0%5D=boardgameexpansion&playerrangetype=normal&B1=Submit`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${process.env.BGG_API_KEY}`,
        },
      });
      const gameEntries = response.data;
      if (gameEntries.items.length === 0) {
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
    const username = req.params.username.trim().toLowerCase();
    const { refetch } = req.query;

    console.log(
      `[BGG WRAPPED] Fetching plays for user: ${username} (refetch=${
        refetch === "true"
      })`
    );

    // Check if plays already exist for this user (check all plays, not filtered)
    const existingPlays = await playsCollection
      .find({ username, year: 2025 })
      .toArray();

    if (existingPlays.length > 0 && refetch !== "true") {
      console.log(
        `[BGG WRAPPED] Returning cached plays for user: ${username} (total: ${existingPlays.length})`
      );
      return res.json({
        username,
        year: 2025,
        totalPlays: existingPlays.length,
        plays: existingPlays,
        cached: true,
      });
    }

    const allPlays = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const url = `https://boardgamegeek.com/xmlapi2/plays?username=${username}&mindate=2025-01-01&maxdate=2025-12-31&page=${page}`;
      console.log(
        `[BGG WRAPPED] Requesting BGG API for user: ${username}, page: ${page}`
      );

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${process.env.BGG_API_KEY}`,
        },
      });
      const playsData = await parseStringPromise(response.data);

      // Check if we have plays in the response
      if (playsData.plays && playsData.plays.play) {
        const plays = playsData.plays.play;

        // Parse and format the plays
        const formattedPlays = plays.map((play) => ({
          id: play.$.id,
          date: play.$.date,
          quantity: play.$.quantity,
          length: play.$.length,
          incomplete: play.$.incomplete === "1",
          nowinstats: play.$.nowinstats === "1",
          location: play.$.location || "",
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
      `[BGG WRAPPED] Finished fetching plays for user: ${username}. Total plays: ${allPlays.length}`
    );

    // Save ALL plays to MongoDB (no filtering at save time)
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

      // Extract unique game IDs from plays (before filtering)
      const gameIds = [
        ...new Set(allPlays.map((play) => parseInt(play.item.objectid))),
      ];

      // Check which games already exist in the database
      const existingGames = await gamesCollection
        .find({ id: { $in: gameIds } })
        .toArray();
      const existingGameIds = existingGames.map((game) => game.id);
      const newGameIds = gameIds.filter((id) => !existingGameIds.includes(id));

      // Fetch game details in batches of 20
      const fetchGameDetailsWithDelay = async (ids) => {
        const gameDetailsUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(
          ","
        )}`;
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
          newGames.push(game);
        }

        if (i + 20 < newGameIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 5500));
        }
      }
    }

    // Retrieve plays from database
    const finalPlays = await playsCollection
      .find({ username, year: 2025 })
      .toArray();

    res.json({
      username,
      year: 2025,
      totalPlays: finalPlays.length,
      plays: finalPlays,
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
    const username = req.params.username.trim().toLowerCase();
    const cacheKey = getCacheKey("most-played", username);

    // Check cache first
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Build match criteria
    const matchCriteria = { username, year: 2025 };

    // Get most played games (top 10 for display)
    const mostPlayed = await playsCollection
      .aggregate([
        { $match: matchCriteria },
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

    // Get ALL played games for statistics (not just top 10)
    const allPlayedGames = await playsCollection
      .aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: "$item.objectid",
            gameName: { $first: "$item.name" },
            playCount: { $sum: { $toInt: "$quantity" } },
          },
        },
        { $sort: { playCount: -1 } },
      ])
      .toArray();

    // Get game IDs from most played for display
    const gameIds = mostPlayed.map((game) => parseInt(game._id));

    // Get ALL game IDs for statistics
    const allGameIds = allPlayedGames.map((game) => parseInt(game._id));

    // Fetch full game details with projection to reduce data transfer
    const gameDetails = await gamesCollection
      .find(
        { id: { $in: gameIds } },
        {
          projection: {
            id: 1,
            thumbnail: 1,
            mechanics: 1,
            categories: 1,
            publisher: 1,
            designer: 1,
            artist: 1,
          },
        }
      )
      .toArray();

    // Fetch ALL game details for statistics
    const allGameDetails = await gamesCollection
      .find(
        { id: { $in: allGameIds } },
        {
          projection: {
            id: 1,
            mechanics: 1,
            categories: 1,
            publisher: 1,
            designer: 1,
            artist: 1,
          },
        }
      )
      .toArray();

    // Create a map for quick lookup
    const gameDetailsMap = {};
    gameDetails.forEach((game) => {
      gameDetailsMap[game.id] = game;
    });

    // Create a map for ALL game details
    const allGameDetailsMap = {};
    allPlayedGames.forEach((game) => {
      const details = allGameDetails.find((g) => g.id === parseInt(game._id));
      if (details) {
        allGameDetailsMap[game._id] = {
          ...details,
          playCount: game.playCount,
        };
      }
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

    // Calculate most popular mechanics (weighted by play count across ALL games)
    const mechanicsCount = {};
    Object.values(allGameDetailsMap).forEach((game) => {
      game.mechanics?.forEach((mechanic) => {
        mechanicsCount[mechanic] =
          (mechanicsCount[mechanic] || 0) + game.playCount;
      });
    });
    const topMechanics = Object.entries(mechanicsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([mechanic, count]) => ({ mechanic, count }));

    // Calculate most popular categories (themes) (weighted by play count across ALL games)
    const categoriesCount = {};
    Object.values(allGameDetailsMap).forEach((game) => {
      game.categories?.forEach((category) => {
        categoriesCount[category] =
          (categoriesCount[category] || 0) + game.playCount;
      });
    });
    const topCategories = Object.entries(categoriesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, count]) => ({ category, count }));

    // Calculate most popular publishers (using primary/first publisher only) (weighted by play count across ALL games)
    const publishersCount = {};
    Object.values(allGameDetailsMap).forEach((game) => {
      // Only count the first/primary publisher to avoid confusion
      const primaryPublisher = game.publisher?.[0];
      if (primaryPublisher) {
        publishersCount[primaryPublisher] =
          (publishersCount[primaryPublisher] || 0) + game.playCount;
      }
    });
    const topPublishers = Object.entries(publishersCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([publisher, count]) => ({ publisher, count }));

    // Calculate most popular designers (using all designers) (weighted by play count across ALL games)
    const designersCount = {};
    Object.values(allGameDetailsMap).forEach((game) => {
      // Count all designers
      game.designer?.forEach((designer) => {
        if (designer && designer !== "(Uncredited)") {
          designersCount[designer] =
            (designersCount[designer] || 0) + game.playCount;
        }
      });
    });
    const topDesigners = Object.entries(designersCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([designer, count]) => ({ designer, count }));

    // Calculate most popular artists (using all artists) (weighted by play count across ALL games)
    const artistsCount = {};
    Object.values(allGameDetailsMap).forEach((game) => {
      // Count all artists
      game.artist?.forEach((artist) => {
        if (artist && artist !== "(Uncredited)") {
          artistsCount[artist] = (artistsCount[artist] || 0) + game.playCount;
        }
      });
    });
    const topArtists = Object.entries(artistsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([artist, count]) => ({ artist, count }));

    const result = {
      username,
      mostPlayed: enhancedMostPlayed,
      topMechanics,
      topCategories,
      topPublishers,
      topDesigners,
      topArtists,
    };

    // Cache the result
    setCache(cacheKey, result);

    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch analytics", message: error.message });
  }
});

// Analytics: Get user's stats summary
app.get("/api/analytics/:username/stats", async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase();
    const cacheKey = getCacheKey("stats", username);

    // Check cache first
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

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

    // Get game IDs with play counts
    const gamePlayCounts = {};
    plays.forEach((play) => {
      const gameId = parseInt(play.item.objectid);
      gamePlayCounts[gameId] =
        (gamePlayCounts[gameId] || 0) + parseInt(play.quantity);
    });

    const gameIds = Object.keys(gamePlayCounts).map((id) => parseInt(id));

    // Fetch game details with projection - only need yearPublished
    const gameDetails = await gamesCollection
      .find(
        { id: { $in: gameIds } },
        { projection: { id: 1, yearPublished: 1 } }
      )
      .toArray();

    // Count publication years weighted by play count
    const yearCounts = {};
    gameDetails.forEach((game) => {
      const yearStr = String(game.yearPublished);
      const yearNum = parseInt(yearStr);
      if (
        yearStr &&
        yearStr !== "N/A" &&
        !isNaN(yearNum) &&
        yearNum > 1900 &&
        yearNum <= 2025
      ) {
        const playCount = gamePlayCounts[game.id] || 1;
        yearCounts[yearNum] = (yearCounts[yearNum] || 0) + playCount;
      }
    });

    // Calculate average game age (weighted by play count)
    let totalWeightedAge = 0;
    let totalPlaysWithYear = 0;

    Object.entries(yearCounts).forEach(([year, count]) => {
      const age = 2025 - parseInt(year);
      totalWeightedAge += age * count;
      totalPlaysWithYear += count;
    });

    const averageGameAge =
      totalPlaysWithYear > 0
        ? Math.round(totalWeightedAge / totalPlaysWithYear)
        : null;

    // Also find most common year for additional context
    let mostCommonYear = null;
    let maxCount = 0;
    Object.entries(yearCounts).forEach(([year, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonYear = parseInt(year);
      }
    });

    const result = {
      username,
      year: 2025,
      totalPlays,
      uniqueGames,
      playsByMonth,
      averageGameAge,
      mostCommonYear,
    };

    // Cache the result
    setCache(cacheKey, result);

    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch stats", message: error.message });
  }
});

// Analytics: Get popular games across all users
app.get("/api/analytics/popular-games", async (req, res) => {
  try {
    const cacheKey = "popular-games:all";

    // Check cache first (shorter TTL for community data - 1 minute)
    const cached = analyticsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60 * 1000) {
      return res.json(cached.data);
    }

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
        { $sort: { playerCount: -1, playCount: -1 } },
        { $limit: 20 },
      ])
      .toArray();

    // Fetch game details for thumbnails with projection
    const gameIds = popularGames.map((g) => parseInt(g._id));

    const gameDetails = await gamesCollection
      .find({ id: { $in: gameIds } }, { projection: { id: 1, thumbnail: 1 } })
      .toArray();

    // Create a lookup map for faster merging
    const thumbnailMap = {};
    gameDetails.forEach((game) => {
      thumbnailMap[game.id] = game.thumbnail;
    });

    // Merge details
    const gamesWithThumbnails = popularGames.map((game) => {
      const gameId = parseInt(game._id);
      return {
        ...game,
        thumbnail: thumbnailMap[gameId] || null,
      };
    });

    const result = { popularGames: gamesWithThumbnails };

    // Cache the result
    setCache(cacheKey, result);

    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch popular games", message: error.message });
  }
});

// Image proxy endpoint to bypass CORS
app.get("/api/proxy-image", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).send("URL parameter is required");
    }

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    res.set("Content-Type", response.headers["content-type"]);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Access-Control-Allow-Origin", "*");
    res.send(response.data);
  } catch (error) {
    console.error("Failed to proxy image:", error.message);
    res.status(500).send("Failed to fetch image");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
