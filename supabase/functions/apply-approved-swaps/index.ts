import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Fetch all approved swaps ordered by approval date
  const { data: swaps, error: fetchError } = await supabase
    .from("swap_requests")
    .select("id, requester_id, target_id, requester_shift_date, target_shift_date, admin_approved_at")
    .eq("status", "APPROVED")
    .order("admin_approved_at", { ascending: true, nullsFirst: false });

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { id: string; status: string; detail?: string }[] = [];

  for (const swap of swaps || []) {
    // Get team_ids for both guards
    const [{ data: reqProfile }, { data: tgtProfile }] = await Promise.all([
      supabase.from("profiles").select("team_id").eq("id", swap.requester_id).single(),
      supabase.from("profiles").select("team_id").eq("id", swap.target_id).single(),
    ]);

    if (!reqProfile?.team_id || !tgtProfile?.team_id) {
      results.push({ id: swap.id, status: "skipped", detail: "missing team_id" });
      continue;
    }

    // Get current team_ids on those dates
    const [{ data: reqSchedule }, { data: tgtSchedule }] = await Promise.all([
      supabase.from("team_schedules").select("id, team_id").eq("shift_date", swap.requester_shift_date).maybeSingle(),
      supabase.from("team_schedules").select("id, team_id").eq("shift_date", swap.target_shift_date).maybeSingle(),
    ]);

    if (!reqSchedule || !tgtSchedule) {
      results.push({ id: swap.id, status: "skipped", detail: `no schedule found (req: ${!!reqSchedule}, tgt: ${!!tgtSchedule})` });
      continue;
    }

    // Swap the team_ids
    const { error: e1 } = await supabase
      .from("team_schedules")
      .update({ team_id: tgtSchedule.team_id })
      .eq("id", reqSchedule.id);

    const { error: e2 } = await supabase
      .from("team_schedules")
      .update({ team_id: reqSchedule.team_id })
      .eq("id", tgtSchedule.id);

    if (e1 || e2) {
      results.push({ id: swap.id, status: "error", detail: `${e1?.message || ""} ${e2?.message || ""}` });
    } else {
      results.push({
        id: swap.id,
        status: "applied",
        detail: `${swap.requester_shift_date}: ${reqSchedule.team_id}→${tgtSchedule.team_id}, ${swap.target_shift_date}: ${tgtSchedule.team_id}→${reqSchedule.team_id}`,
      });
    }
  }

  const applied = results.filter((r) => r.status === "applied").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  return new Response(
    JSON.stringify({ total: swaps?.length || 0, applied, skipped, errors, details: results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
