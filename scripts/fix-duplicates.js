import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function fixDuplicates() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("bgg");
    const gamesCollection = db.collection("games");

    // First, drop the unique index if it exists (it might be preventing deletion)
    try {
      await gamesCollection.dropIndex("id_1");
      console.log("Dropped existing unique index");
    } catch (error) {
      console.log("No existing unique index to drop");
    }

    // Find all duplicate game IDs with full details
    const duplicates = await gamesCollection
      .aggregate([
        {
          $group: { _id: "$id", count: { $sum: 1 }, docs: { $push: "$$ROOT" } },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    console.log(`\nFound ${duplicates.length} sets of duplicate game IDs`);

    if (duplicates.length > 0) {
      let removed = 0;

      for (const duplicate of duplicates) {
        // Sort by _id (MongoDB ObjectId contains timestamp) to keep the oldest
        const sortedDocs = duplicate.docs.sort((a, b) =>
          a._id.toString().localeCompare(b._id.toString())
        );

        // Keep the first document, remove all others
        const docsToRemove = sortedDocs.slice(1).map((doc) => doc._id);

        if (docsToRemove.length > 0) {
          const result = await gamesCollection.deleteMany({
            _id: { $in: docsToRemove },
          });

          removed += result.deletedCount;
          console.log(
            `Game ID ${duplicate._id} (${sortedDocs[0].name}): Removed ${result.deletedCount} duplicate(s)`
          );
        }
      }

      console.log(`\n✓ Total duplicates removed: ${removed}`);
    }

    // Recreate the unique index
    try {
      await gamesCollection.createIndex({ id: 1 }, { unique: true });
      console.log("✓ Created unique index on games.id field");
    } catch (error) {
      console.error("Error creating unique index:", error.message);
    }

    // Final verification
    const finalCount = await gamesCollection.countDocuments();
    console.log(`\n✓ Final game count: ${finalCount}`);

    const remainingDuplicates = await gamesCollection
      .aggregate([
        { $group: { _id: "$id", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (remainingDuplicates.length === 0) {
      console.log("✓ Verification passed: No duplicates remain");
    } else {
      console.log(
        `⚠ Warning: ${remainingDuplicates.length} duplicates still found`
      );
      remainingDuplicates.slice(0, 5).forEach((dup) => {
        console.log(`  - Game ID ${dup._id}: ${dup.count} copies`);
      });
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
    console.log("\nMongoDB connection closed");
  }
}

fixDuplicates();
