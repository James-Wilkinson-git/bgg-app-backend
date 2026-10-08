import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function migrateGameIds() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("bgg");
    const gamesCollection = db.collection("games");

    // Find all games with string IDs
    const gamesWithStringIds = await gamesCollection
      .find({ id: { $type: "string" } })
      .toArray();

    console.log(`Found ${gamesWithStringIds.length} games with string IDs`);

    if (gamesWithStringIds.length === 0) {
      console.log("No migration needed - all IDs are already integers");
      return;
    }

    let updated = 0;
    let failed = 0;

    for (const game of gamesWithStringIds) {
      const numericId = parseInt(game.id);

      if (isNaN(numericId) || game.id === "N/A") {
        console.log(`Skipping invalid ID: ${game.id} for game: ${game.name}`);
        failed++;
        continue;
      }

      try {
        await gamesCollection.updateOne(
          { _id: game._id },
          { $set: { id: numericId } }
        );
        updated++;

        if (updated % 100 === 0) {
          console.log(`Updated ${updated} games...`);
        }
      } catch (error) {
        console.error(`Failed to update game ${game.id}:`, error.message);
        failed++;
      }
    }

    console.log("\nMigration complete!");
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total processed: ${gamesWithStringIds.length}`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.close();
    console.log("Connection closed");
  }
}

migrateGameIds();
