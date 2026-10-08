import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function deepCheck() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("bgg");
    const gamesCollection = db.collection("games");

    // Check one of the duplicate names more carefully
    console.log("\n=== Checking 'Capybaras vs Pelicans' ===");
    const capybaras = await gamesCollection
      .find({ name: "Capybaras vs Pelicans" })
      .toArray();

    console.log(`Found ${capybaras.length} documents with this name`);
    capybaras.forEach((doc, idx) => {
      console.log(`\nDocument ${idx + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  id: ${doc.id}`);
      console.log(`  name: ${doc.name}`);
      console.log(`  Full doc keys:`, Object.keys(doc));
    });

    // Check if there are any documents with null/undefined id
    console.log("\n=== Checking for null/undefined IDs ===");
    const nullIds = await gamesCollection
      .find({
        $or: [{ id: null }, { id: { $exists: false } }],
      })
      .limit(5)
      .toArray();
    console.log(`Documents with null/undefined id: ${nullIds.length}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

deepCheck();
