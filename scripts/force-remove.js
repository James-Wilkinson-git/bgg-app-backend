import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function forceRemoveDuplicates() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("bgg");
    const gamesCollection = db.collection("games");

    // Check indexes
    console.log("=== Current Indexes ===");
    const indexes = await gamesCollection.indexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Drop ALL indexes except _id
    console.log("\n=== Dropping indexes ===");
    await gamesCollection.dropIndexes();
    console.log("Dropped all indexes (except _id)");

    // Use a different approach - find duplicates by name, then check their IDs
    console.log("\n=== Finding and removing duplicates ===");

    const allGames = await gamesCollection.find().toArray();
    console.log(`Total documents: ${allGames.length}`);

    // Group by ID
    const idMap = new Map();
    for (const game of allGames) {
      if (!idMap.has(game.id)) {
        idMap.set(game.id, []);
      }
      idMap.get(game.id).push(game);
    }

    let duplicateSets = 0;
    let removed = 0;

    for (const [id, games] of idMap.entries()) {
      if (games.length > 1) {
        duplicateSets++;
        // Keep the first one (oldest by _id), remove the rest
        const toKeep = games.sort((a, b) =>
          a._id.toString().localeCompare(b._id.toString())
        )[0];
        const toRemove = games.slice(1);

        console.log(
          `\nGame ID ${id} "${games[0].name}": Found ${games.length} copies`
        );

        for (const game of toRemove) {
          await gamesCollection.deleteOne({ _id: game._id });
          console.log(`  Removed: ${game._id}`);
          removed++;
        }
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Duplicate sets found: ${duplicateSets}`);
    console.log(`Documents removed: ${removed}`);

    const finalCount = await gamesCollection.countDocuments();
    console.log(`Final document count: ${finalCount}`);

    // Recreate unique index
    console.log("\n=== Creating unique index ===");
    await gamesCollection.createIndex({ id: 1 }, { unique: true });
    console.log("✓ Created unique index on id field");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

forceRemoveDuplicates();
