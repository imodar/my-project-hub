import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PROJECT_ORIGIN_FALLBACKS = [
  "https://7571dddb-1161-4f53-9036-32778235da46.lovableproject.com",
  "https://id-preview--7571dddb-1161-4f53-9036-32778235da46.lovable.app",
  "https://ailti.lovable.app",
  "https://d0479375-ab8c-4895-86c0-45a5df6d51d8.lovableproject.com",
  "http://localhost",
  "capacitor://localhost",
];

const ALLOWED_ORIGINS = Array.from(new Set([
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ...PROJECT_ORIGIN_FALLBACKS,
]));

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  let allowed = "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    allowed = origin;
  } else if (origin === "" || origin === "null") {
    allowed = "capacitor://localhost";
  }
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_TITLE = 200;
const MAX_DESC = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = ["market_list", "task_list", "document_list", "place_list", "trip", "album", "budget", "debt", "medication", "vehicle", "calendar_event"];

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function sanitize(s: string, max: number): string { return s.trim().slice(0, max); }

/* ── Helper: restore main record + related records ── */
async function restoreMain(ac: any, table: string, data: Record<string, any>): Promise<string | null> {
  const { error } = await ac.from(table).insert(data);
  return error ? error.message : null;
}

async function restoreRelated(ac: any, table: string, records: any[]): Promise<string | null> {
  if (!records || records.length === 0) return null;
  const { error } = await ac.from(table).insert(records);
  return error ? error.message : null;
}

