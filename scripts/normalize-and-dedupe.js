import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function normalizeAndRemoveDuplicates() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("bgg");
    const gamesCollection = db.collection("games");

    console.log("=== Step 1: Drop unique index ===");
    try {
      await gamesCollection.dropIndex("id_1");
      console.log("✓ Dropped unique index");
    } catch (error) {
      console.log("No unique index to drop");
    }

    console.log("\n=== Step 2: Convert all string IDs to integers ===");
    const stringIds = await gamesCollection
      .find({
        id: { $type: "string" },
      })
      .toArray();

    console.log(`Found ${stringIds.length} documents with string IDs`);

    let converted = 0;
    for (const doc of stringIds) {
      const numericId = parseInt(doc.id, 10);
      if (!isNaN(numericId)) {
        await gamesCollection.updateOne(
          { _id: doc._id },
          { $set: { id: numericId } }
        );
        converted++;
      } else {
        console.log(
          `⚠ Warning: Could not convert ID "${doc.id}" for game "${doc.name}"`
        );
      }
    }
    console.log(`✓ Converted ${converted} string IDs to integers`);

    console.log("\n=== Step 3: Find and remove duplicates ===");
    // Now that all IDs are the same type, aggregation will work
    const duplicates = await gamesCollection
      .aggregate([
        {
          $group: { _id: "$id", count: { $sum: 1 }, docs: { $push: "$$ROOT" } },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    console.log(`Found ${duplicates.length} sets of duplicates`);

    let removed = 0;
    for (const duplicate of duplicates) {
      // Sort by _id (MongoDB ObjectId contains timestamp) to keep the oldest
      const sortedDocs = duplicate.docs.sort((a, b) =>
        a._id.toString().localeCompare(b._id.toString())
      );

      // Keep the first document, merge any unique data if needed
      const toKeep = sortedDocs[0];
      const toRemove = sortedDocs.slice(1);

      console.log(`\nGame ID ${duplicate._id} "${toKeep.name}":`);
      console.log(`  Keeping: ${toKeep._id}`);

      for (const doc of toRemove) {
        await gamesCollection.deleteOne({ _id: doc._id });
        console.log(`  Removed: ${doc._id}`);
        removed++;
      }
    }

    console.log(`\n✓ Removed ${removed} duplicate documents`);

    console.log("\n=== Step 4: Create unique index ===");
    await gamesCollection.createIndex({ id: 1 }, { unique: true });
    console.log("✓ Created unique index on id field");

    console.log("\n=== Step 5: Final verification ===");
    const finalCount = await gamesCollection.countDocuments();
    console.log(`Total documents: ${finalCount}`);

    const remainingDuplicates = await gamesCollection
      .aggregate([
        { $group: { _id: "$id", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (remainingDuplicates.length === 0) {
      console.log("✓ No duplicates remain!");
    } else {
      console.log(
        `⚠ WARNING: ${remainingDuplicates.length} duplicates still exist`
      );
    }

    // Check type consistency
    const typeCheck = await gamesCollection
      .aggregate([{ $group: { _id: { $type: "$id" }, count: { $sum: 1 } } }])
      .toArray();

    console.log("\nID type distribution:");
    typeCheck.forEach((type) => {
      console.log(`  ${type._id}: ${type.count} documents`);
    });
  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await client.close();
    console.log("\n✓ MongoDB connection closed");
  }
}

normalizeAndRemoveDuplicates();
