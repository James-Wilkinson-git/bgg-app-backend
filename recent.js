import axios from "axios";
import { parseStringPromise } from "xml2js";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Configure MongoDB client
const mongoClient = new MongoClient(process.env.MONGODB_URI);

await mongoClient.connect();
const db = mongoClient.db("bgg");
const gamesCollection = db.collection("games");
const recentGamesCollection = db.collection("recentgames");

// Function to check if there's a "Next" button on the page
const hasNextPage = (html) => {
  return html.includes('title="next page"') || html.includes("Next &raquo;");
};

// Collect all board game IDs from all pages
let allBoardGameIds = [];
let currentPage = 1;
let hasMore = true;

while (hasMore) {
  console.log(`Scraping page ${currentPage}...`);

  const response = await axios.get(
    `https://boardgamegeek.com/recentadditions/page/${currentPage}?subdomain=&infilters%5B0%5D=thing&domain=boardgame`
  );

  // Extract board game IDs from the HTML response
  const pageGameIds = [];
  const regex = /href="\/boardgame\/(\d+)\//g;
  let match;

  while ((match = regex.exec(response.data)) !== null) {
    pageGameIds.push(parseInt(match[1]));
  }

  console.log(`Found ${pageGameIds.length} games on page ${currentPage}`);
  allBoardGameIds = allBoardGameIds.concat(pageGameIds);

  // Check if there's a next page
  hasMore = hasNextPage(response.data);

  if (hasMore) {
    currentPage++;
    console.log("Found 'Next' button, continuing to next page...");
    console.log("Waiting 1 second before next page...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } else {
    console.log("No 'Next' button found, reached last page.");
  }
}

console.log(`Scraped ${currentPage} pages total`);

// Remove duplicates
const boardGameIds = [...new Set(allBoardGameIds)];

console.log("Board Game IDs:", boardGameIds);
console.log("Total unique games found:", boardGameIds.length);

// Check MongoDB for existing game IDs in recent games collection
const existingRecentGames = await recentGamesCollection
  .find({ id: { $in: boardGameIds } })
  .toArray();
const existingRecentGameIds = existingRecentGames.map((game) => game.id);
const newRecentGameIds = boardGameIds.filter(
  (id) => !existingRecentGameIds.includes(id)
);

console.log(
  `Identified ${newRecentGameIds.length} new recent game IDs to save`
);

// Save new game IDs to recent games collection
if (newRecentGameIds.length > 0) {
  console.log(
    `Saving ${newRecentGameIds.length} new recent game IDs to MongoDB`
  );
  await recentGamesCollection.insertMany(
    newRecentGameIds.map((id) => ({
      id,
      dateAdded: new Date(),
    }))
  );

  // Output links for new games
  console.log("\n--- NEW GAME LINKS ---");
  newRecentGameIds.forEach((id) => {
    console.log(`https://boardgamegeek.com/boardgame/${id}`);
  });
  console.log("--- END NEW GAME LINKS ---\n");
} else {
  console.log("No new games found.");
}

console.log(
  `Finished processing. Found ${newRecentGameIds.length} new games out of ${boardGameIds.length} total games.`
);

// Close MongoDB connection
await mongoClient.close();
