# Deploying to Vercel

1. Import the repo in the Vercel dashboard. `vercel.json` pins the framework to Next.js, so there are no build settings to change.
2. Add the keys from `.env.example` under **Settings → Environment Variables**. Paste only the value, with no spaces around it.
3. Deploy. If you add or change keys later, **redeploy**: environment variables only reach new deployments.

The KB index is generated at build time (`prebuild`), so the function never reads markdown at runtime. The build needs no keys. With no keys at all, the app still loads and explains that no provider is configured.

After deploying, check it end to end:

```bash
npm run build && npm run check:bundle          # no key value or key pattern in the browser bundle
BASE_URL=https://<deployment> MODEL=gemini-flash-lite EVAL_DELAY_MS=20000 npm run eval
```

Deployment-specific `*-<hash>.vercel.app` URLs sit behind Vercel Authentication; the production domain is public.

## Troubleshooting

**"No Output Directory named 'public' found"** means the Vercel project was created with the "Other" framework preset (for example, imported before `package.json` existed). `vercel.json` forces Next.js. If the error persists, open **Settings → Build & Deployment**, set Framework Preset to **Next.js**, and turn off any Output Directory override.

**"No AI provider is configured on the server"** means no key reached this deployment. Add at least one key and redeploy.
