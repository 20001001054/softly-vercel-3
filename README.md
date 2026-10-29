# Softly

A calm, bright wellbeing app: gentle check-ins, mood log, calm games, weekly summary and **Jing**, an AI companion.

```
public/index.html   the whole app
api/chat.js         serverless function that talks to Gemini (key stays on the server)
```

## Deploy on Vercel

1. Create a **new** key at https://aistudio.google.com/apikey (never paste keys in chat or in code).
2. Push this folder to a GitHub repo, then in Vercel: Add New > Project > import the repo. No build settings are needed.
3. Before deploying (or afterwards, then Redeploy), open Project > Settings > Environment Variables and add:
   - `GEMINI_API_KEY` = your key
4. Open the site, go to the Talk tab and say hi to Jing.

Or with the CLI: `npm i -g vercel`, then `vercel` and `vercel env add GEMINI_API_KEY`, then `vercel --prod`.

## Local testing

`vercel dev` (needs a `.env.local` copied from `.env.example`).

## Notes

- Jing, the AI quotes, check-in thoughts, weekly reflection and jar ideas all use `/api/chat`.
- Mood log, jar and chat history stay in the browser (localStorage); nothing is stored on a server.
- The anonymous encouragement wall needs a shared database and only runs inside Claude. On Vercel it is hidden/disabled until you add one (Vercel KV or Supabase).
- The rate limit in `api/chat.js` is per warm instance. For heavier traffic add Upstash rate limiting.
- Helpline numbers in the support sheet should be checked by you before public launch.
- Softly is not a medical service or a replacement for therapy.
