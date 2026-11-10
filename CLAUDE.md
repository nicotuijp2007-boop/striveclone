# Liftlog: notes for Claude

## Ask before merging to `main`

Netlify deploys the site on every merge to `main`, and we're on the free plan with limited monthly
deploy credits (when they run out, the site is paused until the next month).

- Never push or merge to `main` without asking the user first.
- When asking, remind them that a merge uses deploy credits on the free Netlify plan.

## One session per substantial task

Long conversations use up context and lead to worse results, so start fresh instead of stretching an old one.

- When the user asks for a separate, substantial task and this conversation already finished another one, say so and
  suggest starting a new chat. Give a short handoff (2-5 lines: the goal, the relevant files or material, open
  decisions) they can paste into the new chat.
- Small follow-ups on the current task are fine to continue in the same conversation.
- The user decides. If they say continue, continue without asking again.
- If the conversation is getting long or earlier details are slipping, say so and suggest a fresh start with a handoff.

## Keep requests specific

Specific requests get better results; vague ones waste effort on irrelevant files and topics.

- If a request is vague (no clear goal, scope or definition of done), don't start a broad search. Ask one short
  question, or state the narrow interpretation you'll take and what you'll look at, then proceed.
- Only explore what the task needs. Don't read or summarize files and topics the user didn't ask about.
- When it helps, show the user a sharper version of their request so they can phrase the next one that way.
