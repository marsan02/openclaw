import { useState, useEffect, useRef } from 'react';

const API_BASE = '/api/task-manager';

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'interval', label: 'Every X days' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TaskManager() {
  const [tasks, setTasks] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTag, setFilterTag] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formRecurrence, setFormRecurrence] = useState('none');
  const [formWeeklyDays, setFormWeeklyDays] = useState([]);
  const [formIntervalDays, setFormIntervalDays] = useState(2);

  useEffect(() => {
    fetchTasks();
    fetchTags();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch(`${API_BASE}/tags`);
      const data = await res.json();
      setTags(data);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormTags('');
    setFormDueDate('');
    setFormRecurrence('none');
    setFormWeeklyDays([]);
    setFormIntervalDays(2);
    setEditingTask(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const openEditForm = (task) => {
    setFormName(task.name);
    setFormTags((task.tags || []).join(', '));
    setFormDueDate(task.dueDate || '');
    setFormRecurrence(task.recurrence?.type || 'none');
    setFormWeeklyDays(task.recurrence?.days || []);
    setFormIntervalDays(task.recurrence?.intervalDays || 2);
    setEditingTask(task);
    setShowAddForm(true);
  };

  const buildRecurrence = () => {
    switch (formRecurrence) {
      case 'daily':
        return { type: 'daily' };
      case 'weekly':
        return { type: 'weekly', days: formWeeklyDays };
      case 'interval':
        return { type: 'interval', intervalDays: formIntervalDays };
      default:
        return { type: 'none' };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const taskData = {
      name: formName.trim(),
      tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
      dueDate: formDueDate || null,
      recurrence: buildRecurrence()
    };

    try {
      if (editingTask) {
        const res = await fetch(`${API_BASE}/tasks/${editingTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
        const updated = await res.json();
        setTasks(tasks.map(t => t.id === updated.id ? updated : t));
      } else {
        const res = await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
        const task = await res.json();
        setTasks([...tasks, task]);
      }
      setShowAddForm(false);
      resetForm();
      fetchTags();
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  };

  const toggleTask = async (task) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: !task.checked })
      });
      const updated = await res.json();
      setTasks(tasks.map(t => t.id === updated.id ? updated : t));
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== taskId));
      fetchTags();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetTask) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.id === targetTask.id) return;

    const uncheckedTasks = tasks.filter(t => !t.checked);
    const checkedTasks = tasks.filter(t => t.checked);
    
    // Only reorder within unchecked tasks
    if (draggedTask.checked || targetTask.checked) {
      setDraggedTask(null);
      return;
    }

    const dragIndex = uncheckedTasks.findIndex(t => t.id === draggedTask.id);
    const targetIndex = uncheckedTasks.findIndex(t => t.id === targetTask.id);
    
    const newUnchecked = [...uncheckedTasks];
    newUnchecked.splice(dragIndex, 1);
    newUnchecked.splice(targetIndex, 0, draggedTask);
    
    const newTasks = [...newUnchecked, ...checkedTasks];
    setTasks(newTasks);
    setDraggedTask(null);

    // Persist order
    try {
      await fetch(`${API_BASE}/tasks/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: newUnchecked.map(t => t.id) })
      });
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  // Filter tasks
  const filteredTasks = filterTag
    ? tasks.filter(t => t.tags?.includes(filterTag))
    : tasks;

  const uncheckedTasks = filteredTasks.filter(t => !t.checked);
  const checkedTasks = filteredTasks.filter(t => t.checked);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterTag(null)}
            className={`px-3 py-1 rounded-full text-sm ${
              !filterTag ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            All
          </button>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterTag === tag ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <button
          onClick={openAddForm}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          + Add Task
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editingTask ? 'Edit Task' : 'New Task'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 placeholder-gray-400"
                  placeholder="What needs to be done?"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 placeholder-gray-400"
                  placeholder="work, home, urgent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
                <select
                  value={formRecurrence}
                  onChange={(e) => setFormRecurrence(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900"
                >
                  {RECURRENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {formRecurrence === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Which days?</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day, i) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setFormWeeklyDays(prev =>
                            prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                          );
                        }}
                        className={`px-3 py-1 rounded-full text-sm ${
                          formWeeklyDays.includes(i)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formRecurrence === 'interval' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Every how many days?</label>
                  <input
                    type="number"
                    min="1"
                    value={formIntervalDays}
                    onChange={(e) => setFormIntervalDays(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  {editingTask ? 'Save Changes' : 'Add Task'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); resetForm(); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-2">✅</p>
          <p>No tasks yet</p>
          <p className="text-sm">Click "Add Task" to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Unchecked tasks (draggable) */}
          {uncheckedTasks.map(task => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e, task)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, task)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 p-4 bg-white rounded-lg border cursor-move transition-all ${
                draggedTask?.id === task.id ? 'opacity-50 border-indigo-400' : ''
              }`}
            >
              <button
                onClick={() => toggleTask(task)}
                className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-indigo-500 flex items-center justify-center transition-colors flex-shrink-0"
              >
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate text-gray-900">{task.name}</span>
                  {task.recurrence?.type !== 'none' && (
                    <span title="Recurring" className="text-indigo-600">🔄</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {task.tags?.map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                  {task.dueDate && (
                    <span className="text-xs text-gray-500">📅 {task.dueDate}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => openEditForm(task)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✏️
              </button>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-gray-400 hover:text-red-500 p-1"
              >
                🗑️
              </button>
            </div>
          ))}

          {/* Checked tasks */}
          {checkedTasks.length > 0 && (
            <>
              <div className="text-sm text-gray-500 pt-4 pb-2">Completed</div>
              {checkedTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border opacity-60"
                >
                  <button
                    onClick={() => toggleTask(task)}
                    className="w-6 h-6 rounded-full border-2 bg-indigo-600 border-indigo-600 text-white flex items-center justify-center flex-shrink-0"
                  >
                    ✓
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="line-through text-gray-400 truncate">{task.name}</span>
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
