import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ListenMode } from './components/ListenMode';
import { QuizMode } from './components/QuizMode';
import { SRSDashboard } from './components/SRSDashboard';
import { SettingsModal } from './components/SettingsModal';
import type { Recipe } from './types/recipe';
import { SRSEngine } from './services/srsEngine';
import initialRecipes from './data/recipes.json';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('quiz');
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('starbucks_recipes_v6');
    if (!saved) return initialRecipes as Recipe[];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length < (initialRecipes as Recipe[]).length || !parsed.some(r => r.id === 'cfie-iced')) {
        return initialRecipes as Recipe[];
      }
      return parsed;
    } catch {
      return initialRecipes as Recipe[];
    }
  });

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(recipes[0] || null);

  useEffect(() => {
    localStorage.setItem('starbucks_recipes_v6', JSON.stringify(recipes));
  }, [recipes]);

  useEffect(() => {
    const cleanup = SRSEngine.initAutoSync();
    const handleSyncUpdate = () => {
      // Trigger a re-render or handle UI updates if necessary.
      // Currently, SRSEngine manages its own state and next drills fetch it directly.
    };
    window.addEventListener('starbucks_srs_sync_updated', handleSyncUpdate);
    return () => {
      window.removeEventListener('starbucks_srs_sync_updated', handleSyncUpdate);
      if (cleanup) cleanup();
    };
  }, []);

  const dueCount = SRSEngine.getDueItems(recipes).length;

  const handleResetRecipes = () => {
    setRecipes(initialRecipes as Recipe[]);
    localStorage.setItem('starbucks_recipes_v6', JSON.stringify(initialRecipes));
    setSelectedRecipe((initialRecipes as Recipe[])[0]);
  };

  const versionText = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.7.2';
  const commitText = typeof __GIT_COMMIT_HASH__ !== 'undefined' ? __GIT_COMMIT_HASH__ : 'dev';

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} dueCount={dueCount} />
      
      <main className="main-content">
        {activeTab === 'quiz' && <QuizMode recipes={recipes} onComplete={() => setActiveTab('recipes')} />}
        {activeTab === 'srs' && <SRSDashboard recipes={recipes} />}
        {activeTab === 'recipes' && <ListenMode recipe={selectedRecipe || recipes[0]} recipes={recipes} onSelectRecipe={setSelectedRecipe} />}
        {activeTab === 'settings' && <SettingsModal onResetRecipes={handleResetRecipes} />}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '0.85rem 1rem',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        fontFamily: 'monospace'
      }}>
        Starbucks Recipe SRS v{versionText} ({commitText})
      </footer>
    </div>
  );
}

export default App;
