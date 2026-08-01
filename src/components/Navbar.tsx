import { SirenLogo } from './SirenLogo';
import { Headphones, Mic, BookOpen, Settings } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dueCount: number;
}

export function Navbar({ activeTab, setActiveTab, dueCount }: NavbarProps) {
  const tabs = [
    { id: 'listen', label: 'Listen', icon: Headphones },
    { id: 'quiz', label: 'Quiz', icon: Mic },
    { id: 'recipes', label: 'Recipes', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.85rem 1.5rem',
      borderBottom: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--bg-surface)',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setActiveTab('quiz')}>
        <SirenLogo size={34} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '1px', color: '#FFF' }}>
            STARBUCKS BARISTA
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-mint)', fontWeight: 700, letterSpacing: '0.5px' }}>
            RECIPE SRS & AUDIO DRILL
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem', 
              borderRadius: '6px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--accent-mint)' : 'transparent',
              color: activeTab === tab.id ? '#FFF' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {tab.id === 'quiz' && dueCount > 0 && (
              <span style={{ background: 'var(--status-fail)', color: '#FFF', borderRadius: '10px', padding: '2px 7px', fontSize: '0.75rem', marginLeft: '4px', fontWeight: 800 }}>
                {dueCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
