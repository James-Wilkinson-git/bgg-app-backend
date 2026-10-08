/**
 * Find games in MongoDB whose thumbnail is missing or a placeholder, fetch
 * xmlapi2/thing from BGG, and update the document when BGG returns real art.
 *
 * Uses the same "real thumbnail" rules as lib/gameThumbnail.js (placeholders,
 * BGG no-image pic, non-URLs, etc.).
 *
 * Usage:
 *   node scripts/backfill-missing-thumbnails.js
 *   node scripts/backfill-missing-thumbnails.js --dry-run
 *   node scripts/backfill-missing-thumbnails.js --limit=50
 *
 * Env: MONGODB_URI, BGG_API_KEY (from .env via dotenv)
 */

import axios from "axios";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { parseStringPromise } from "xml2js";
import { hasRealGameThumbnail } from "../lib/gameThumbnail.js";

dotenv.config();

const BATCH_SIZE = 20;
const DELAY_MS_BETWEEN_BATCHES = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  let dryRun = false;
  let limit = null;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    const m = /^--limit=(\d+)$/.exec(a);
    if (m) limit = parseInt(m[1], 10);
  }
  return { dryRun, limit };
}

function normalizeItems(itemNode) {
  if (!itemNode) return [];
  return Array.isArray(itemNode) ? itemNode : [itemNode];
}

function thumbnailFromThing(game) {
  const raw = game.thumbnail?.[0];
  return typeof raw === "string" ? raw.trim() : "";
}

async function fetchThingBatch(ids) {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(",")}`;
  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.BGG_API_KEY}`,
      },
      validateStatus: () => true,
      responseType: "text",
    });

    const body = typeof res.data === "string" ? res.data : String(res.data ?? "");

    if (res.status === 200 && body.includes("<items")) {
      return parseStringPromise(body);
    }

    if (res.status === 202 || res.status === 429) {
      const wait = Math.min(30_000, 2000 * (attempt + 1));
      console.warn(
        `BGG thing HTTP ${res.status} for ids=[${ids.join(",")}]; retry in ${wait}ms`
      );
      await sleep(wait);
      continue;
    }

    throw new Error(`BGG thing HTTP ${res.status} for ids=[${ids.join(",")}]`);
  }

  throw new Error(`BGG thing: exhausted retries for ids=[${ids.join(",")}]`);
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!process.env.BGG_API_KEY) {
    console.error("Missing BGG_API_KEY");
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const games = client.db("bgg").collection("games");

  const missing = [];
  const cursor = games.find(
    {},
    { projection: { id: 1, thumbnail: 1, name: 1, _id: 0 } }
  );

  for await (const doc of cursor) {
    if (typeof doc.id !== "number" || Number.isNaN(doc.id)) continue;
    if (!hasRealGameThumbnail(doc.thumbnail)) {
      missing.push({ id: doc.id, name: doc.name, thumbnail: doc.thumbnail });
    }
  }

  const toProcess =
    limit != null && limit > 0 ? missing.slice(0, limit) : missing;

  console.log(
    `Games missing a real thumbnail: ${missing.length}` +
      (limit != null ? ` (processing first ${toProcess.length})` : "")
  );

  let updated = 0;
  let skippedNoNewThumb = 0;
  let errors = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const ids = batch.map((g) => g.id);

    let gameResult;
    try {
      gameResult = await fetchThingBatch(ids);
    } catch (e) {
      console.error(e.message || e);
      errors += batch.length;
      continue;
    }

    const items = normalizeItems(gameResult?.items?.item);

    for (const game of items) {
      const id = parseInt(game?.$?.id, 10);
      if (Number.isNaN(id)) continue;

      const newThumb = thumbnailFromThing(game);
      if (!hasRealGameThumbnail(newThumb)) {
        skippedNoNewThumb++;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] would set id=${id} thumbnail=${newThumb}`);
        updated++;
        continue;
      }

      const r = await games.updateOne({ id }, { $set: { thumbnail: newThumb } });
      if (r.matchedCount === 0) {
        console.warn(`No DB row matched id=${id} (BGG returned it in batch)`);
      } else {
        updated++;
        const preview =
          newThumb.length > 80 ? `${newThumb.slice(0, 80)}…` : newThumb;
        console.log(`Updated id=${id} (${preview})`);
      }
    }

    if (i + BATCH_SIZE < toProcess.length) {
      await sleep(DELAY_MS_BETWEEN_BATCHES);
    }
  }

  const action = dryRun ? "wouldUpdate" : "updated";
  console.log(
    `Done. ${action}=${updated} skippedStillNoThumb=${skippedNoNewThumb} batchErrors=${errors}`
  );

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
