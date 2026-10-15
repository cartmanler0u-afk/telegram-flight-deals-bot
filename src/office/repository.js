// Persistance des QG : une ligne par utilisateur Telegram dans la table office_state (Supabase).
// Le Bâtiment 0 (THE MADHOUSE, plusieurs centaines de Ko) vit dans sa propre table madhouse_world :
//  - garde monotone : on n'écrase jamais un monde plus avancé (colonne cycle) ;
//  - bail (lease_holder / lease_until) : une seule instance du bot simule un monde donné à la fois.

// Valeur sûre pour les filtres PostgREST (identifiant d'instance, horodatage ISO).
const quoted = (value) => `"${String(value).replace(/["\\]/g, "")}"`;

export function createSupabaseRepository(supabase) {
  const leaseFree = (holder, nowIso) => `lease_holder.is.null,lease_holder.eq.${quoted(holder)},lease_until.lt.${quoted(nowIso)}`;
  return {
    async loadAll() {
      const { data, error } = await supabase.from("office_state").select("owner_id, state");
      if (error) throw new Error(error.message);
      return (data || []).map((row) => ({ ownerId: row.owner_id, state: row.state }));
    },

    async load(ownerId) {
      const { data, error } = await supabase.from("office_state").select("state").eq("owner_id", ownerId).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.state ?? null;
    },

    async save(ownerId, state) {
      const { error } = await supabase
        .from("office_state")
        .upsert({ owner_id: ownerId, state, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
      if (error) throw new Error(error.message);
    },

    async loadWorld(ownerId) {
      const { data, error } = await supabase.from("madhouse_world").select("world, cycle").eq("owner_id", ownerId).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.world ? { world: data.world, cycle: Number(data.cycle) || 0 } : null;
    },

    // Écrit le monde seulement s'il n'est pas en retard sur la base et si le bail est libre ou à nous.
    async saveWorld(ownerId, world, { holder }) {
      const nowIso = new Date().toISOString();
      const cycle = world.cycle || 0;
      const { data, error } = await supabase
        .from("madhouse_world")
        .update({ world, cycle, updated_at: nowIso })
        .eq("owner_id", ownerId)
        .lte("cycle", cycle)
        .or(leaseFree(holder, nowIso))
        .select("owner_id");
      if (error) throw new Error(error.message);
      if (data?.length) return { ok: true };
      const { data: row, error: readError } = await supabase.from("madhouse_world").select("cycle, lease_holder").eq("owner_id", ownerId).maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!row) {
        const { error: insertError } = await supabase.from("madhouse_world").insert({ owner_id: ownerId, world, cycle, updated_at: nowIso });
        if (insertError) return { ok: false, reason: insertError.code === "23505" ? "race" : insertError.message };
        return { ok: true };
      }
      return { ok: false, reason: Number(row.cycle) > cycle ? "stale" : "lease", holder: row.lease_holder };
    },

    async acquireWorldLease(ownerId, holder, ttlMs) {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const { error: seedError } = await supabase
        .from("madhouse_world")
        .upsert({ owner_id: ownerId, cycle: 0 }, { onConflict: "owner_id", ignoreDuplicates: true });
      if (seedError) throw new Error(seedError.message);
      const { data, error } = await supabase
        .from("madhouse_world")
        .update({ lease_holder: holder, lease_until: new Date(now + ttlMs).toISOString() })
        .eq("owner_id", ownerId)
        .or(leaseFree(holder, nowIso))
        .select("owner_id");
      if (error) throw new Error(error.message);
      return (data?.length || 0) > 0;
    },

    async releaseWorldLease(ownerId, holder) {
      const { error } = await supabase
        .from("madhouse_world")
        .update({ lease_until: new Date().toISOString() })
        .eq("owner_id", ownerId)
        .eq("lease_holder", holder);
      if (error) throw new Error(error.message);
    },
  };
}

// Stockage en mémoire (tests, développement local sans base) : mêmes règles que Supabase.
export function createMemoryRepository({ now = () => Date.now() } = {}) {
  const rows = new Map();
  const worlds = new Map(); // ownerId -> { world, cycle, leaseHolder, leaseUntil }
  const leaseFree = (row, holder) => !row.leaseHolder || row.leaseHolder === holder || row.leaseUntil < now();
  return {
    async loadAll() {
      return [...rows.entries()].map(([ownerId, state]) => ({ ownerId, state: structuredClone(state) }));
    },
    async load(ownerId) {
      return rows.has(ownerId) ? structuredClone(rows.get(ownerId)) : null;
    },
    async save(ownerId, state) {
      rows.set(ownerId, structuredClone(state));
    },
    async loadWorld(ownerId) {
      const row = worlds.get(ownerId);
      return row?.world ? { world: structuredClone(row.world), cycle: row.cycle } : null;
    },
    async saveWorld(ownerId, world, { holder }) {
      const cycle = world.cycle || 0;
      const row = worlds.get(ownerId);
      if (!row) {
        worlds.set(ownerId, { world: structuredClone(world), cycle, leaseHolder: null, leaseUntil: 0 });
        return { ok: true };
      }
      if (row.cycle > cycle) return { ok: false, reason: "stale" };
      if (!leaseFree(row, holder)) return { ok: false, reason: "lease", holder: row.leaseHolder };
      Object.assign(row, { world: structuredClone(world), cycle });
      return { ok: true };
    },
    async acquireWorldLease(ownerId, holder, ttlMs) {
      if (!worlds.has(ownerId)) worlds.set(ownerId, { world: null, cycle: 0, leaseHolder: null, leaseUntil: 0 });
      const row = worlds.get(ownerId);
      if (!leaseFree(row, holder)) return false;
      Object.assign(row, { leaseHolder: holder, leaseUntil: now() + ttlMs });
      return true;
    },
    async releaseWorldLease(ownerId, holder) {
      const row = worlds.get(ownerId);
      if (row?.leaseHolder === holder) row.leaseUntil = now();
    },
    // Inspection (tests uniquement).
    peek(ownerId) {
      return { office: rows.get(ownerId) ?? null, world: worlds.get(ownerId) ?? null };
    },
  };
}
