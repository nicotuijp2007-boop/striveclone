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
