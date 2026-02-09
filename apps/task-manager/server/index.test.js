const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = require('./index');
const { shouldResetTask } = require('./index');

const app = express();
app.use(express.json());
app.use('/api', router);

const DATA_FILE = path.join(__dirname, 'data.json');

// Helper to reset data file before each test
async function resetData(data = { tasks: [], tags: [] }) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data));
}

describe('Task Manager API', () => {
  beforeEach(async () => {
    await resetData();
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await fs.unlink(DATA_FILE);
    } catch {}
  });

  // ==================== GET /tasks ====================
  describe('GET /tasks', () => {
    test('returns empty array when no tasks', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('returns tasks sorted by checked status and order', async () => {
      await resetData({
        tasks: [
          { id: '1', name: 'Task 1', checked: true, order: 0, tags: [] },
          { id: '2', name: 'Task 2', checked: false, order: 1, tags: [] },
          { id: '3', name: 'Task 3', checked: false, order: 0, tags: [] },
        ],
        tags: []
      });

      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(3);
      // Unchecked first, then by order
      expect(res.body[0].name).toBe('Task 3'); // unchecked, order 0
      expect(res.body[1].name).toBe('Task 2'); // unchecked, order 1
      expect(res.body[2].name).toBe('Task 1'); // checked
    });
  });

  // ==================== POST /tasks ====================
  describe('POST /tasks', () => {
    test('creates a simple task', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ name: 'Test task' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test task');
      expect(res.body.id).toBeDefined();
      expect(res.body.checked).toBe(false);
      expect(res.body.tags).toEqual([]);
      expect(res.body.recurrence.type).toBe('none');
    });

    test('creates task with tags and due date', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({
          name: 'Task with details',
          tags: ['work', 'urgent'],
          dueDate: '2026-02-15'
        });

      expect(res.status).toBe(200);
      expect(res.body.tags).toEqual(['work', 'urgent']);
      expect(res.body.dueDate).toBe('2026-02-15');
    });

    test('creates recurring task', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({
          name: 'Daily task',
          recurrence: { type: 'daily' }
        });

      expect(res.status).toBe(200);
      expect(res.body.recurrence.type).toBe('daily');
      expect(res.body.lastReset).toBeDefined();
    });

    test('rejects task without name', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name required');
    });
  });

  // ==================== PATCH /tasks/:id ====================
  describe('PATCH /tasks/:id', () => {
    test('updates task name', async () => {
      // Create a task first
      const createRes = await request(app)
        .post('/api/tasks')
        .send({ name: 'Original' });

      const res = await request(app)
        .patch(`/api/tasks/${createRes.body.id}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated');
    });

    test('toggles checked status', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .send({ name: 'Test' });

      const res = await request(app)
        .patch(`/api/tasks/${createRes.body.id}`)
        .send({ checked: true });

      expect(res.status).toBe(200);
      expect(res.body.checked).toBe(true);
    });

    test('returns 404 for non-existent task', async () => {
      const res = await request(app)
        .patch('/api/tasks/nonexistent')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // ==================== DELETE /tasks/:id ====================
  describe('DELETE /tasks/:id', () => {
    test('deletes a task', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .send({ name: 'To delete' });

      const res = await request(app)
        .delete(`/api/tasks/${createRes.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deleted
      const listRes = await request(app).get('/api/tasks');
      expect(listRes.body.length).toBe(0);
    });

    test('returns 404 for non-existent task', async () => {
      const res = await request(app).delete('/api/tasks/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==================== POST /tasks/reorder ====================
  describe('POST /tasks/reorder', () => {
    test('reorders tasks', async () => {
      // Create tasks
      const task1 = await request(app).post('/api/tasks').send({ name: 'Task 1' });
      const task2 = await request(app).post('/api/tasks').send({ name: 'Task 2' });
      const task3 = await request(app).post('/api/tasks').send({ name: 'Task 3' });

      // Reorder: 3, 1, 2
      const res = await request(app)
        .post('/api/tasks/reorder')
        .send({ taskIds: [task3.body.id, task1.body.id, task2.body.id] });

      expect(res.status).toBe(200);

      // Check order
      const listRes = await request(app).get('/api/tasks');
      expect(listRes.body[0].name).toBe('Task 3');
      expect(listRes.body[1].name).toBe('Task 1');
      expect(listRes.body[2].name).toBe('Task 2');
    });

    test('rejects invalid input', async () => {
      const res = await request(app)
        .post('/api/tasks/reorder')
        .send({ taskIds: 'not an array' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== GET /tags ====================
  describe('GET /tags', () => {
    test('returns unique tags from all tasks', async () => {
      await request(app).post('/api/tasks').send({ name: 'Task 1', tags: ['work', 'urgent'] });
      await request(app).post('/api/tasks').send({ name: 'Task 2', tags: ['work', 'home'] });

      const res = await request(app).get('/api/tags');
      expect(res.status).toBe(200);
      expect(res.body.sort()).toEqual(['home', 'urgent', 'work']);
    });
  });
});

// ==================== Recurrence Logic ====================
describe('Recurrence Logic', () => {
  test('shouldResetTask returns false for non-recurring task', () => {
    const task = {
      checked: true,
      recurrence: { type: 'none' }
    };
    expect(shouldResetTask(task)).toBe(false);
  });

  test('shouldResetTask returns false for unchecked task', () => {
    const task = {
      checked: false,
      recurrence: { type: 'daily' }
    };
    expect(shouldResetTask(task)).toBe(false);
  });

  test('shouldResetTask returns true for daily task reset yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const task = {
      checked: true,
      recurrence: { type: 'daily' },
      lastReset: yesterday.toISOString()
    };
    expect(shouldResetTask(task)).toBe(true);
  });

  test('shouldResetTask returns false for daily task reset today', () => {
    const task = {
      checked: true,
      recurrence: { type: 'daily' },
      lastReset: new Date().toISOString()
    };
    expect(shouldResetTask(task)).toBe(false);
  });

  test('shouldResetTask handles weekly recurrence', () => {
    const today = new Date().getDay();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const task = {
      checked: true,
      recurrence: { type: 'weekly', days: [today] },
      lastReset: yesterday.toISOString()
    };
    expect(shouldResetTask(task)).toBe(true);
  });

  test('shouldResetTask returns false for wrong day of week', () => {
    const today = new Date().getDay();
    const wrongDay = (today + 1) % 7;
    
    const task = {
      checked: true,
      recurrence: { type: 'weekly', days: [wrongDay] },
      lastReset: new Date(0).toISOString()
    };
    expect(shouldResetTask(task)).toBe(false);
  });

  test('shouldResetTask handles interval recurrence', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const task = {
      checked: true,
      recurrence: { type: 'interval', intervalDays: 2 },
      lastReset: threeDaysAgo.toISOString()
    };
    expect(shouldResetTask(task)).toBe(true);
  });
});
