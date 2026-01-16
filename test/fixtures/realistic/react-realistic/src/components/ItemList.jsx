import React, { useState } from 'react';

function ItemList() {
  const [items, setItems] = useState([
    { id: 1, name: 'Item 1', deletable: true },
    { id: 2, name: 'Item 2', deletable: true },
    { id: 3, name: 'Item 3', deletable: false }, // Cannot be deleted
  ]);

  // PARTIAL/AMBIGUOUS CASE: Delete confirmation (confidence < 1)
  // May or may not work depending on item state
  const handleDelete = (itemId) => {
    const item = items.find(i => i.id === itemId);
    
    if (!item) {
      return;
    }
    
    // Ambiguous case: deletion may or may not work
    // Some items are marked as non-deletable, but the UI doesn't show this clearly
    if (item.deletable) {
      // Sometimes works
      setItems(items.filter(i => i.id !== itemId));
    } else {
      // Sometimes fails silently - no error message, no feedback
      // This creates ambiguity - did it work or not?
      // Should be reported with MEDIUM confidence
    }
  };

  return (
    <div>
      <h1>Item List</h1>
      <p>Manage your items. Some items cannot be deleted (ambiguous behavior).</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map(item => (
          <li
            key={item.id}
            style={{
              padding: '1rem',
              marginBottom: '0.5rem',
              background: '#f8f9fa',
              border: '1px solid #ddd',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>{item.name}</span>
            <button
              onClick={() => handleDelete(item.id)}
              style={{
                padding: '0.5rem 1rem',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      {/* INTENTIONAL: No feedback when deletion fails */}
    </div>
  );
}

export default ItemList;

