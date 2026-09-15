import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const DEFAULT_STORE = {
  channelId: null,
  feeds: [],
  routes: [],
  seenDeals: [],
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2));
}

export function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
}

export function writeStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

const MAX_SEEN_DEALS = 1000;

export function isDealSeen(dealId) {
  const store = readStore();
  return store.seenDeals.includes(dealId);
}

export function markDealSeen(dealId) {
  const store = readStore();
  store.seenDeals.push(dealId);
  if (store.seenDeals.length > MAX_SEEN_DEALS) {
    store.seenDeals = store.seenDeals.slice(-MAX_SEEN_DEALS);
  }
  writeStore(store);
}
