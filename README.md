# 🤖 Marsan Apps

A quick-deploy platform for spinning up app ideas. Each app has its own frontend (React) and backend (Node/Express), all managed from one place.

## Structure

```
/apps
  /marketplace          → React SPA (the main portal)
  /hello-world
    /server            → Express API routes
  /your-new-app
    /server            → Express API routes
/server                → Main Express server
/registry.json         → App definitions
```

## Adding a New App

1. **Create the app folder:**
   ```bash
   mkdir -p apps/my-app/server
   ```

2. **Create the API** (`apps/my-app/server/index.js`):
   ```javascript
   const express = require('express');
   const router = express.Router();

   router.get('/hello', (req, res) => {
     res.json({ message: 'Hello from my-app!' });
   });

   module.exports = router;
   ```

3. **Register it** in `registry.json`:
   ```json
   {
     "id": "my-app",
     "name": "My App",
     "description": "What it does",
     "icon": "🚀",
     "color": "#10B981",
     "status": "active",
     "hasApi": true,
     "createdAt": "2026-02-07"
   }
   ```

4. **Add frontend component** (optional) in `apps/marketplace/src/apps/MyApp.jsx`

5. **Update Dockerfile** to copy your app's server folder

6. **Push!**
   ```bash
   git add -A && git commit -m "Add my-app" && git push
   ```

## Local Development

```bash
npm install
npm run dev
```

## Deployment

Push to `main` → GitHub Actions → Cloud Run

Live at: https://openclaw-dln66gtk6q-ew.a.run.app
