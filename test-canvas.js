import {
  generateStatsCard,
  generateMostPlayedCard,
  generateMechanicsCard,
  generateCategoriesCard,
  generatePublishersCard,
  generateCommunityCard,
} from "./canvasGenerator.js";
import fs from "fs";
import path from "path";

// Convenience helper so all PNGs land in one spot.
function resolveOutputPath(fileName) {
  const outputDir = path.resolve(process.cwd(), "test-output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  return path.join(outputDir, fileName);
}

const proxy = (url) =>
  `https://bgg-app-backend-1.onrender.com/api/proxy-image?url=${encodeURIComponent(
    url
  )}`;

// Test payload that mirrors the front-end expectations.
const testData = {
  stats: {
    totalPlays: 142,
    uniqueGames: 28,
    averageGameAge: 3,
  },
  mostPlayed: [
    {
      gameName: "Feed the Kraken",
      playCount: 19,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/d9iQcC8KbmS4dB4jiO4nQQ__thumb/img/rg_I0ERlT_1DMiADxY6ifSmRg80=/fit-in/200x150/filters:strip_icc()/pic6488455.jpg"
      ),
    },
    {
      gameName: "Wingspan",
      playCount: 17,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/yLZJCVLlIx4c7eJEWUNJ7w__thumb/img/uIjeoKgHMcRtzRSR4MoUYl3nXxs=/fit-in/200x150/filters:strip_icc()/pic4458123.jpg"
      ),
    },
    {
      gameName: "Ark Nova",
      playCount: 14,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/uk8Ok3UFNfHSEuxsjjXN_Q__thumb/img/z-_9GULgX1f7I0-h2k3kMJVDg1M=/fit-in/200x150/filters:strip_icc()/pic6670131.jpg"
      ),
    },
    {
      gameName: "Heat: Pedal to the Metal",
      playCount: 12,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/8qopqsmV-dX1xxzL9ycYig__thumb/img/KPrbp8peuLMEWKclXxE-U8kPfVQ=/fit-in/200x150/filters:strip_icc()/pic7126637.png"
      ),
    },
    {
      gameName: "Splendor Duel",
      playCount: 11,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/x0-Eb0W2N0AK9Pjn1hlF2A__thumb/img/NmOHs8CtMSqQLJoeGZHRlZ0L8gA=/fit-in/200x150/filters:strip_icc()/pic7192535.jpg"
      ),
    },
  ],
  mechanics: [
    { mechanic: "Hand Management", count: 16 },
    { mechanic: "Set Collection", count: 15 },
    { mechanic: "Variable Player Powers", count: 13 },
    { mechanic: "Simultaneous Action Selection", count: 9 },
    { mechanic: "Area Majority", count: 8 },
    { mechanic: "Tile Placement", count: 7 },
    { mechanic: "Cooperative", count: 6 },
    { mechanic: "Drafting", count: 5 },
  ],
  categories: [
    { category: "Fantasy", count: 12 },
    { category: "Science Fiction", count: 11 },
    { category: "Animals", count: 10 },
    { category: "Economic", count: 8 },
    { category: "Racing", count: 7 },
    { category: "Adventure", count: 6 },
    { category: "Horror", count: 5 },
    { category: "Abstract", count: 4 },
  ],
  publishers: [
    { publisher: "Stonemaier Games", count: 14 },
    { publisher: "Capstone Games", count: 10 },
    { publisher: "Days of Wonder", count: 9 },
    { publisher: "Leder Games", count: 8 },
    { publisher: "Portal Games", count: 6 },
    { publisher: "Fantasy Flight Games", count: 6 },
    { publisher: "Devir", count: 4 },
    { publisher: "Lucky Duck Games", count: 4 },
  ],
  community: [
    {
      gameName: "Dune: Imperium",
      playCount: 212,
      playerCount: 132,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/uQ4Wz-6MwVzkhDxYhSbGbw__thumb/img/_Q3SgSYpuGhe5NQzZBOcp0UKecE=/fit-in/200x150/filters:strip_icc()/pic5666599.jpg"
      ),
    },
    {
      gameName: "Cascadia",
      playCount: 198,
      playerCount: 148,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/51WJpBVCoV9w6g6UNpLYpQ__thumb/img/0BZpWsDqgX1DMfnRLv8mfX_yZLg=/fit-in/200x150/filters:strip_icc()/pic6209957.jpg"
      ),
    },
    {
      gameName: "Earth",
      playCount: 176,
      playerCount: 120,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/BQtSCWV0Hn0pzuZoNsYkdA__thumb/img/HJXzCPsHYCblRoT2hJki0g5pFZQ=/fit-in/200x150/filters:strip_icc()/pic7374337.jpg"
      ),
    },
    {
      gameName: "Ark Nova",
      playCount: 165,
      playerCount: 112,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/uk8Ok3UFNfHSEuxsjjXN_Q__thumb/img/z-_9GULgX1f7I0-h2k3kMJVDg1M=/fit-in/200x150/filters:strip_icc()/pic6670131.jpg"
      ),
    },
    {
      gameName: "Terraforming Mars",
      playCount: 152,
      playerCount: 101,
      thumbnail: proxy(
        "https://cf.geekdo-images.com/Y4WjgeGJNmaKigXgccXztA__thumb/img/3L35kVn66uoSs60NJN0sRYx_AI4=/fit-in/200x150/filters:strip_icc()/pic3536616.jpg"
      ),
    },
  ],
};

async function run() {
  console.log("Generating wrapped preview assets in ./test-output\n");

  const statsBuffer = await generateStatsCard("TestUser", testData.stats);
  fs.writeFileSync(resolveOutputPath("stats-card.png"), statsBuffer);
  console.log("✓ stats-card.png ready");

  const mostPlayedBuffer = await generateMostPlayedCard(
    "TestUser",
    testData.mostPlayed
  );
  fs.writeFileSync(resolveOutputPath("most-played-card.png"), mostPlayedBuffer);
  console.log("✓ most-played-card.png ready");

  const mechanicsBuffer = await generateMechanicsCard(
    "TestUser",
    testData.mechanics
  );
  fs.writeFileSync(resolveOutputPath("mechanics-card.png"), mechanicsBuffer);
  console.log("✓ mechanics-card.png ready");

  const categoriesBuffer = await generateCategoriesCard(
    "TestUser",
    testData.categories
  );
  fs.writeFileSync(resolveOutputPath("categories-card.png"), categoriesBuffer);
  console.log("✓ categories-card.png ready");

  const publishersBuffer = await generatePublishersCard(
    "TestUser",
    testData.publishers
  );
  fs.writeFileSync(resolveOutputPath("publishers-card.png"), publishersBuffer);
  console.log("✓ publishers-card.png ready");

  const communityBuffer = await generateCommunityCard(testData.community);
  fs.writeFileSync(resolveOutputPath("community-card.png"), communityBuffer);
  console.log("✓ community-card.png ready");

  console.log(
    "\nAll done. Open the PNGs in test-output/ to review the 1080x1920 renders."
  );
}

run().catch((error) => {
  console.error("Failed to generate preview cards:", error);
  process.exitCode = 1;
});
