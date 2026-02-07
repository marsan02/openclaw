const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Load app registry
const registryPath = path.join(__dirname, '..', 'registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API: Get all apps
app.get('/api/apps', (req, res) => {
  res.json(registry.apps);
});

// API: Get single app
app.get('/api/apps/:id', (req, res) => {
  const app = registry.apps.find(a => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });
  res.json(app);
});

// Dynamically load app API routes
registry.apps.forEach(appDef => {
  const apiPath = path.join(__dirname, '..', 'apps', appDef.id, 'server', 'index.js');
  if (fs.existsSync(apiPath)) {
    try {
      const appRouter = require(apiPath);
      app.use(`/api/${appDef.id}`, appRouter);
      console.log(`✓ Loaded API routes for: ${appDef.id}`);
    } catch (err) {
      console.error(`✗ Failed to load API for ${appDef.id}:`, err.message);
    }
  }
});

// Serve static React app
const staticPath = path.join(__dirname, '..', 'apps', 'marketplace', 'dist');
app.use(express.static(staticPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Marsan Apps running on port ${PORT}`);
  console.log(`📦 ${registry.apps.length} apps registered`);
});