async function rollbackMain(ac: any, table: string, id: string) {
  await ac.from(table).delete().eq("id", id);
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "trash-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "move-to-trash") {
      const { family_id, type, title, description, original_data, related_records, is_shared } = body;
      if (family_id && !validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(type, 50)) return json({ error: "النوع مطلوب" }, 400);
      if (!ALLOWED_TYPES.includes(type)) return json({ error: "نوع غير صالح" }, 400);
      if (!validStr(title, MAX_TITLE)) return json({ error: "العنوان مطلوب (حد أقصى 200)" }, 400);
      if (description && typeof description === "string" && description.length > MAX_DESC) return json({ error: "الوصف طويل جداً" }, 400);
      const { data, error } = await supabase.from("trash_items").insert({ family_id, user_id: userId, type, title: sanitize(title, MAX_TITLE), description: description ? sanitize(description, MAX_DESC) : null, original_data, related_records, is_shared: is_shared || false }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-trash") {
      const { family_id } = body;
      if (family_id && !validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      let query = supabase.from("trash_items").select("*").eq("restored", false).order("deleted_at", { ascending: false });
      if (family_id) { query = query.or(`user_id.eq.${userId},family_id.eq.${family_id}`); }
      else { query = query.eq("user_id", userId); }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "restore") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { data: item, error: getErr } = await supabase.from("trash_items").select("*").eq("id", id).single();
      if (getErr || !item) return json({ error: "Item not found" }, 404);

      const originalData = item.original_data;
      const relatedRecords = item.related_records;

      // ── market_list ──
      if (item.type === "market_list" && originalData) {
        const err = await restoreMain(adminClient, "market_lists", {
          id: originalData.id, name: originalData.name, type: originalData.type,
          family_id: originalData.family_id, created_by: originalData.created_by,
          shared_with: originalData.shared_with || [], use_categories: originalData.use_categories ?? true,
        });
        if (err) return json({ error: "فشل استعادة القائمة: " + err }, 400);
        if (relatedRecords?.length > 0) {
          const items = relatedRecords.map((it: any) => ({
            id: it.id, list_id: originalData.id, name: it.name, category: it.category,
            quantity: it.quantity, checked: it.checked, checked_by: it.checked_by, added_by: it.added_by,
          }));
          const relErr = await restoreRelated(adminClient, "market_items", items);
          if (relErr) { await rollbackMain(adminClient, "market_lists", originalData.id); return json({ error: "فشل استعادة العناصر: " + relErr }, 400); }
        }
      }
      // ── task_list ──
      else if (item.type === "task_list" && originalData) {
        const err = await restoreMain(adminClient, "task_lists", {
          id: originalData.id, name: originalData.name, type: originalData.type,
          family_id: originalData.family_id, created_by: originalData.created_by,
          shared_with: originalData.shared_with || [],
        });
        if (err) return json({ error: "فشل استعادة القائمة: " + err }, 400);
        if (relatedRecords?.length > 0) {
          const items = relatedRecords.map((it: any) => ({
            id: it.id, list_id: originalData.id, name: it.name, note: it.note,
            priority: it.priority, assigned_to: it.assigned_to, done: it.done,
            repeat_enabled: it.repeat_enabled, repeat_days: it.repeat_days, repeat_count: it.repeat_count,
          }));
          const relErr = await restoreRelated(adminClient, "task_items", items);
          if (relErr) { await rollbackMain(adminClient, "task_lists", originalData.id); return json({ error: "فشل استعادة المهام: " + relErr }, 400); }
        }
      }
      // ── document_list ──
      else if (item.type === "document_list" && originalData) {
        const err = await restoreMain(adminClient, "document_lists", {
          id: originalData.id, name: originalData.name, type: originalData.type,
          family_id: originalData.family_id, created_by: originalData.created_by,
          shared_with: originalData.shared_with || [],
        });
        if (err) return json({ error: "فشل استعادة القائمة: " + err }, 400);
        if (relatedRecords?.length > 0) {
          // relatedRecords may contain {items: [...], files: [...]} or flat array of items
          const docItems = Array.isArray(relatedRecords) ? relatedRecords : (relatedRecords.items || []);
          const docFiles = Array.isArray(relatedRecords) ? [] : (relatedRecords.files || []);
          if (docItems.length > 0) {
            const items = docItems.map((it: any) => ({
              id: it.id, list_id: originalData.id, name: it.name, category: it.category,
              note: it.note, expiry_date: it.expiry_date, added_by: it.added_by,
              reminder_enabled: it.reminder_enabled ?? false,
            }));
            const relErr = await restoreRelated(adminClient, "document_items", items);
            if (relErr) { await rollbackMain(adminClient, "document_lists", originalData.id); return json({ error: "فشل استعادة المستندات: " + relErr }, 400); }
          }
          if (docFiles.length > 0) {
            const files = docFiles.map((f: any) => ({
              id: f.id, document_id: f.document_id, name: f.name, file_url: f.file_url,
              type: f.type, size: f.size,
            }));
            await restoreRelated(adminClient, "document_files", files);
          }
        }
      }
      // ── place_list ──
      else if (item.type === "place_list" && originalData) {
        const err = await restoreMain(adminClient, "place_lists", {
          id: originalData.id, name: originalData.name, type: originalData.type,
          family_id: originalData.family_id, created_by: originalData.created_by,
          shared_with: originalData.shared_with || [],
        });
        if (err) return json({ error: "فشل استعادة القائمة: " + err }, 400);
        if (relatedRecords?.length > 0) {
          const items = relatedRecords.map((it: any) => ({
            id: it.id, list_id: originalData.id, name: it.name, category: it.category,
            description: it.description, lat: it.lat, lng: it.lng, address: it.address,
            social_link: it.social_link, phone: it.phone, price_range: it.price_range,
            rating: it.rating, kid_friendly: it.kid_friendly, must_visit: it.must_visit ?? false,
            visited: it.visited ?? false, note: it.note, added_by: it.added_by,
            suggested_by: it.suggested_by,
          }));
          const relErr = await restoreRelated(adminClient, "places", items);
          if (relErr) { await rollbackMain(adminClient, "place_lists", originalData.id); return json({ error: "فشل استعادة الأماكن: " + relErr }, 400); }
        }
      }
      // ── trip ──
      else if (item.type === "trip" && originalData) {
        const err = await restoreMain(adminClient, "trips", {
          id: originalData.id, name: originalData.name, destination: originalData.destination,
          start_date: originalData.start_date, end_date: originalData.end_date,
          budget: originalData.budget, status: originalData.status,
          family_id: originalData.family_id, created_by: originalData.created_by,
        });
        if (err) return json({ error: "فشل استعادة الرحلة: " + err }, 400);
        // relatedRecords for trips = { day_plans, activities, expenses, packing, suggestions, documents }
        if (relatedRecords && typeof relatedRecords === "object") {
          const rel = Array.isArray(relatedRecords) ? {} : relatedRecords;
          if (rel.day_plans?.length > 0) {
            const dayItems = rel.day_plans.map((d: any) => ({ id: d.id, trip_id: originalData.id, day_number: d.day_number, city: d.city }));
            await restoreRelated(adminClient, "trip_day_plans", dayItems);
          }
          if (rel.activities?.length > 0) {
            const actItems = rel.activities.map((a: any) => ({ id: a.id, day_plan_id: a.day_plan_id, name: a.name, time: a.time, location: a.location, cost: a.cost, completed: a.completed ?? false }));
            await restoreRelated(adminClient, "trip_activities", actItems);
          }
          if (rel.expenses?.length > 0) {
            const expItems = rel.expenses.map((e: any) => ({ id: e.id, trip_id: originalData.id, name: e.name, amount: e.amount }));
            await restoreRelated(adminClient, "trip_expenses", expItems);
          }
          if (rel.packing?.length > 0) {
            const packItems = rel.packing.map((p: any) => ({ id: p.id, trip_id: originalData.id, name: p.name, packed: p.packed ?? false }));
            await restoreRelated(adminClient, "trip_packing", packItems);
          }
          if (rel.suggestions?.length > 0) {
            const sugItems = rel.suggestions.map((s: any) => ({ id: s.id, trip_id: originalData.id, place_name: s.place_name, type: s.type, reason: s.reason, location: s.location, suggested_by: s.suggested_by, status: s.status ?? "pending" }));
            await restoreRelated(adminClient, "trip_suggestions", sugItems);
          }
          if (rel.documents?.length > 0) {
            const docItems = rel.documents.map((d: any) => ({ id: d.id, trip_id: originalData.id, name: d.name, type: d.type, file_url: d.file_url, file_name: d.file_name, notes: d.notes }));
            await restoreRelated(adminClient, "trip_documents", docItems);
          }
        }
      }
      // ── album ──
      else if (item.type === "album" && originalData) {
        const err = await restoreMain(adminClient, "albums", {
          id: originalData.id, name: originalData.name, family_id: originalData.family_id,
          created_by: originalData.created_by, cover_color: originalData.cover_color,
          linked_trip_id: originalData.linked_trip_id,
        });
        if (err) return json({ error: "فشل استعادة الألبوم: " + err }, 400);
        if (relatedRecords?.length > 0) {
          const photos = relatedRecords.map((p: any) => ({
            id: p.id, album_id: originalData.id, url: p.url, caption: p.caption, date: p.date,
          }));
          const relErr = await restoreRelated(adminClient, "album_photos", photos);
          if (relErr) { await rollbackMain(adminClient, "albums", originalData.id); return json({ error: "فشل استعادة الصور: " + relErr }, 400); }
        }
      }
      // ── budget ──
      else if (item.type === "budget" && originalData) {
        const err = await restoreMain(adminClient, "budgets", {
          id: originalData.id, family_id: originalData.family_id, created_by: originalData.created_by,
          type: originalData.type, month: originalData.month, label: originalData.label,
          income: originalData.income, shared_with: originalData.shared_with || [],
          trip_id: originalData.trip_id,
        });
        if (err) return json({ error: "فشل استعادة الميزانية: " + err }, 400);
        if (relatedRecords?.length > 0) {
          const expenses = relatedRecords.map((e: any) => ({
            id: e.id, budget_id: originalData.id, name: e.name, amount: e.amount,
            currency: e.currency ?? "SAR", date: e.date,
          }));
          const relErr = await restoreRelated(adminClient, "budget_expenses", expenses);
          if (relErr) { await rollbackMain(adminClient, "budgets", originalData.id); return json({ error: "فشل استعادة المصروفات: " + relErr }, 400); }
        }
      }
      // ── debt ──
      else if (item.type === "debt" && originalData) {
        const err = await restoreMain(adminClient, "debts", {
          id: originalData.id, family_id: originalData.family_id, user_id: originalData.user_id,
          person_name: originalData.person_name, amount: originalData.amount,
          currency: originalData.currency ?? "SAR", direction: originalData.direction,
          date: originalData.date, due_date: originalData.due_date, note: originalData.note,
          payment_details: originalData.payment_details,
          is_fully_paid: originalData.is_fully_paid ?? false,
          is_archived: originalData.is_archived ?? false,
          has_reminder: originalData.has_reminder ?? false,
        });
        if (err) return json({ error: "فشل استعادة الدين: " + err }, 400);
        if (relatedRecords && typeof relatedRecords === "object" && !Array.isArray(relatedRecords)) {
          // { payments: [...], postponements: [...] }
          if (relatedRecords.payments?.length > 0) {
            const payments = relatedRecords.payments.map((p: any) => ({
              id: p.id, debt_id: originalData.id, amount: p.amount, currency: p.currency ?? "SAR",
              date: p.date, type: p.type, item_description: p.item_description,
              payment_details: p.payment_details,
            }));
            await restoreRelated(adminClient, "debt_payments", payments);
          }
          if (relatedRecords.postponements?.length > 0) {
            const posts = relatedRecords.postponements.map((p: any) => ({
              id: p.id, debt_id: originalData.id, reason: p.reason, new_date: p.new_date,
            }));
            await restoreRelated(adminClient, "debt_postponements", posts);
          }
        } else if (Array.isArray(relatedRecords) && relatedRecords.length > 0) {
          // Flat array = payments only
          const payments = relatedRecords.map((p: any) => ({
            id: p.id, debt_id: originalData.id, amount: p.amount, currency: p.currency ?? "SAR",
            date: p.date, type: p.type, item_description: p.item_description,
            payment_details: p.payment_details,
          }));
          await restoreRelated(adminClient, "debt_payments", payments);
        }
      }
      // ── medication ──
      else if (item.type === "medication" && originalData) {
        const err = await restoreMain(adminClient, "medications", {
          id: originalData.id, family_id: originalData.family_id, name: originalData.name,
          dosage: originalData.dosage, color: originalData.color,
          member_id: originalData.member_id, member_name: originalData.member_name,
          frequency_type: originalData.frequency_type, frequency_value: originalData.frequency_value,
          times_per_day: originalData.times_per_day, specific_times: originalData.specific_times || [],
          selected_days: originalData.selected_days || [],
          start_date: originalData.start_date, end_date: originalData.end_date,
          reminder_enabled: originalData.reminder_enabled ?? false, notes: originalData.notes,
        });
        if (err) return json({ error: "فشل استعادة الدواء: " + err }, 400);
      }
      // ── vehicle ──
      else if (item.type === "vehicle" && originalData) {
        const err = await restoreMain(adminClient, "vehicles", {
          id: originalData.id, family_id: originalData.family_id,
          name: originalData.name, make: originalData.make, model: originalData.model,
          year: originalData.year, color: originalData.color,
          plate_number: originalData.plate_number, vin: originalData.vin,
          mileage: originalData.mileage, insurance_expiry: originalData.insurance_expiry,
          registration_expiry: originalData.registration_expiry, notes: originalData.notes,
          shared_with: originalData.shared_with || [],
        });
        if (err) return json({ error: "فشل استعادة المركبة: " + err }, 400);
        if (relatedRecords?.length > 0) {
          const maint = relatedRecords.map((m: any) => ({
            id: m.id, vehicle_id: originalData.id, type: m.type, label: m.label,
            date: m.date, mileage_at_service: m.mileage_at_service,
            next_mileage: m.next_mileage, next_date: m.next_date, notes: m.notes,
            cost: m.cost,
          }));
          const relErr = await restoreRelated(adminClient, "vehicle_maintenance", maint);
          if (relErr) { await rollbackMain(adminClient, "vehicles", originalData.id); return json({ error: "فشل استعادة الصيانة: " + relErr }, 400); }
        }
      }
      // ── calendar_event ──
      else if (item.type === "calendar_event" && originalData) {
        const err = await restoreMain(adminClient, "calendar_events", {
          id: originalData.id, family_id: originalData.family_id, title: originalData.title,
          date: originalData.date, icon: originalData.icon, added_by: originalData.added_by,
          reminder_before: originalData.reminder_before || [],
          personal_reminders: originalData.personal_reminders || [],
        });
        if (err) return json({ error: "فشل استعادة الحدث: " + err }, 400);
      }

      const { error } = await supabase.from("trash_items").update({ restored: true }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ data: item });
    }

    if (action === "permanent-delete") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await adminClient.from("trash_items").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
