import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) throw new Error("Reminder service is not configured.");

    const supabase = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();
    const laterToday = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

    const { data: reminders, error: reminderError } = await supabase
      .from("scheduled_posts")
      .select("id,user_id,scheduled_for,status,copy_snapshot,tags")
      .lte("scheduled_for", now)
      .is("reminder_sent_at", null)
      .in("status", ["scheduled", "snoozed"])
      .limit(25);
    if (reminderError) throw reminderError;

    const { data: followUps, error: followUpError } = await supabase
      .from("scheduled_posts")
      .select("id,user_id,scheduled_for,status,copy_snapshot,tags")
      .not("reminder_sent_at", "is", null)
      .is("follow_up_sent_at", null)
      .neq("status", "posted")
      .lte("reminder_sent_at", laterToday)
      .limit(25);
    if (followUpError) throw followUpError;

    const reminderIds = (reminders ?? []).map((post) => post.id);
    const followUpIds = (followUps ?? []).map((post) => post.id);

    if (reminderIds.length) {
      await supabase.from("scheduled_posts").update({ status: "reminded", reminder_sent_at: now }).in("id", reminderIds);
    }
    if (followUpIds.length) {
      await supabase.from("scheduled_posts").update({ follow_up_sent_at: now }).in("id", followUpIds);
    }

    return new Response(JSON.stringify({ remindersQueued: reminderIds.length, followUpsQueued: followUpIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
