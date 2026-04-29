import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  noteId: z.string().uuid(),
  notes: z.string().trim().min(20).max(12000),
  rawMode: z.boolean().default(false),
  selectedPatterns: z.array(z.string()).max(12).optional().default([]),
  regenerateAngle: z.enum(["insight", "story", "tactical"]).optional(),
});

const DraftSchema = z.object({
  drafts: z.array(z.object({
    angle: z.enum(["insight", "story", "tactical"]),
    title: z.string().min(1).max(80),
    content: z.string().min(80).max(2200),
    tags: z.array(z.string()).max(5),
    quality_flags: z.array(z.string()).max(5),
  })).min(1).max(3),
});

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

function fallbackDrafts(notes: string, rawMode: boolean, angle?: "insight" | "story" | "tactical") {
  const base = notes.replace(/\s+/g, " ").trim().slice(0, 520);
  const map = {
    insight: {
      title: "The useful part was the breakage",
      content: `What I tried: I took a rough Lovable build note and pushed it further than I probably should have. The useful part was not the clean output. It was the moment where the app did something slightly wrong and I had to decide whether to patch around it or change the prompt.\n\nWhat happened: ${base}\n\nWhat I learned: the better AI workflow was not asking for a perfect answer. It was keeping the messy evidence in the notes, then asking the model to react to the real constraint. ${rawMode ? "Still messy. But more honest." : "That made the next iteration clearer without turning it into a polished lesson."}`,
    },
    story: {
      title: "A small build note that changed the workflow",
      content: `I started with a simple idea and expected the AI part to be straightforward. It wasn't.\n\n${base}\n\nThe first pass looked fine at a glance, but the details were off. Too smooth. Not enough of what actually happened. So I stopped trying to make the output sound good and started feeding it the awkward parts: where I hesitated, what broke, what I misunderstood.\n\nThat changed the draft. It became less like a post and more like a field note. ${rawMode ? "Which is closer to what I want anyway." : "Still readable, but not sanded down into generic advice."}`,
    },
    tactical: {
      title: "A better prompt starts with the failure",
      content: `A small thing that helped: write the failed attempt into the prompt before asking for the lesson.\n\nInstead of: “turn this into a post.”\n\nUse: “here's what I tried, here's where it broke, here's what I changed, don't make it sound smarter than it was.”\n\nThe source note: ${base}\n\nThat gives the model something specific to work with. It can keep the sequence intact: what I tried, what happened, what changed my mind. The output usually gets less shiny and more useful. ${rawMode ? "Shorter too. Less performance." : "Cleaner, but still grounded in the actual build."}`,
    },
  };
  return (angle ? [angle] : ["insight", "story", "tactical"] as const).map((key) => ({
    angle: key,
    title: map[key].title,
    content: map[key].content,
    tags: ["experiments", "mistakes", key === "tactical" ? "workflows" : "observations"],
    quality_flags: countWords(map[key].content) < 120 ? ["short"] : [],
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Please sign in before generating drafts." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { noteId, notes, rawMode, selectedPatterns, regenerateAngle } = parsed.data;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    let drafts = fallbackDrafts(notes, rawMode, regenerateAngle);

    if (apiKey) {
      const angles = regenerateAngle ? regenerateAngle : "insight, story, tactical";
      const prompt = `Convert these rough Lovable project notes into ${regenerateAngle ? "one" : "three"} draft post${regenerateAngle ? "" : "s"}. Angles required: ${angles}.\n\nVoice rules: raw, honest, slightly unpolished, like a Slack/community message. No hooks. No LinkedIn tone. No hype. 120 to 250 words each. Specifics over filler. Focus on what broke, what changed my mind, and what I learned.\n\nStructure can be loose: what I tried, what happened, what I learned, optional what I would do differently.\n\nRaw mode: ${rawMode ? "ON — shorter sentences, direct language, incomplete thoughts allowed, include failed attempts." : "OFF — slightly clearer, still informal."}\n\nRecent selection patterns to respect without overfitting: ${selectedPatterns.join("; ") || "none yet"}.\n\nReturn only JSON with {"drafts":[{"angle":"insight|story|tactical","title":"...","content":"...","tags":["..."],"quality_flags":["..."]}]}.\n\nNotes:\n${notes}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You write candid build-in-public posts from rough AI-building notes. Return strict JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (aiResponse.ok) {
        const payload = await aiResponse.json();
        const raw = payload.choices?.[0]?.message?.content;
        const json = DraftSchema.safeParse(JSON.parse(raw));
        if (json.success) drafts = json.data.drafts;
      } else if (aiResponse.status === 429 || aiResponse.status === 402) {
        const message = aiResponse.status === 429 ? "AI is rate limited right now. Try again in a minute." : "AI credits are required before generating more drafts.";
        return new Response(JSON.stringify({ error: message }), {
          status: aiResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const rows = drafts.map((draft) => ({
      user_id: user.id,
      note_id: noteId,
      angle: draft.angle,
      title: draft.title,
      content: draft.content,
      word_count: countWords(draft.content),
      tags: draft.tags,
      quality_flags: draft.quality_flags,
    }));

    const { data, error } = await supabase.from("post_drafts").insert(rows).select("*");
    if (error) throw error;

    return new Response(JSON.stringify({ drafts: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
