import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function removeDuplicates() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("bgg");
    const gamesCollection = db.collection("games");

    console.log("\n=== Step 1: Drop unique index temporarily ===");
    try {
      await gamesCollection.dropIndex("id_1");
      console.log("✓ Dropped existing unique index to perform cleanup\n");
    } catch (error) {
      console.log("No existing unique index found (this is fine)\n");
    }

    console.log("=== Step 2: Normalize all string IDs to integers ===");
    const stringIds = await gamesCollection
      .find({ id: { $type: "string" } })
      .toArray();
    console.log(`Found ${stringIds.length} documents with string IDs`);

    let converted = 0;
    for (const doc of stringIds) {
      const numericId = parseInt(doc.id, 10);
      if (!isNaN(numericId) && doc.id !== "N/A") {
        await gamesCollection.updateOne(
          { _id: doc._id },
          { $set: { id: numericId } }
        );
        converted++;
        if (converted % 100 === 0) {
          console.log(`  Converted ${converted} IDs...`);
        }
      }
    }
    console.log(`✓ Converted ${converted} string IDs to integers\n`);

    console.log("=== Step 3: Find and remove duplicate game IDs ===");
    // Find all duplicate game IDs using aggregation with allowDiskUse
    const duplicates = await gamesCollection
      .aggregate(
        [
          {
            $group: {
              _id: "$id",
              count: { $sum: 1 },
              docs: { $push: "$$ROOT" },
            },
          },
          { $match: { count: { $gt: 1 } } },
        ],
        { allowDiskUse: true }
      )
      .toArray();

    console.log(`\nFound ${duplicates.length} sets of duplicate game IDs`);

    if (duplicates.length === 0) {
      console.log("No duplicates found!");
    } else {
      let removed = 0;

      for (const duplicate of duplicates) {
        // Sort by MongoDB ObjectId (which contains timestamp) to keep the oldest
        const sortedDocs = duplicate.docs.sort((a, b) =>
          a._id.toString().localeCompare(b._id.toString())
        );

        // Keep the first (oldest) document, remove all others
        const docsToRemove = sortedDocs.slice(1).map((doc) => doc._id);

        if (docsToRemove.length > 0) {
          const result = await gamesCollection.deleteMany({
            _id: { $in: docsToRemove },
          });

          removed += result.deletedCount;
          console.log(
            `Game ID ${duplicate._id} "${sortedDocs[0].name}": Removed ${result.deletedCount} duplicate(s)`
          );
        }
      }

      console.log(`✓ Total duplicates removed: ${removed}\n`);
    }

    console.log("=== Step 4: Create unique index ===");
    // Create a unique index on the id field to prevent future duplicates
    try {
      await gamesCollection.createIndex({ id: 1 }, { unique: true });
      console.log("\n✓ Created unique index on games.id field");
    } catch (error) {
      if (error.code === 85) {
        console.log("\n✓ Unique index already exists on games.id field");
      } else {
        console.error("\n❌ Error creating unique index:", error.message);
        console.error("This might mean duplicates still exist!");
      }
    }

    console.log("\n=== Step 5: Final verification ===");
    // Verify no duplicates remain
    const remainingDuplicates = await gamesCollection
      .aggregate([
        { $group: { _id: "$id", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    // Final count
    const totalGames = await gamesCollection.countDocuments();
    console.log(`\nTotal games in collection: ${totalGames}`);

    if (remainingDuplicates.length === 0) {
      console.log("✓ Verification passed: No duplicates remain");
    } else {
      console.log(
        `\n⚠ WARNING: ${remainingDuplicates.length} duplicate sets still found!`
      );
      console.log("Sample duplicates:");
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

removeDuplicates();
