import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { swapReminder } from "../_shared/messages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  console.log("notify-swap-reminder invoked:", req.method, new Date().toISOString());
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Calculate tomorrow in Brasília timezone
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log("Looking for approved swaps for tomorrow:", tomorrowStr);

    // Find approved swaps where requester or target has a shift tomorrow
    const { data: swaps, error: swapsError } = await supabaseAdmin
      .from("swap_requests")
      .select("id, requester_id, target_id, requester_shift_date, target_shift_date, status")
      .eq("status", "APPROVED")
      .or(`requester_shift_date.eq.${tomorrowStr},target_shift_date.eq.${tomorrowStr}`);

    if (swapsError) {
      console.error("Error fetching swaps:", swapsError);
      throw new Error(swapsError.message);
    }

    if (!swaps || swaps.length === 0) {
      console.log("No swaps found for tomorrow");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma troca para amanhã", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = Deno.env.get("tokenevolutiondainstancia");
    if (!token) {
      throw new Error("Token da instância Evolution não configurado");
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const swap of swaps) {
      // Determine who needs to be reminded and who is the other person
      const reminders: { guardId: string; otherGuardId: string; shiftDate: string; otherShiftDate: string }[] = [];

      if (swap.requester_shift_date === tomorrowStr) {
        // Requester has shift tomorrow (this is the date they gave away, but after swap the TARGET covers it)
        // So remind the TARGET who will cover the requester's original shift
        reminders.push({
          guardId: swap.target_id,
          otherGuardId: swap.requester_id,
          shiftDate: swap.requester_shift_date,
          otherShiftDate: swap.target_shift_date,
        });
      }

      if (swap.target_shift_date === tomorrowStr) {
        // Target's original shift date is tomorrow, requester covers it
        reminders.push({
          guardId: swap.requester_id,
          otherGuardId: swap.target_id,
          shiftDate: swap.target_shift_date,
          otherShiftDate: swap.requester_shift_date,
        });
      }

      for (const reminder of reminders) {
        try {
          // Fetch guard and other guard profiles
          const [guardRes, otherRes] = await Promise.all([
            supabaseAdmin.from("profiles").select("name, phone").eq("id", reminder.guardId).single(),
            supabaseAdmin.from("profiles").select("name").eq("id", reminder.otherGuardId).single(),
          ]);

          if (guardRes.error || !guardRes.data?.phone) {
            console.error("Guard profile not found or no phone:", reminder.guardId, guardRes.error);
            errors.push(`Guard ${reminder.guardId}: sem telefone`);
            continue;
          }

          const guardFirstName = guardRes.data.name.split(" ")[0];
          const otherName = otherRes.data?.name || "colega";

          const message = swapReminder({
            swapId: swap.id,
            name: guardRes.data.name,
            otherName,
            shiftDate: reminder.shiftDate,
            otherShiftDate: reminder.otherShiftDate,
          });

          // Normalize phone
          const digits = guardRes.data.phone.replace(/\D/g, "");
          const phoneWithCountry = digits.startsWith("55") ? digits : `55${digits}`;

          const whatsappResponse = await fetch(
            "https://evolution.autozapx.com/message/sendText/escala",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: token,
              },
              body: JSON.stringify({
                number: phoneWithCountry,
                text: message,
              }),
            }
          );

          if (!whatsappResponse.ok) {
            const errBody = await whatsappResponse.text();
            console.error("Evolution API error:", whatsappResponse.status, errBody);
            errors.push(`Guard ${guardFirstName}: erro WhatsApp`);
          } else {
            console.log(`Reminder sent to ${guardFirstName} (${phoneWithCountry})`);
            sentCount++;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          console.error("Error sending reminder:", msg);
          errors.push(msg);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("notify-swap-reminder error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
