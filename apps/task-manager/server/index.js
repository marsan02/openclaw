const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const router = express.Router();

// ============ Data helpers ============

async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { tasks: [], tags: [] };
  }
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============ Recurrence Logic ============

function shouldResetTask(task) {
  if (!task.recurrence || task.recurrence.type === 'none') return false;
  if (!task.checked) return false; // Already unchecked
  
  const now = new Date();
  const lastReset = task.lastReset ? new Date(task.lastReset) : new Date(0);
  
  // Get today at midnight (start of day)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (task.recurrence.type) {
    case 'daily':
      // Reset if last reset was before today
      return lastReset < todayMidnight;
      
    case 'weekly': {
      // task.recurrence.days = array of day numbers (0=Sun, 1=Mon, etc.)
      const today = now.getDay();
      if (!task.recurrence.days.includes(today)) return false;
      // Reset if last reset was before today
      return lastReset < todayMidnight;
    }
    
    case 'monthly': {
      // task.recurrence.dayOfMonth = day number (1-31)
      const todayDate = now.getDate();
      if (todayDate !== task.recurrence.dayOfMonth) return false;
      return lastReset < todayMidnight;
    }
    
    case 'interval': {
      // task.recurrence.intervalDays = number of days
      const daysSinceReset = Math.floor((todayMidnight - lastReset) / (1000 * 60 * 60 * 24));
      return daysSinceReset >= task.recurrence.intervalDays;
    }
    
    default:
      return false;
  }
}

function processRecurringTasks(tasks) {
  let changed = false;
  const now = new Date().toISOString();
  
  for (const task of tasks) {
    if (shouldResetTask(task)) {
      task.checked = false;
      task.lastReset = now;
      changed = true;
    }
  }
  
  return changed;
}

// ============ Routes ============

// GET /tasks - List all tasks (with auto-reset)
router.get('/tasks', async (req, res) => {
  try {
    const data = await readData();
    
    // Process recurring task resets
    if (processRecurringTasks(data.tasks)) {
      await writeData(data);
    }
    
    // Sort: unchecked first, then by order
    const sorted = [...data.tasks].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return (a.order || 0) - (b.order || 0);
    });
    
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tags - List all tags
router.get('/tags', async (req, res) => {
  try {
    const data = await readData();
    // Extract unique tags from all tasks
    const tags = [...new Set(data.tasks.flatMap(t => t.tags || []))];
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tasks - Create task
router.post('/tasks', async (req, res) => {
  try {
    const { name, tags, dueDate, recurrence } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }
    
    const data = await readData();
    const maxOrder = Math.max(0, ...data.tasks.map(t => t.order || 0));
    
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      checked: false,
      tags: tags || [],
      dueDate: dueDate || null,
      recurrence: recurrence || { type: 'none' },
      lastReset: new Date().toISOString(),
      order: maxOrder + 1,
      createdAt: new Date().toISOString()
    };
    
    data.tasks.push(task);
    await writeData(data);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /tasks/:id - Update task
router.patch('/tasks/:id', async (req, res) => {
  try {
    const data = await readData();
    const task = data.tasks.find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const { name, checked, tags, dueDate, recurrence, order } = req.body;
    
    if (name !== undefined) task.name = name;
    if (tags !== undefined) task.tags = tags;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (recurrence !== undefined) task.recurrence = recurrence;
    if (order !== undefined) task.order = order;
    
    // Handle checking - update lastReset for recurring tasks
    if (checked !== undefined) {
      task.checked = checked;
      if (checked && task.recurrence && task.recurrence.type !== 'none') {
        task.lastReset = new Date().toISOString();
      }
    }
    
    await writeData(data);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /tasks/:id - Delete task
router.delete('/tasks/:id', async (req, res) => {
  try {
    const data = await readData();
    const index = data.tasks.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    data.tasks.splice(index, 1);
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tasks/reorder - Reorder tasks
router.post('/tasks/reorder', async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds array required' });
    }
    
    const data = await readData();
    
    // Update order based on position in array
    taskIds.forEach((id, index) => {
      const task = data.tasks.find(t => t.id === id);
      if (task) {
        task.order = index;
      }
    });
    
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Export helpers for testing
module.exports.shouldResetTask = shouldResetTask;
module.exports.processRecurringTasks = processRecurringTasks;
