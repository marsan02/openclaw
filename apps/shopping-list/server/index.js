const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const router = express.Router();

// Initialize data file if it doesn't exist
async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ lists: { default: { name: 'My List', items: [] } } }));
  }
}

async function readData() {
  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all lists
router.get('/lists', async (req, res) => {
  const data = await readData();
  res.json(Object.entries(data.lists).map(([id, list]) => ({
    id,
    name: list.name,
    itemCount: list.items.length,
    checkedCount: list.items.filter(i => i.checked).length
  })));
});

// Get a specific list
router.get('/lists/:id', async (req, res) => {
  const data = await readData();
  const list = data.lists[req.params.id];
  if (!list) {
    return res.status(404).json({ error: 'List not found' });
  }
  res.json({ id: req.params.id, ...list });
});

// Create a new list
router.post('/lists', async (req, res) => {
  const { name } = req.body;
  const data = await readData();
  const id = Date.now().toString(36);
  data.lists[id] = { name: name || 'New List', items: [] };
  await writeData(data);
  res.json({ id, name: data.lists[id].name, items: [] });
});

// Delete a list
router.delete('/lists/:id', async (req, res) => {
  const data = await readData();
  if (!data.lists[req.params.id]) {
    return res.status(404).json({ error: 'List not found' });
  }
  delete data.lists[req.params.id];
  await writeData(data);
  res.json({ success: true });
});

// Add item to list
router.post('/lists/:id/items', async (req, res) => {
  const { name, category } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Item name required' });
  }
  const data = await readData();
  const list = data.lists[req.params.id];
  if (!list) {
    return res.status(404).json({ error: 'List not found' });
  }
  const item = {
    id: Date.now().toString(36),
    name,
    category: category || '📦 Other',
    checked: false,
    createdAt: new Date().toISOString()
  };
  list.items.push(item);
  await writeData(data);
  res.json(item);
});

// Update item (toggle checked, rename)
router.patch('/lists/:listId/items/:itemId', async (req, res) => {
  const { listId, itemId } = req.params;
  const { checked, name, category } = req.body;
  
  const data = await readData();
  const list = data.lists[listId];
  if (!list) {
    return res.status(404).json({ error: 'List not found' });
  }
  
  const item = list.items.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  if (typeof checked === 'boolean') item.checked = checked;
  if (name) item.name = name;
  if (category) item.category = category;
  
  await writeData(data);
  res.json(item);
});

// Delete item
router.delete('/lists/:listId/items/:itemId', async (req, res) => {
  const { listId, itemId } = req.params;
  
  const data = await readData();
  const list = data.lists[listId];
  if (!list) {
    return res.status(404).json({ error: 'List not found' });
  }
  
  list.items = list.items.filter(i => i.id !== itemId);
  await writeData(data);
  res.json({ success: true });
});

// Clear checked items
router.post('/lists/:id/clear-checked', async (req, res) => {
  const data = await readData();
  const list = data.lists[req.params.id];
  if (!list) {
    return res.status(404).json({ error: 'List not found' });
  }
  list.items = list.items.filter(i => !i.checked);
  await writeData(data);
  res.json({ success: true, remaining: list.items.length });
});

module.exports = router;
