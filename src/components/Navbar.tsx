import { SirenLogo } from './SirenLogo';
import { Mic, BookOpen, BarChart2, Settings } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dueCount: number;
}

export function Navbar({ activeTab, setActiveTab, dueCount }: NavbarProps) {
  const tabs = [
    { id: 'quiz', label: 'Quiz', icon: Mic },
    { id: 'srs', label: 'SRS Metrics', icon: BarChart2 },
    { id: 'recipes', label: 'Recipes', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderTabs = (isMobile: boolean) => (
    tabs.map(tab => {
      const isActive = activeTab === tab.id;
      return (
        <button 
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{ 
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? '4px' : '0.4rem',
            padding: isMobile ? '0.4rem' : '0.5rem 0.9rem', 
            borderRadius: isMobile ? '0' : '6px',
            border: 'none',
            background: isActive && !isMobile ? 'var(--accent-mint)' : 'transparent',
            color: isActive ? (isMobile ? 'var(--accent-mint)' : '#FFF') : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: isMobile ? '0.65rem' : '0.85rem',
            position: 'relative',
            flex: isMobile ? 1 : 'unset'
          }}
        >
          <tab.icon size={isMobile ? 20 : 16} />
          <span>{tab.label}</span>
          {tab.id === 'quiz' && dueCount > 0 && (
            <span style={{ 
              position: isMobile ? 'absolute' : 'relative',
              top: isMobile ? '2px' : 'auto',
              right: isMobile ? 'calc(50% - 20px)' : 'auto',
              background: 'var(--status-fail)', 
              color: '#FFF', 
              borderRadius: '10px', 
              padding: '2px 6px', 
              fontSize: '0.65rem', 
              marginLeft: isMobile ? 0 : '4px',
              fontWeight: 800 
            }}>
              {dueCount}
            </span>
          )}
          {isMobile && isActive && (
            <div style={{
              position: 'absolute',
              top: '-1px',
              left: '10%',
              width: '80%',
              height: '3px',
              background: 'var(--accent-mint)',
              borderRadius: '0 0 3px 3px',
              boxShadow: '0 0 8px var(--accent-mint)'
            }} />
          )}
        </button>
      );
    })
  );

  return (
    <>
      {/* Top Header (Desktop & Mobile) */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1.25rem',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setActiveTab('quiz')}>
          <SirenLogo size={30} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '1px', color: '#FFF' }}>
              STARBUCKS BARISTA
            </span>
            <span className="hidden-mobile" style={{ fontSize: '0.65rem', color: 'var(--accent-mint)', fontWeight: 700, letterSpacing: '0.5px' }}>
              RECIPE SRS & AUDIO DRILL
            </span>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden-mobile" style={{ display: 'flex', gap: '0.5rem' }}>
          {renderTabs(false)}
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="hidden-desktop" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 100,
        boxShadow: '0 -4px 10px rgba(0,0,0,0.2)'
      }}>
        {renderTabs(true)}
      </div>
    </>
  );
}
