import { useState, useEffect } from 'react';

const CATEGORIES = ['🥬 Produce', '🥛 Dairy', '🥩 Meat', '🍞 Bakery', '🥫 Pantry', '❄️ Frozen', '🧴 Household', '📦 Other'];

export default function ShoppingList() {
  const [lists, setLists] = useState([]);
  const [currentList, setCurrentList] = useState(null);
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [loading, setLoading] = useState(true);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');

  // Fetch all lists
  useEffect(() => {
    fetchLists();
  }, []);

  // Fetch items when list changes
  useEffect(() => {
    if (currentList) {
      fetchItems(currentList);
    }
  }, [currentList]);

  const fetchLists = async () => {
    try {
      const res = await fetch('/api/shopping-list/lists');
      const data = await res.json();
      setLists(data);
      if (data.length > 0 && !currentList) {
        setCurrentList(data[0].id);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
      setLoading(false);
    }
  };

  const fetchItems = async (listId) => {
    try {
      const res = await fetch(`/api/shopping-list/lists/${listId}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.trim() || !currentList) return;

    try {
      const res = await fetch(`/api/shopping-list/lists/${currentList}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItem.trim(), category: newCategory })
      });
      const item = await res.json();
      setItems([...items, item]);
      setNewItem('');
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  const toggleItem = async (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    try {
      await fetch(`/api/shopping-list/lists/${currentList}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: !item.checked })
      });
      setItems(items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i));
    } catch (err) {
      console.error('Failed to toggle item:', err);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await fetch(`/api/shopping-list/lists/${currentList}/items/${itemId}`, {
        method: 'DELETE'
      });
      setItems(items.filter(i => i.id !== itemId));
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const clearChecked = async () => {
    try {
      await fetch(`/api/shopping-list/lists/${currentList}/clear-checked`, {
        method: 'POST'
      });
      setItems(items.filter(i => !i.checked));
    } catch (err) {
      console.error('Failed to clear checked:', err);
    }
  };

  const createList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await fetch('/api/shopping-list/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() })
      });
      const list = await res.json();
      setLists([...lists, { id: list.id, name: list.name, itemCount: 0, checkedCount: 0 }]);
      setCurrentList(list.id);
      setNewListName('');
      setShowNewList(false);
    } catch (err) {
      console.error('Failed to create list:', err);
    }
  };

  const deleteList = async (listId) => {
    if (!confirm('Delete this list?')) return;
    try {
      await fetch(`/api/shopping-list/lists/${listId}`, { method: 'DELETE' });
      const newLists = lists.filter(l => l.id !== listId);
      setLists(newLists);
      if (currentList === listId) {
        setCurrentList(newLists[0]?.id || null);
      }
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || '📦 Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const uncheckedCount = items.filter(i => !i.checked).length;
  const checkedCount = items.filter(i => i.checked).length;

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    </div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* List selector */}
      <div className="mb-6 flex gap-2 flex-wrap items-center">
        {lists.map(list => (
          <div key={list.id} className="relative group">
            <button
              onClick={() => setCurrentList(list.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentList === list.id
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {list.name}
            </button>
            {lists.length > 1 && (
              <button
                onClick={() => deleteList(list.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setShowNewList(true)}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
        >
          + New List
        </button>
      </div>

      {/* New list form */}
      {showNewList && (
        <form onSubmit={createList} className="mb-6 flex gap-2">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="List name..."
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
            autoFocus
          />
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Create
          </button>
          <button type="button" onClick={() => setShowNewList(false)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
            Cancel
          </button>
        </form>
      )}

      {currentList && (
        <>
          {/* Add item form */}
          <form onSubmit={addItem} className="mb-6 flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add item..."
              className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg bg-white text-gray-900 placeholder-gray-400"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white text-gray-900"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Add
            </button>
          </form>

          {/* Stats */}
          <div className="mb-4 flex justify-between items-center text-sm text-gray-600">
            <span>{uncheckedCount} items to get</span>
            {checkedCount > 0 && (
              <button
                onClick={clearChecked}
                className="text-red-600 hover:text-red-700"
              >
                Clear {checkedCount} checked
              </button>
            )}
          </div>

          {/* Items by category */}
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-2">🛒</p>
              <p>Your list is empty</p>
              <p className="text-sm">Add some items above!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([category, catItems]) => (
                <div key={category}>
                  <h3 className="font-medium text-gray-700 mb-2">{category}</h3>
                  <div className="space-y-2">
                    {catItems.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 bg-white rounded-lg border transition-all ${
                          item.checked ? 'opacity-50' : ''
                        }`}
                      >
                        <button
                          onClick={() => toggleItem(item.id)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            item.checked
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {item.checked && '✓'}
                        </button>
                        <span className={`flex-1 ${item.checked ? 'line-through text-gray-400' : ''}`}>
                          {item.name}
                        </span>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
