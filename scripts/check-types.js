import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function checkTypes() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("bgg");
    const gamesCollection = db.collection("games");

    // Check the type of id field
    console.log("=== Checking ID field types ===");
    const samples = await gamesCollection
      .aggregate([
        {
          $project: {
            id: 1,
            name: 1,
            idType: { $type: "$id" },
          },
        },
        { $limit: 10 },
      ])
      .toArray();

    console.log("Sample IDs and their types:");
    samples.forEach((doc) => {
      console.log(`  ${doc.id} (${doc.idType}) - ${doc.name}`);
    });

    // Check for mixed types
    console.log("\n=== Checking for mixed ID types ===");
    const typeGroups = await gamesCollection
      .aggregate([
        {
          $group: {
            _id: { $type: "$id" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    console.log("ID types in collection:");
    typeGroups.forEach((group) => {
      console.log(`  ${group._id}: ${group.count} documents`);
    });

    // Specifically check Capybaras
    console.log("\n=== Checking Capybaras vs Pelicans specifically ===");
    const capybaras = await gamesCollection
      .aggregate([
        { $match: { name: "Capybaras vs Pelicans" } },
        {
          $project: {
            _id: 1,
            id: 1,
            idType: { $type: "$id" },
            idString: { $toString: "$id" },
          },
        },
      ])
      .toArray();

    console.log(`Found ${capybaras.length} Capybaras documents:`);
    capybaras.forEach((doc, idx) => {
      console.log(`\nDoc ${idx + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  id: ${doc.id}`);
      console.log(`  idType: ${doc.idType}`);
      console.log(`  id === 445030: ${doc.id === 445030}`);
      console.log(`  id === "445030": ${doc.id === "445030"}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

checkTypes();
