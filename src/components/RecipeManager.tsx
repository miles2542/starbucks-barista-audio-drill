import { useState, useEffect } from 'react';
import type { Recipe } from '../types/recipe';
import { RotateCcw, Save, Headphones } from 'lucide-react';

interface RecipeManagerProps {
  recipes: Recipe[];
  setRecipes: (recipes: Recipe[]) => void;
  onSelect: (recipe: Recipe) => void;
  onReset: () => void;
}

export function RecipeManager({ recipes, setRecipes, onSelect, onReset }: RecipeManagerProps) {
  const [jsonText, setJsonText] = useState(JSON.stringify(recipes, null, 2));

  useEffect(() => {
    setJsonText(JSON.stringify(recipes, null, 2));
  }, [recipes]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setRecipes(parsed);
      alert('Recipes updated successfully!');
    } catch (e) {
      alert('Invalid JSON format. Please check syntax.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#FFF' }}>
            Recipe Database & JSON Editor
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Manage core training recipes or append future Starbucks recipes in JSON.
          </p>
        </div>

        <button
          onClick={onReset}
          style={{
            padding: '0.6rem 1rem',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RotateCcw size={14} /> Reset 6 Default Recipes
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Recipe Cards List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)' }}>
            Active Recipes ({recipes.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '480px', overflowY: 'auto' }}>
            {recipes.map(r => (
              <div
                key={r.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#FFF' }}>{r.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                    {r.code || r.id} • {r.type.toUpperCase()}
                  </div>
                </div>
                <button
                  onClick={() => onSelect(r)}
                  style={{
                    background: 'rgba(5, 150, 105, 0.15)',
                    color: 'var(--accent-mint)',
                    border: '1px solid var(--accent-mint)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Headphones size={14} /> Listen
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* JSON Code Editor */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)' }}>
            JSON Schema Config
          </h2>
          <textarea 
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            style={{
              flex: 1,
              minHeight: '380px',
              background: 'var(--bg-primary)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              padding: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              borderRadius: '6px',
              resize: 'vertical',
              lineHeight: '1.4'
            }}
          />
          <button
            onClick={handleSave}
            style={{
              padding: '0.75rem',
              background: 'var(--accent-mint)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Save size={16} /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
