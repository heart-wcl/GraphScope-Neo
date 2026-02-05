import React, { useState, useEffect } from 'react';
import ConnectionManager from './components/ConnectionManager';
import OptimizedWorkspace from './components/OptimizedWorkspace';
import ErrorBoundary from './components/ErrorBoundary';
import { ConnectionConfig, Session } from './types';
import { Plus, Database, Settings, Activity, Sun, Moon } from 'lucide-react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

const STORAGE_KEY = 'neo4j-omnivis-sessions';

const AppContent: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('NEW');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const { theme, toggleTheme } = useTheme();

  // Load sessions from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedSessions = JSON.parse(saved);
        setSessions(parsedSessions);
        if (parsedSessions.length > 0) {
          setActiveSessionId(parsedSessions[parsedSessions.length - 1].id);
        }
      }
    } catch (err) {
      console.error('Failed to load saved sessions:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.error('Failed to save sessions:', err);
    }
  }, [sessions, isLoaded]);

  // Generate a simple ID
  const generateId = () => Math.random().toString(36).substring(2, 9);

  const handleConnect = (config: ConnectionConfig) => {
    setIsLoading(true);
    // Simulate connection delay
    setTimeout(() => {
      const newSession: Session = {
        id: generateId(),
        config,
      };
      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSession.id);
      setIsLoading(false);
    }, 1000);
  };

  const handleDisconnect = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      // If we closed the active one, go to the last one or NEW
      if (sessions.length > 1) {
        // Find the one that isn't the one we just deleted
        const remaining = sessions.filter(s => s.id !== id);
        setActiveSessionId(remaining[remaining.length - 1].id);
      } else {
        setActiveSessionId('NEW');
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row w-full h-full font-sans antialiased bg-neo-bg text-neo-text overflow-hidden">

      {/* Responsive Navigation: Bottom on mobile, Left on desktop */}
      <aside className="order-last md:order-first w-full md:w-16 h-16 md:h-full bg-neo-panel border-t md:border-t-0 md:border-r border-neo-border flex flex-row md:flex-col items-center py-2 md:py-4 gap-2 md:gap-4 shrink-0 z-30 shadow-2xl justify-between md:justify-start px-4 md:px-0">

        {/* App Logo - Hidden on mobile to save space, or kept if space allows */}
        <div className="hidden md:block p-2 mb-2">
           <div className="w-8 h-8 rounded-lg bg-neo-primary/20 border border-neo-primary text-neo-primary flex items-center justify-center neon-glow">
              <Activity className="w-5 h-5" />
           </div>
        </div>

        {/* New Connection Button */}
        <button
          onClick={() => setActiveSessionId('NEW')}
          className={`p-2.5 md:p-3 rounded-xl transition-all duration-200 group relative ${activeSessionId === 'NEW' ? 'bg-neo-primary text-black' : 'bg-white/5 text-neo-dim hover:bg-white/10 hover:text-white'}`}
          title="新建连接"
        >
          <Plus className="w-6 h-6" />
          {activeSessionId !== 'NEW' && <div className="hidden md:block absolute left-14 bg-neo-panel border border-neo-border px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">新建连接</div>}
        </button>

        {/* Divider */}
        <div className="w-[1px] h-8 md:w-8 md:h-[1px] bg-neo-border my-0 md:my-1 mx-2 md:mx-0"></div>

        {/* Session List - Horizontal scroll on mobile */}
        <div className="flex-1 flex flex-row md:flex-col gap-3 w-full items-center overflow-x-auto md:overflow-y-auto md:overflow-x-hidden custom-scrollbar md:px-2 no-scrollbar">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`min-w-[2.5rem] w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative group ${activeSessionId === session.id ? 'bg-neo-secondary text-white ring-2 ring-neo-secondary/50' : 'bg-neo-panel border border-neo-border text-neo-dim hover:border-neo-secondary/50 hover:text-white'}`}
            >
              <Database className="w-5 h-5" />
              {/* Tooltip - Desktop only */}
              <div className="hidden md:block absolute left-14 bg-neo-panel border border-neo-border px-3 py-2 rounded-lg text-left shadow-xl opacity-0 group-hover:opacity-100 z-50 pointer-events-none transition-opacity min-w-[120px]">
                 <div className="text-white font-bold text-xs mb-0.5">{session.config.name}</div>
                 <div className="text-[10px] text-neo-dim font-mono">{session.config.host}</div>
              </div>

              {/* Active Indicator dot */}
              {activeSessionId === session.id && (
                <div className="absolute -right-1 -top-1 w-3 h-3 bg-green-500 rounded-full border-2 border-neo-panel"></div>
              )}
            </button>
          ))}
        </div>

        {/* Settings - Desktop only to save mobile space */}
        <div className="hidden md:flex mt-auto pt-4 border-t border-neo-border w-full flex-col items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-3 text-neo-dim hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          >
            {theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
           <button className="p-3 text-neo-dim hover:text-white hover:bg-white/5 rounded-xl transition-colors">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden bg-neo-bg order-first md:order-last">
        {/* Render Connection Manager if active is NEW */}
        {activeSessionId === 'NEW' && (
          <div className="absolute inset-0 z-20">
             <ConnectionManager onConnect={handleConnect} isLoading={isLoading} />
          </div>
        )}

        {/* Render ALL Workspaces but hide inactive ones */}
        {sessions.map(session => (
          <OptimizedWorkspace
            key={session.id}
            config={session.config}
            isActive={activeSessionId === session.id}
            onDisconnect={() => handleDisconnect(session.id)}
          />
        ))}

        {/* Empty state */}
        {sessions.length === 0 && activeSessionId !== 'NEW' && (
           <div className="flex items-center justify-center h-full text-neo-dim">无活动会话。</div>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      // 错误上报（可以发送到监控系统）
      console.error('Global error caught:', error, errorInfo);

      // 这里可以添加错误上报逻辑
      // 例如：sendToSentry(error, errorInfo)
    }}
  >
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;