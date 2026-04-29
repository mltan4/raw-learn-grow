import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Archive,
  CalendarClock,
  Check,
  Clipboard,
  Github,
  Loader2,
  LogOut,
  Mail,
  PenLine,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type DraftAngle = "insight" | "story" | "tactical";
type Draft = {
  id: string;
  note_id: string | null;
  angle: DraftAngle;
  title: string;
  content: string;
  word_count: number;
  tags: string[];
  quality_flags: string[];
  is_selected: boolean;
  created_at: string;
};
type ScheduledPost = {
  id: string;
  draft_id: string | null;
  scheduled_for: string;
  timezone: string;
  status: "scheduled" | "reminded" | "snoozed" | "posted";
  copy_snapshot: string;
  tags: string[];
  reminder_sent_at: string | null;
  follow_up_sent_at: string | null;
  created_at: string;
};
type Profile = {
  timezone: string;
  default_reminder_time: string;
  raw_mode_default: boolean;
  email: string | null;
};

type NoteSource = "manual" | "lovable" | "github";

const angleLabels: Record<DraftAngle, string> = {
  insight: "Insight-first",
  story: "Story / what happened",
  tactical: "Tactical / how-to",
};

const tagOptions = ["experiments", "failures", "observations", "half-baked ideas", "prompting", "workflows", "mistakes", "tools"];

const currentProjectSeed = `Source: current Lovable writing-studio project
Goal: build a private app that turns rough Lovable project notes, prompts, failures, observations, and half-baked ideas into honest draft posts.
What changed: the app now has auth, rough notes, raw mode, AI-generated angles, scheduling, queue, archive, tags, and preference signals.
Useful tension: the first version is functional, but the real value depends on importing messier source material from actual builds instead of writing polished notes after the fact.
Potential post angle: how the source material matters more than the final AI prompt. If the notes hide the failure, the generated post becomes generic.`;

