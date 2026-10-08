import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function checkDuplicates() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("bgg");
    const gamesCollection = db.collection("games");

    // Check for duplicates by ID
    console.log("\n=== Checking for duplicate IDs ===");
    const duplicateIds = await gamesCollection
      .aggregate([
        { $group: { _id: "$id", count: { $sum: 1 }, docs: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();
    console.log(`Duplicate IDs: ${duplicateIds.length}`);

    // Check for duplicates by name
    console.log("\n=== Checking for duplicate names ===");
    const duplicateNames = await gamesCollection
      .aggregate([
        { $group: { _id: "$name", count: { $sum: 1 }, ids: { $push: "$id" } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 10 },
      ])
      .toArray();
    console.log(`Duplicate names: ${duplicateNames.length}`);
    if (duplicateNames.length > 0) {
      console.log("Sample duplicate names:");
      duplicateNames.forEach((dup) => {
        console.log(
          `  "${dup._id}" (${dup.count} times) - IDs: ${dup.ids.join(", ")}`
        );
      });
    }

    // Check for games with same name but different IDs
    console.log("\n=== Checking for similar entries ===");
    const totalGames = await gamesCollection.countDocuments();
    console.log(`Total games in collection: ${totalGames}`);

    // Sample a few records
    console.log("\n=== Sample records ===");
    const samples = await gamesCollection.find().limit(5).toArray();
    samples.forEach((game) => {
      console.log(`ID: ${game.id}, Name: ${game.name}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

checkDuplicates();
