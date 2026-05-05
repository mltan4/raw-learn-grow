import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Check,
  CheckCircle2,
  Clipboard,
  FileText,
  Github,
  Link2,
  Link2Off,
  Loader2,
  LogOut,
  PenLine,
  Sparkles,
  Trash2,
  Type,
  Video,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type SourceKey = "text" | "lovable" | "github" | "transcript";

type Profile = {
  timezone: string;
  default_reminder_time: string;
  raw_mode_default: boolean;
  email: string | null;
  github_handle: string | null;
  github_repo: string | null;
};

type Draft = {
  id: string;
  title: string;
  presenter: string | null;
  notes: string;
  watched_at: string;
  generated_post: string | null;
  final_version: string | null;
  context: string | null;
  source: SourceKey;
  topic: string | null;
  tags: string[];
  created_at: string;
  updated_at?: string;
};

const sourceMeta: Record<SourceKey, { label: string; icon: any; hint: string }> = {
  text: { label: "Open text", icon: Type, hint: "Paste anything — rough notes, ideas, half-thoughts." },
  lovable: { label: "Lovable", icon: Sparkles, hint: "Pull context from your current Lovable build." },
  github: { label: "GitHub", icon: Github, hint: "Pull recent public activity from your linked GitHub." },
  transcript: { label: "Transcript", icon: Video, hint: "Upload a transcript file (.txt, .md, .vtt, .srt)." },
};

const currentProjectSeed = `Source: current Lovable writing-studio project
Goal: turn rough Lovable project notes, prompts, failures, observations, and half-baked ideas into honest draft posts.
What changed: the app now has a unified 4-source ingestion flow, persistent GitHub connection, and one draft per topic.
Useful tension: the value depends on importing messier source material from actual builds instead of writing polished notes after the fact.`;