const nextPostingDate = (day: "monday" | "wednesday" | "thursday", time: string) => {
  const target = { monday: 1, wednesday: 3, thursday: 4 }[day];
  const date = new Date();
  const delta = (target - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours || 9, minutes || 0, 0, 0);
  return date;
};

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

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
  });
  const [notes, setNotes] = useState("");
  const [noteSource, setNoteSource] = useState<NoteSource>("manual");
  const [rawMode, setRawMode] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [scheduleDay, setScheduleDay] = useState<"monday" | "wednesday" | "thursday">("monday");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [tagFilter, setTagFilter] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [githubHandle, setGithubHandle] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [isImportingSource, setIsImportingSource] = useState(false);

  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null;

  const selectedPatterns = useMemo(() => {
    const selected = drafts.filter((draft) => draft.is_selected).slice(0, 6);
    return selected.map((draft) => `${angleLabels[draft.angle]} selected: ${draft.title}`);
  }, [drafts]);

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
    };

    const { data: profileRow } = await client.from("profiles").select("*").eq("user_id", currentUser.id).maybeSingle();
    if (!profileRow) {
      await client.from("profiles").insert(defaultProfile);
      setProfile(defaultProfile);
      setScheduleTime(defaultProfile.default_reminder_time);
      setRawMode(defaultProfile.raw_mode_default);
    } else {
      setProfile(profileRow);
      setScheduleTime(profileRow.default_reminder_time?.slice(0, 5) || "09:00");
      setRawMode(profileRow.raw_mode_default ?? false);
    }

    const [{ data: draftRows }, { data: queueRows }] = await Promise.all([
      client.from("post_drafts").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }).limit(30),
      client.from("scheduled_posts").select("*").eq("user_id", currentUser.id).order("scheduled_for", { ascending: true }).limit(30),
    ]);
    setDrafts(draftRows ?? []);
    setScheduled(queueRows ?? []);
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

  const saveSettings = async () => {
    if (!user) return;
    const client = supabase as any;
    const nextProfile = { ...profile, default_reminder_time: scheduleTime, raw_mode_default: rawMode };
    const { error } = await client.from("profiles").update(nextProfile).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else {
      setProfile(nextProfile);
      toast.success("Settings saved.");
    }
  };

  const useCurrentLovableProject = () => {
    setNoteSource("lovable");
    setNotes((current) => (current.trim() ? `${current.trim()}\n\n---\n\n${currentProjectSeed}` : currentProjectSeed));
    toast.success("Added current Lovable project context.");
  };

  const importGitHubActivity = async () => {
    const handle = githubHandle.trim().replace(/^@/, "");
    const repo = githubRepo.trim();
    if (!handle) {
      toast.error("Add a GitHub username first.");
      return;
    }

    setIsImportingSource(true);
    try {
      const [eventsResponse, reposResponse] = await Promise.all([
        fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/events/public?per_page=20`),
        repo ? Promise.resolve(null) : fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/repos?sort=updated&per_page=8`),
      ]);

      if (!eventsResponse.ok) throw new Error(eventsResponse.status === 404 ? "GitHub user not found." : "Could not read public GitHub activity.");
      const events = await eventsResponse.json();
      const repos = reposResponse && reposResponse.ok ? await reposResponse.json() : [];

      let repoDetails = null;
      if (repo) {
        const repoResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(handle)}/${encodeURIComponent(repo)}`);
        if (repoResponse.ok) repoDetails = await repoResponse.json();
      }

      const eventLines = events.slice(0, 10).map((event: any) => {
        const commitMessages = event.payload?.commits?.slice(0, 3).map((commit: any) => commit.message).join(" | ");
        const issueTitle = event.payload?.issue?.title || event.payload?.pull_request?.title;
        return `- ${event.type.replace("Event", "")} in ${event.repo?.name || "unknown repo"}${issueTitle ? `: ${issueTitle}` : ""}${commitMessages ? `: ${commitMessages}` : ""}`;
      });

      const repoLines = repoDetails
        ? [`Repo focus: ${repoDetails.full_name}`, `Description: ${repoDetails.description || "No description"}`, `Language: ${repoDetails.language || "unknown"}`, `Updated: ${repoDetails.updated_at}`]
        : repos.slice(0, 6).map((item: any) => `- ${item.full_name}: ${item.description || "No description"} (${item.language || "unknown"})`);

      const imported = `Source: public GitHub activity for @${handle}${repo ? ` / ${repo}` : ""}
What this might reveal: build decisions, abandoned ideas, small fixes, commits that hint at what broke.

${repo ? "Repository context" : "Recently updated repositories"}:
${repoLines.join("\n") || "No public repositories found."}

Recent public activity:
${eventLines.join("\n") || "No recent public activity found."}

Drafting instruction: turn this into rough notes first. Look for a specific change, failure, tradeoff, or workflow lesson. Do not make it sound like a polished launch update.`;

      setNoteSource("github");
      setNotes((current) => (current.trim() ? `${current.trim()}\n\n---\n\n${imported}` : imported));
      toast.success("Imported public GitHub context.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub import failed.");
    } finally {
      setIsImportingSource(false);
    }
  };

  const generateDrafts = async (regenerateAngle?: DraftAngle) => {
    if (!user || notes.trim().length < 20) {
      toast.error("Add a few more real notes first.");
      return;
    }
    setIsGenerating(true);
    const client = supabase as any;
    const { data: note, error: noteError } = await client
      .from("writing_notes")
      .insert({ user_id: user.id, content: notes.trim(), raw_mode: rawMode, source: noteSource })
      .select("id")
      .single();

    if (noteError) {
      setIsGenerating(false);
      toast.error(noteError.message);
      return;
    }

    const { data, error } = await supabase.functions.invoke("generate-drafts", {
      body: { noteId: note.id, notes: notes.trim(), rawMode, selectedPatterns, regenerateAngle },
    });
    setIsGenerating(false);

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Draft generation failed.");
      return;
    }

    const nextDrafts = data.drafts ?? [];
    setDrafts((current) => [...nextDrafts, ...current]);
    setSelectedDraftId(nextDrafts[0]?.id ?? null);
    toast.success(regenerateAngle ? "Draft regenerated." : "Three draft angles generated.");
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied.");
  };

  const toggleTag = (tag: string) => {
    if (!selectedDraft) return;
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === selectedDraft.id
          ? { ...draft, tags: draft.tags.includes(tag) ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag] }
          : draft,
      ),
    );
  };

  const selectDraft = async (draft: Draft) => {
    if (!user) return;
    const client = supabase as any;
    await client.from("post_drafts").update({ is_selected: false }).eq("user_id", user.id).eq("note_id", draft.note_id);
    const { error } = await client.from("post_drafts").update({ is_selected: true, selected_at: new Date().toISOString() }).eq("id", draft.id);
    await client.from("preference_signals").insert({ user_id: user.id, draft_id: draft.id, signal_type: "selected", angle: draft.angle });
    if (error) toast.error(error.message);
    else {
      setSelectedDraftId(draft.id);
      setDrafts((current) => current.map((item) => ({ ...item, is_selected: item.id === draft.id ? true : item.is_selected })));
      toast.success("Draft selected.");
    }
  };

  const scheduleSelectedDraft = async () => {
    if (!user || !selectedDraft) return;
    const scheduledFor = nextPostingDate(scheduleDay, scheduleTime);
    const client = supabase as any;
    const { data, error } = await client
      .from("scheduled_posts")
      .insert({
        user_id: user.id,
        draft_id: selectedDraft.id,
        note_id: selectedDraft.note_id,
        scheduled_for: scheduledFor.toISOString(),
        timezone: profile.timezone,
        copy_snapshot: selectedDraft.content,
        tags: selectedDraft.tags,
      })
      .select("*")
      .single();

    if (error) toast.error(error.message);
    else {
      setScheduled((current) => [...current, data].sort((a, b) => +new Date(a.scheduled_for) - +new Date(b.scheduled_for)));
      toast.success(`Scheduled for ${format(scheduledFor, "EEE, MMM d 'at' h:mm a")}.`);
    }
  };

  const updatePostStatus = async (post: ScheduledPost, status: ScheduledPost["status"]) => {
    const client = supabase as any;
    const patch = status === "posted" ? { status, posted_at: new Date().toISOString() } : { status };
    const { error } = await client.from("scheduled_posts").update(patch).eq("id", post.id);
    if (error) toast.error(error.message);
    else setScheduled((current) => current.map((item) => (item.id === post.id ? { ...item, ...patch } : item)));
  };

  const snoozePost = async (post: ScheduledPost) => {
    const next = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const client = supabase as any;
    const { error } = await client.from("scheduled_posts").update({ status: "snoozed", snoozed_until: next, scheduled_for: next }).eq("id", post.id);
    if (error) toast.error(error.message);
    else setScheduled((current) => current.map((item) => (item.id === post.id ? { ...item, status: "snoozed", scheduled_for: next } : item)));
  };

  const filteredDrafts = drafts.filter((draft) => tagFilter === "all" || draft.tags.includes(tagFilter));
  const upcomingPosts = scheduled.filter((post) => post.status !== "posted");
  const postedPosts = scheduled.filter((post) => post.status === "posted");

  if (!user) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 text-foreground">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-6">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">Private writing studio</Badge>
            <h1 className="text-4xl font-semibold tracking-normal text-foreground">Turn rough AI build notes into honest posts.</h1>
            <p className="text-base leading-7 text-muted-foreground">Sign in to store drafts, schedule reminders, and keep a record of what actually happened.</p>
          </div>
          <Card className="rounded-lg border-border/80 shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} type="password" placeholder="At least 6 characters" />
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">AI build notes</Badge>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-5xl">Writing studio</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Experiments, failures, observations, half-baked ideas. Specifics first. Polish later.</p>
          </div>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()} className="w-fit"><LogOut /> Sign out</Button>
        </header>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-medium">Rough notes</h2>
              <p className="text-sm text-muted-foreground">Paste directly from a Lovable project or your scratchpad.</p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <Label htmlFor="raw-mode" className="text-sm">Make it more raw</Label>
              <Switch id="raw-mode" checked={rawMode} onCheckedChange={setRawMode} />
            </div>
          </div>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What I tried... what broke... the weird workaround... the part that changed my mind..."
            className="min-h-[220px] resize-y rounded-lg bg-card text-base leading-7"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{wordCount(notes)} words in notes</p>
            <Button onClick={() => generateDrafts()} disabled={isGenerating} size="lg" className="w-full sm:w-fit">
              {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate 3 drafts
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Draft options</h2>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tagOptions.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {filteredDrafts.slice(0, 9).map((draft) => (
              <Card key={draft.id} className={`rounded-lg border-border bg-card shadow-sm ${selectedDraftId === draft.id ? "ring-2 ring-primary" : ""}`}>
                <CardHeader className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline">{angleLabels[draft.angle]}</Badge>
                      <CardTitle className="mt-3 text-lg leading-6">{draft.title}</CardTitle>
                    </div>
                    {selectedDraftId === draft.id ? <Check className="mt-1 text-primary" /> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{draft.word_count} words</p>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0">
                  <p className="whitespace-pre-line text-sm leading-6">{draft.content}</p>
                  <div className="flex flex-wrap gap-2">
                    {draft.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                    {draft.quality_flags.map((flag) => <Badge key={flag} variant="outline">{flag}</Badge>)}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="secondary" size="sm" onClick={() => selectDraft(draft)}>Select</Button>
                    <Button variant="outline" size="sm" onClick={() => copyText(draft.content)}><Clipboard /></Button>
                    <Button variant="outline" size="sm" onClick={() => generateDrafts(draft.angle)}><RefreshCw /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!filteredDrafts.length ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground lg:col-span-3">Generated drafts will appear here.</div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-lg border-border shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><CalendarClock /> Select and schedule</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {selectedDraft ? (
                <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-4">
                  <p className="text-sm font-medium">{selectedDraft.title}</p>
                  <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{selectedDraft.content}</p>
                  <div className="flex flex-wrap gap-2">
                    {tagOptions.map((tag) => (
                      <button key={tag} onClick={() => toggleTag(tag)} className={`rounded-md border px-2 py-1 text-xs transition-colors ${selectedDraft.tags.includes(tag) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{tag}</button>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">Select one draft to schedule it.</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Posting day</Label>
                  <Select value={scheduleDay} onValueChange={(value: any) => setScheduleDay(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reminder time</Label>
                  <Input value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} type="time" />
                </div>
              </div>
              <Button onClick={scheduleSelectedDraft} disabled={!selectedDraft} className="w-full sm:w-fit"><PenLine /> Schedule selected draft</Button>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-border shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Mail /> Reminder settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} />
              </div>
              <p className="text-sm leading-6 text-muted-foreground">Email reminders are ready in the app logic. A sender domain still needs to be connected before they can be delivered.</p>
              <Button variant="outline" onClick={saveSettings}>Save defaults</Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-medium">Upcoming queue</h2>
          <div className="space-y-3">
            {upcomingPosts.map((post) => (
              <Card key={post.id} className="rounded-lg border-border shadow-sm">
                <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{post.status}</Badge>
                      <span className="text-sm text-muted-foreground">{format(new Date(post.scheduled_for), "EEE, MMM d • h:mm a")}</span>
                    </div>
                    <p className="line-clamp-3 text-sm leading-6">{post.copy_snapshot}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 lg:w-72">
                    <Button variant="outline" size="sm" onClick={() => copyText(post.copy_snapshot)}>Copy</Button>
                    <Button variant="secondary" size="sm" onClick={() => updatePostStatus(post, "posted")}>Posted</Button>
                    <Button variant="outline" size="sm" onClick={() => snoozePost(post)}>Snooze</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!upcomingPosts.length ? <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">No upcoming posts yet.</div> : null}
          </div>
        </section>

        <section className="space-y-4 pb-12">
          <h2 className="flex items-center gap-2 text-xl font-medium"><Archive /> Past drafts and posts</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-lg border-border shadow-sm">
              <CardHeader><CardTitle className="text-base">Recent drafts</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {drafts.slice(0, 5).map((draft) => <p key={draft.id} className="border-b border-border pb-3 text-sm leading-6 last:border-0">{draft.title}</p>)}
              </CardContent>
            </Card>
            <Card className="rounded-lg border-border shadow-sm">
              <CardHeader><CardTitle className="text-base">Posted</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {postedPosts.slice(0, 5).map((post) => <p key={post.id} className="border-b border-border pb-3 text-sm leading-6 last:border-0">{post.copy_snapshot}</p>)}
                {!postedPosts.length ? <p className="text-sm text-muted-foreground">Marked-as-posted items will collect here.</p> : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Index;
