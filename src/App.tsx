import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ListenMode } from './components/ListenMode';
import { QuizMode } from './components/QuizMode';
import { RecipeManager } from './components/RecipeManager';
import { SettingsModal } from './components/SettingsModal';
import type { Recipe } from './types/recipe';
import { SRSEngine } from './services/srsEngine';
import initialRecipes from './data/recipes.json';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('quiz');
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('starbucks_recipes_v2');
    if (!saved) return initialRecipes as Recipe[];
    try {
      const parsed = JSON.parse(saved);
      // Auto-migrate if old legacy placeholder recipes (latte / caramel_macchiato)
      if (Array.isArray(parsed) && parsed.some(r => r.id === 'latte' || r.id === 'caramel_macchiato')) {
        return initialRecipes as Recipe[];
      }
      return parsed;
    } catch {
      return initialRecipes as Recipe[];
    }
  });

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(recipes[0] || null);

  useEffect(() => {
    localStorage.setItem('starbucks_recipes_v2', JSON.stringify(recipes));
  }, [recipes]);

  const dueCount = SRSEngine.getDueItems(recipes).length;

  const handleSelectRecipe = (r: Recipe) => {
    setSelectedRecipe(r);
    setActiveTab('listen');
  };

  const handleResetRecipes = () => {
    setRecipes(initialRecipes as Recipe[]);
    localStorage.setItem('starbucks_recipes_v2', JSON.stringify(initialRecipes));
    setSelectedRecipe((initialRecipes as Recipe[])[0]);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} dueCount={dueCount} />
      
      <main style={{ flex: 1, padding: '1.5rem 1rem', maxWidth: '720px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {activeTab === 'listen' && <ListenMode recipe={selectedRecipe || recipes[0]} recipes={recipes} onSelectRecipe={setSelectedRecipe} />}
        {activeTab === 'quiz' && <QuizMode recipes={recipes} onComplete={() => setActiveTab('recipes')} />}
        {activeTab === 'recipes' && <RecipeManager recipes={recipes} setRecipes={setRecipes} onSelect={handleSelectRecipe} onReset={handleResetRecipes} />}
        {activeTab === 'settings' && <SettingsModal onResetRecipes={handleResetRecipes} />}
      </main>
    </div>
  );
}

export default App;