const deriveTopicFromText = (text: string, fallback = "Untitled draft") => {
  const source = text.trim().replace(/\s+/g, " ");
  if (!source) return fallback;
  const firstSentence = source.split(/(?<=[.!?])\s/)[0] ?? source;
  const cleaned = firstSentence.replace(/^["'`*#-]+\s*/, "").trim();
  return cleaned.length > 80 ? cleaned.slice(0, 77).trimEnd() + "…" : cleaned || fallback;
};

const stripTranscriptFormatting = (raw: string) => {
  // Strip VTT/SRT timestamps and indices, keep speaker text
  return raw
    .replace(/^WEBVTT.*$/gim, "")
    .replace(/^\d+\s*$/gm, "")
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

type DraftCardProps = {
  draft: Draft;
  isGenerating: boolean;
  onGenerate: (instructions: string, editedPost: string) => void;
  onConfirmFinal: (finalText: string) => void;
  onDelete: () => void;
  onCopy: (text: string) => void;
};

const DraftCard = ({ draft, isGenerating, onGenerate, onConfirmFinal, onDelete, onCopy }: DraftCardProps) => {
  const [postDraft, setPostDraft] = useState(draft.generated_post ?? "");
  const [comments, setComments] = useState("");
  const [finalDraft, setFinalDraft] = useState(draft.final_version ?? "");
  const [showFinalEditor, setShowFinalEditor] = useState(false);

  useEffect(() => { setPostDraft(draft.generated_post ?? ""); }, [draft.generated_post]);
  useEffect(() => { setFinalDraft(draft.final_version ?? ""); }, [draft.final_version]);

  const SourceIcon = sourceMeta[draft.source]?.icon ?? Type;
  const isFinalSameAsPost = finalDraft.trim() === (postDraft.trim() || draft.generated_post?.trim() || "");

  return (
    <Card className="glass-tile rounded-lg shadow-none">
      <CardHeader className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1"><SourceIcon className="h-3 w-3" />{sourceMeta[draft.source]?.label ?? draft.source}</Badge>
              {draft.final_version ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Final saved</Badge> : null}
            </div>
            <CardTitle className="text-base leading-5">{draft.topic || draft.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{format(new Date(draft.created_at), "MMM d, yyyy")}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete draft"><Trash2 /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {draft.generated_post ? (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Draft (edit inline before regenerating)</Label>
              <Textarea
                value={postDraft}
                onChange={(e) => setPostDraft(e.target.value)}
                className="min-h-[140px] resize-y text-sm leading-6"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Comments / tweaks for the next pass</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="e.g. shorter, lead with the contrarian take, drop the second paragraph..."
                className="min-h-[60px] resize-y text-sm leading-6"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => onGenerate(comments, postDraft)} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />} Regenerate with tweaks
              </Button>
              <Button variant="outline" size="sm" onClick={() => onCopy(postDraft || draft.generated_post || "")}>
                <Clipboard /> Copy
              </Button>
            </div>

            <div className="space-y-2 rounded-md border border-dashed border-border bg-card/40 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Final version</Label>
                {!showFinalEditor && !draft.final_version ? (
                  <Button size="sm" variant="ghost" onClick={() => { setFinalDraft(postDraft); setShowFinalEditor(true); }}>
                    <PenLine className="mr-1" /> Save my final modification
                  </Button>
                ) : null}
              </div>
              {showFinalEditor || draft.final_version ? (
                <>
                  <Textarea
                    value={finalDraft}
                    onChange={(e) => setFinalDraft(e.target.value)}
                    placeholder="Paste or edit the version you actually want to keep. The tool learns your voice from these."
                    className="min-h-[100px] resize-y text-sm leading-6"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setFinalDraft(postDraft); onConfirmFinal(postDraft); }}>
                      <Check /> Agree with current draft
                    </Button>
                    <Button size="sm" onClick={() => onConfirmFinal(finalDraft)} disabled={!finalDraft.trim()}>
                      <CheckCircle2 /> {draft.final_version ? "Update final" : "Save final"}
                    </Button>
                  </div>
                  {draft.final_version && !isFinalSameAsPost ? (
                    <p className="text-xs text-muted-foreground">Your final differs from the current draft — that's the version saved as a voice sample.</p>
                  ) : null}
                </>
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="line-clamp-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{draft.notes}</p>
            <Button size="sm" variant="secondary" onClick={() => onGenerate("", "")} disabled={isGenerating} className="w-full">
              {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate draft
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    default_reminder_time: "09:00",
    raw_mode_default: false,
    email: null,
    github_handle: null,
    github_repo: null,
  });

  // Unified ingestion state
  const [activeSource, setActiveSource] = useState<SourceKey>("text");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [context, setContext] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // GitHub connection
  const [githubHandleInput, setGithubHandleInput] = useState("");
  const [githubRepoInput, setGithubRepoInput] = useState("");
  const [isLinkingGithub, setIsLinkingGithub] = useState(false);
  const [isPullingGithub, setIsPullingGithub] = useState(false);

  // Drafts (stored in webinars table — unified store, one per topic)
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadWorkspace(user);
  }, [user]);

  const loadWorkspace = async (currentUser: any) => {
    const client = supabase as any;
    const defaultProfile = {
      user_id: currentUser.id,
      email: currentUser.email,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      default_reminder_time: "09:00",
      raw_mode_default: false,
      github_handle: null,
      github_repo: null,
    };
    const { data: profileRow } = await client.from("profiles").select("*").eq("user_id", currentUser.id).maybeSingle();
    if (!profileRow) {
      await client.from("profiles").insert(defaultProfile);
      setProfile(defaultProfile as any);
    } else {
      setProfile(profileRow);
      setRawMode(profileRow.raw_mode_default ?? false);
      setGithubHandleInput(profileRow.github_handle ?? "");
      setGithubRepoInput(profileRow.github_repo ?? "");
    }

    const { data: draftRows } = await client
      .from("webinars")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(80);
    setDrafts((draftRows ?? []) as Draft[]);
  };

  const signIn = async (mode: "signin" | "signup") => {
    if (!authEmail.trim() || authPassword.length < 6) {
      toast.error("Use an email and a password with at least 6 characters.");
      return;
    }
    setIsAuthLoading(true);
    const action = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error } = await action.call(supabase.auth, { email: authEmail.trim(), password: authPassword });
    setIsAuthLoading(false);
    if (error) toast.error(error.message);
    else toast.success(mode === "signup" ? "Check your email to confirm your account." : "Signed in.");
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message);
  };

  // ---- GitHub connection (persistent) ----
  const linkGithub = async () => {
    if (!user) return;
    const handle = githubHandleInput.trim().replace(/^@/, "");
    if (!handle) { toast.error("Add a GitHub username."); return; }
    setIsLinkingGithub(true);
    // Verify the user exists publicly
    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`);
      if (!res.ok) throw new Error(res.status === 404 ? "GitHub user not found." : "Could not reach GitHub.");
    } catch (e) {
      setIsLinkingGithub(false);
      toast.error(e instanceof Error ? e.message : "GitHub check failed.");
      return;
    }
    const client = supabase as any;
    const repo = githubRepoInput.trim() || null;
    const { error } = await client.from("profiles").update({ github_handle: handle, github_repo: repo }).eq("user_id", user.id);
    setIsLinkingGithub(false);
    if (error) { toast.error(error.message); return; }
    setProfile((p) => ({ ...p, github_handle: handle, github_repo: repo }));
    toast.success(`Linked @${handle}.`);
  };

  const unlinkGithub = async () => {
    if (!user) return;
    const client = supabase as any;
    const { error } = await client.from("profiles").update({ github_handle: null, github_repo: null }).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    setProfile((p) => ({ ...p, github_handle: null, github_repo: null }));
    setGithubHandleInput(""); setGithubRepoInput("");
    toast.success("GitHub unlinked.");
  };

  const pullGithubActivity = async () => {
    const handle = profile.github_handle;
    if (!handle) { toast.error("Link your GitHub first."); return; }
    const repo = profile.github_repo;
    setIsPullingGithub(true);
    try {
      const [eventsRes, reposRes] = await Promise.all([
        fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/events/public?per_page=20`),
        repo ? Promise.resolve(null) : fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/repos?sort=updated&per_page=8`),
      ]);
      if (!eventsRes.ok) throw new Error("Could not read GitHub activity.");
      const events = await eventsRes.json();
      const repos = reposRes && reposRes.ok ? await reposRes.json() : [];

      let repoDetails: any = null;
      if (repo) {
        const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(handle)}/${encodeURIComponent(repo)}`);
        if (r.ok) repoDetails = await r.json();
      }
      const eventLines = events.slice(0, 10).map((event: any) => {
        const commitMessages = event.payload?.commits?.slice(0, 3).map((c: any) => c.message).join(" | ");
        const issueTitle = event.payload?.issue?.title || event.payload?.pull_request?.title;
        return `- ${event.type.replace("Event", "")} in ${event.repo?.name || "unknown"}${issueTitle ? `: ${issueTitle}` : ""}${commitMessages ? `: ${commitMessages}` : ""}`;
      });
      const repoLines = repoDetails
        ? [`Repo: ${repoDetails.full_name} — ${repoDetails.description || "No description"} (${repoDetails.language || "unknown"})`]
        : repos.slice(0, 6).map((r: any) => `- ${r.full_name}: ${r.description || "No description"} (${r.language || "unknown"})`);
      const text = `Source: GitHub @${handle}${repo ? ` / ${repo}` : ""}\n\n${repo ? "Repo" : "Recent repos"}:\n${repoLines.join("\n") || "—"}\n\nRecent activity:\n${eventLines.join("\n") || "No recent public activity."}`;
      setNotes((current) => current.trim() ? `${current.trim()}\n\n---\n\n${text}` : text);
      if (!topic.trim()) setTopic(repo ? `${repo} — recent build` : `@${handle} — recent activity`);
      toast.success("GitHub context pulled.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "GitHub pull failed.");
    } finally {
      setIsPullingGithub(false);
    }
  };

  // ---- Source switching ----
  const switchSource = (next: SourceKey) => {
    setActiveSource(next);
  };

  const useCurrentLovableProject = () => {
    setNotes((c) => c.trim() ? `${c.trim()}\n\n---\n\n${currentProjectSeed}` : currentProjectSeed);
    if (!topic.trim()) setTopic("Lovable build — current project");
    toast.success("Lovable project context added.");
  };

  const handleTranscriptUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const MAX = 2_000_000;
    const chunks: string[] = [];
    let firstName = "";
    for (const file of Array.from(files)) {
      if (file.size > MAX) { toast.error(`${file.name} is too large (max 2MB).`); continue; }
      if (!/\.(txt|md|markdown|vtt|srt)$/i.test(file.name) && !file.type.startsWith("text/")) {
        toast.error(`${file.name} isn't a text/transcript file.`); continue;
      }
      const raw = await file.text();
      const cleaned = stripTranscriptFormatting(raw);
      chunks.push(`--- ${file.name} ---\n${cleaned}`);
      if (!firstName) firstName = file.name.replace(/\.[^.]+$/, "");
    }
    if (!chunks.length) return;
    setNotes((c) => c.trim() ? `${c.trim()}\n\n${chunks.join("\n\n")}` : chunks.join("\n\n"));
    if (!topic.trim() && firstName) setTopic(firstName.replace(/[-_]+/g, " ").trim());
    toast.success(`Loaded ${chunks.length} transcript${chunks.length > 1 ? "s" : ""}.`);
  };

  // ---- Create + generate draft ----
  const createDraft = async (alsoGenerate: boolean) => {
    if (!user) return;
    if (notes.trim().length < 20) { toast.error("Add a few more notes first."); return; }
    setIsCreating(true);
    const finalTopic = topic.trim() || deriveTopicFromText(notes);
    const client = supabase as any;
    const { data, error } = await client
      .from("webinars")
      .insert({
        user_id: user.id,
        title: finalTopic,
        topic: finalTopic,
        source: activeSource,
        notes: notes.trim(),
        context: context.trim() || null,
        watched_at: new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();
    setIsCreating(false);
    if (error) { toast.error(error.message); return; }
    setDrafts((c) => [data, ...c]);
    setTopic(""); setNotes(""); setContext("");
    toast.success("Draft saved.");
    if (alsoGenerate) await generateForDraft(data, "", "");
  };

  const generateForDraft = async (draft: Draft, instructions: string, editedPost: string) => {
    setGeneratingId(draft.id);
    const previous = (editedPost.trim() || draft.generated_post || "").trim() || null;
    const effectiveContext = instructions.trim() || draft.context || "";
    const { data, error } = await supabase.functions.invoke("generate-webinar-post", {
      body: {
        mode: "post",
        webinarId: draft.id,
        title: draft.topic || draft.title,
        presenter: draft.presenter,
        notes: draft.notes,
        context: effectiveContext || null,
        previousPost: previous,
      },
    });
    setGeneratingId(null);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Generation failed."); return; }
    if (instructions.trim() && instructions.trim() !== (draft.context ?? "")) {
      const client = supabase as any;
      await client.from("webinars").update({ context: instructions.trim() }).eq("id", draft.id);
    }
    setDrafts((c) => c.map((d) => d.id === draft.id ? { ...d, generated_post: data.post, context: instructions.trim() || d.context } : d));
    toast.success(previous ? "Draft updated." : "Draft generated.");
  };

  const confirmFinal = async (draft: Draft, finalText: string) => {
    const client = supabase as any;
    const value = finalText.trim() || null;
    const { error } = await client.from("webinars").update({ final_version: value }).eq("id", draft.id);
    if (error) { toast.error(error.message); return; }
    setDrafts((c) => c.map((d) => d.id === draft.id ? { ...d, final_version: value } : d));
    toast.success(value ? "Final saved. Voice will improve over time." : "Final cleared.");
  };

  const deleteDraft = async (id: string) => {
    const client = supabase as any;
    const { error } = await client.from("webinars").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setDrafts((c) => c.filter((d) => d.id !== id));
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied.");
  };

  if (!user) {
    return (
      <main className="min-h-screen overflow-hidden px-4 py-8 text-foreground">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="glass-panel slop-stage rounded-lg p-6 sm:p-8 lg:min-h-[520px]">
            <div className="flex h-full flex-col justify-center gap-8">
              <div className="space-y-6">
                <Badge variant="secondary" className="w-fit">Private writing studio</Badge>
                <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-normal text-foreground sm:text-7xl">If you can't beat the AI slop, make better slop.</h1>
                <div className="max-w-2xl space-y-3 text-base leading-7 text-muted-foreground sm:text-lg">
                  <p>Turn what you're already building into something worth sharing.</p>
                  <p>Messy build notes, transcripts, GitHub activity, half-finished thoughts — into posts that still sound like a person was there.</p>
                </div>
              </div>
            </div>
          </div>
          <Card className="glass-panel rounded-lg shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} type="email" placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} type="password" placeholder="At least 6 characters" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => signIn("signin")} disabled={isAuthLoading}>{isAuthLoading ? <Loader2 className="animate-spin" /> : null} Sign in</Button>
                <Button onClick={() => signIn("signup")} variant="secondary" disabled={isAuthLoading}>Create account</Button>
              </div>
              <Button onClick={signInWithGoogle} variant="outline" className="w-full">Continue with Google</Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const ActiveSourceIcon = sourceMeta[activeSource].icon;

  return (
    <main className="min-h-screen text-foreground">
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="glass-panel flex flex-col gap-4 rounded-lg p-5 sm:flex-row sm:items-end sm:justify-between lg:p-6">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">AI build notes</Badge>
            <h1 className="text-4xl font-semibold tracking-normal sm:text-6xl">Writing studio</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">One draft per topic. Pick a source, give it some notes, iterate until it sounds like you.</p>
          </div>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()} className="w-fit"><LogOut /> Sign out</Button>
        </header>

        {/* New Draft */}
        <section className="glass-panel space-y-5 rounded-lg p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-medium">New draft</h2>
              <p className="text-sm text-muted-foreground">{sourceMeta[activeSource].hint}</p>
            </div>
            <div className="glass-tile flex items-center gap-3 rounded-lg px-3 py-2">
              <Label htmlFor="raw-mode" className="text-sm">Make it more raw</Label>
              <Switch id="raw-mode" checked={rawMode} onCheckedChange={setRawMode} />
            </div>
          </div>

          {/* Source picker */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(sourceMeta) as SourceKey[]).map((key) => {
              const Icon = sourceMeta[key].icon;
              const active = activeSource === key;
              return (
                <Button
                  key={key}
                  type="button"
                  variant={active ? "secondary" : "outline"}
                  onClick={() => switchSource(key)}
                  className="h-auto flex-col gap-1 py-3"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm">{sourceMeta[key].label}</span>
                </Button>
              );
            })}
          </div>

          {/* Source-specific control row */}
          {activeSource === "github" ? (
            <div className="glass-tile space-y-3 rounded-lg p-3">
              {profile.github_handle ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge className="gap-1"><Link2 className="h-3 w-3" /> Connected</Badge>
                    <span className="text-sm">@{profile.github_handle}{profile.github_repo ? ` / ${profile.github_repo}` : ""}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={pullGithubActivity} disabled={isPullingGithub}>
                      {isPullingGithub ? <Loader2 className="animate-spin" /> : <Github />} Pull recent activity
                    </Button>
                    <Button size="sm" variant="ghost" onClick={unlinkGithub}><Link2Off /> Unlink</Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input value={githubHandleInput} onChange={(e) => setGithubHandleInput(e.target.value)} placeholder="GitHub username" />
                  <Input value={githubRepoInput} onChange={(e) => setGithubRepoInput(e.target.value)} placeholder="Optional repo" />
                  <Button onClick={linkGithub} disabled={isLinkingGithub}>
                    {isLinkingGithub ? <Loader2 className="animate-spin" /> : <Link2 />} Link GitHub
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {activeSource === "lovable" ? (
            <Button variant="outline" onClick={useCurrentLovableProject} className="w-fit">
              <Sparkles /> Pull current Lovable project context
            </Button>
          ) : null}

          {activeSource === "transcript" ? (
            <label className="glass-tile flex cursor-pointer items-center justify-between gap-3 rounded-lg p-3 hover:bg-card/80">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                <span>Upload transcript file (.txt, .md, .vtt, .srt — max 2MB)</span>
              </div>
              <span className="text-xs text-muted-foreground">Topic auto-fills from filename</span>
              <input
                type="file"
                accept=".txt,.md,.markdown,.vtt,.srt,text/plain,text/markdown"
                multiple
                className="hidden"
                onChange={(e) => { handleTranscriptUpload(e.target.files); e.target.value = ""; }}
              />
            </label>
          ) : null}

          {/* Topic + Notes + Context */}
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Topic / category</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What is this draft about? (auto-derived if blank)"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><ActiveSourceIcon className="h-4 w-4" /> Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What I tried... what broke... the part that changed my mind..."
                className="min-h-[200px] resize-y rounded-lg bg-card/80 text-base leading-7"
              />
            </div>
            <div className="space-y-2">
              <Label>Context / instructions (optional)</Label>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Audience, angle, things to avoid, key background..."
                className="min-h-[70px] resize-y text-sm leading-6"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{notes.trim() ? `${notes.trim().split(/\s+/).filter(Boolean).length} words` : "No notes yet"} • saves automatically when you generate</p>
            <Button onClick={() => createDraft(true)} disabled={isCreating} size="lg">
              {isCreating ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate draft
            </Button>
          </div>
        </section>

        {/* Drafts */}
        <section className="glass-panel space-y-4 rounded-lg p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Drafts</h2>
            <span className="text-sm text-muted-foreground">{drafts.length} total</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {drafts.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                isGenerating={generatingId === d.id}
                onGenerate={(instructions, editedPost) => generateForDraft(d, instructions, editedPost)}
                onConfirmFinal={(text) => confirmFinal(d, text)}
                onDelete={() => deleteDraft(d.id)}
                onCopy={copyText}
              />
            ))}
            {!drafts.length ? (
              <div className="glass-tile rounded-lg border-dashed p-8 text-center text-sm text-muted-foreground lg:col-span-2">
                Your drafts will appear here, one per topic.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
};

export default Index;
