import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PostBody = z.object({
  mode: z.literal("post"),
  webinarId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  presenter: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().min(20).max(200000),
  context: z.string().trim().max(5000).optional().nullable(),
});

const RollupBody = z.object({
  mode: z.literal("rollup"),
});

const BodySchema = z.discriminatedUnion("mode", [PostBody, RollupBody]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Please sign in." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI key missing." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (parsed.data.mode === "post") {
      const { title, presenter, notes } = parsed.data;

      // Pull recent final versions as voice samples
      const { data: voiceSamples } = await supabase
        .from("webinars")
        .select("final_version")
        .eq("user_id", user.id)
        .not("final_version", "is", null)
        .order("updated_at", { ascending: false })
        .limit(5);
      const samples = (voiceSamples ?? []).map((s: any) => s.final_version).filter(Boolean);

      systemPrompt = "You write short, authentic build-in-public posts for someone who just watched a webinar. Voice is warm and direct, like a conversation in Slack — first person, casual, no corporate polish. Focus on real learnings, hot takes, or contrarian beliefs. No hype, no LinkedIn tone, no hooks, no emojis unless the samples use them. 90-160 words.";
      const voiceBlock = samples.length
        ? `\n\nHere are recent posts the user actually published or edited into their final form. Match this voice — sentence rhythm, word choices, level of casualness, how they open and close:\n\n${samples.map((s, i) => `Sample ${i + 1}:\n${s}`).join("\n\n---\n\n")}\n\n`
        : "";
      userPrompt = `Webinar: ${title}${presenter ? ` by ${presenter}` : ""}\n\nMy notes:\n${notes}${voiceBlock}\nWrite ONE authentic post in the user's voice. Lead with a real learning or hot take — specific, slightly contrarian if it fits. Don't summarize the whole webinar. Pick the one idea worth sharing and say what they actually think.`;
    } else {
      const { data: webinars } = await supabase
        .from("webinars")
        .select("title, presenter, notes, watched_at")
        .order("watched_at", { ascending: false })
        .limit(50);
      if (!webinars || webinars.length === 0) {
        return new Response(JSON.stringify({ summary: "No webinars logged yet." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      systemPrompt = "You synthesize patterns across webinars someone has watched. Find recurring themes, contradictions between speakers, and the takes that keep coming up. Plainspoken, honest, no fluff.";
      userPrompt = `Here are the webinars I've watched and my notes from each. Give me a roll-up: 3-5 recurring themes, any contradictions or debates I keep seeing, and 2-3 sharp takeaways. Keep it under 350 words.\n\n${webinars.map((w: any) => `--- ${w.title}${w.presenter ? ` (${w.presenter})` : ""} — ${w.watched_at}\n${w.notes}`).join("\n\n")}`;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const message = aiResponse.status === 429
        ? "AI is rate limited. Try again shortly."
        : aiResponse.status === 402
          ? "AI credits are required."
          : "AI request failed.";
      return new Response(JSON.stringify({ error: message }), {
        status: aiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await aiResponse.json();
    const content = payload.choices?.[0]?.message?.content?.trim() ?? "";

    if (parsed.data.mode === "post") {
      await supabase.from("webinars")
        .update({ generated_post: content })
        .eq("id", parsed.data.webinarId)
        .eq("user_id", user.id);
      return new Response(JSON.stringify({ post: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ summary: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
