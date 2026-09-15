import { supabase } from "./database/supabase.js";

export async function getChannelId() {
  const { data } = await supabase.from("bot_settings").select("channel_id").eq("id", 1).maybeSingle();
  return data?.channel_id ?? null;
}

export async function setChannelId(channelId) {
  await supabase.from("bot_settings").update({ channel_id: String(channelId) }).eq("id", 1);
}

export async function listFeeds() {
  const { data } = await supabase.from("feeds").select("url").order("created_at", { ascending: true });
  return (data || []).map((f) => f.url);
}

export async function addFeed(url) {
  const { error } = await supabase.from("feeds").insert({ url });
  return !error;
}

export async function removeFeed(url) {
  const { data } = await supabase.from("feeds").delete().eq("url", url).select("url");
  return (data || []).length > 0;
}

export async function listRoutes() {
  const { data } = await supabase.from("routes").select("*").order("created_at", { ascending: true });
  return (data || []).map((r) => ({
    id: r.id,
    from: r.origin,
    to: r.destination,
    maxPrice: r.max_price,
    currency: r.currency,
  }));
}

export async function addRoute(route) {
  await supabase.from("routes").insert({
    id: route.id,
    origin: route.from,
    destination: route.to,
    max_price: route.maxPrice,
    currency: route.currency,
  });
}

export async function removeRoute(id) {
  const { data } = await supabase.from("routes").delete().eq("id", id).select("id");
  return (data || []).length > 0;
}

export async function isDealSeen(dealId) {
  const { data } = await supabase.from("seen_deals").select("id").eq("id", dealId).maybeSingle();
  return !!data;
}

export async function markDealSeen(dealId) {
  await supabase.from("seen_deals").upsert({ id: dealId }, { onConflict: "id", ignoreDuplicates: true });
}
