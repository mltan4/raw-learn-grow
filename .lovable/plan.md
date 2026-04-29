Build a private, single-user AI writing and scheduling app with a minimal Cloud White, single-column studio interface.

## Product experience

Create one focused page that feels like a calm writing workspace rather than a social media tool:

```text
Rough notes input
Raw mode toggle
Generate drafts

Draft 1: Insight-first
Draft 2: Story / what happened
Draft 3: Tactical / how-to

Selected post scheduler
Upcoming queue
Past drafts + posted archive
Settings
```

Visual direction:
- Cloud White palette: `#fafbfc`, `#e8ecf1`, `#94a3b8`, `#3b82f6`
- Lots of whitespace, soft borders, subtle blue focus states
- Single-column layout optimized for mobile first, with draft cards stacked on small screens and side-by-side on wider screens
- Typography should feel clean and practical, not “creator brand” polished
- Minimal animation: gentle loading states and small transitions only

## Core workflow

1. The user pastes rough notes from Lovable projects into a large input box.
2. They can toggle “Make it more raw”.
3. Clicking Generate creates 3 draft posts:
   - Insight-first
   - Story / what happened
   - Tactical / how-to
4. Each draft follows the target voice:
   - Raw, honest, slightly unpolished
   - Slack/community-message feel
   - No hooks, no LinkedIn tone, no hype
   - 120–250 words
   - Specifics over filler
   - Focus on what broke, what changed, what was learned
5. Draft cards show the angle, word count, draft text, and actions:
   - Select this draft
   - Copy
   - Regenerate this angle
6. After selecting a draft, the user schedules it for Monday, Wednesday, or Thursday, with a default 9am local reminder time.
7. The app stores all generated drafts, selected posts, scheduled posts, and posted history.

## Scheduling and queue

Add a simple queue view for upcoming posts:
- Date and time
- Status: scheduled, reminded, snoozed, posted
- Selected draft preview
- Tags
- Quick actions: copy, mark as posted, snooze, edit schedule

Support the requested weekly rhythm:
- Monday
- Wednesday
- Thursday

Each scheduled day can keep up to 3 generated options, with one selected as the active post.

## Email reminders

Set up app emails for reminder delivery.

Reminder behavior:
- Default reminder time: 9am local
- User can customize the reminder time in settings
- Reminder email includes:
  - Scheduled post preview
  - Link to copy/open the post in the app
  - Mark as posted action
  - Snooze action
- If the post is not marked as posted, send one follow-up later the same day.

Note: email reminders require Lovable Cloud and app email setup. If a sender domain is not already configured, implementation will include the needed email setup flow and may require a domain/DNS step from you.

## AI generation behavior

Use Lovable AI through a backend function, not directly from the browser.

The generation prompt will enforce:
- 3 distinct angles every time
- No generic AI advice
- No obvious “AI is changing everything” takes
- No engagement bait
- No forced opening hooks
- Concrete details from the notes
- Loose structure:
  - What I tried
  - What happened
  - What I learned
  - Optional: what I would do differently

Raw toggle behavior:
- On: shorter sentences, more direct phrasing, less smoothing, incomplete thoughts allowed, failed attempts included
- Off: slightly clearer and easier to read, but still informal and honest

Add visible quality checks in the UI, such as small labels when a draft is too generic, too long, too polished, or missing specifics.

## Archive and tags

Add lightweight organization:
- Past generated drafts
- Selected scheduled posts
- Posted archive
- Tags such as:
  - prompting
  - workflows
  - mistakes
  - tools
  - experiments
  - failures
  - observations
  - half-baked ideas

The user can filter the archive by tag and status.

## Learning from selections

Add a simple preference loop:
- Track which angle the user selects most often
- Track selected drafts and rejected drafts
- Store optional “why I picked this” notes
- Feed recent selection patterns into future generation so the drafts gradually match the user’s taste better

Keep this lightweight and transparent, not a hidden complex training system.

## Technical implementation

- Replace the placeholder homepage with the writing studio UI.
- Add Lovable Cloud database tables for notes, drafts, scheduled posts, tags, reminders, and preference signals.
- Add a secure backend AI function for draft generation using Lovable AI.
- Add scheduled backend logic for daily reminder checks and follow-up reminders.
- Add app email templates for scheduled-post reminders and follow-ups.
- Add action handling for mark-as-posted and snooze from reminder links.
- Store the user’s timezone and default reminder time in settings.
- Render generated post content with clean formatting and copy-to-clipboard actions.

## First implementation target

The first complete version will include:
- Working note input
- Raw toggle
- 3 AI-generated drafts
- Select and schedule flow
- Upcoming queue
- Past drafts/posts archive
- Email reminders with follow-up
- Basic tags
- Lightweight preference learning from selected drafts