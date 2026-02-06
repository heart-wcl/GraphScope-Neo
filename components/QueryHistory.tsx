import React, { useState, useEffect } from 'react';
import {
  History, Star, StarOff, Trash2, Search,
  Play, Copy, Check, Clock
} from 'lucide-react';
import { Modal } from '../presentation/components/common/Modal';
import { EmptyState } from '../presentation/components/common/Empty';

interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  executionTime?: number;
  isFavorite: boolean;
  database?: string;
}

interface QueryHistoryProps {
  onClose: () => void;
  onSelectQuery: (query: string) => void;
  currentDatabase?: string;
}

const STORAGE_KEY = 'neo4j-omnivis-query-history';
const MAX_HISTORY_ITEMS = 100;

const loadHistory = (): QueryHistoryItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveHistory = (history: QueryHistoryItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
  } catch {}
};

export const addQueryToHistory = (query: string, executionTime?: number, database?: string) => {
  const history = loadHistory();
  if (history.length > 0 && history[0].query.trim() === query.trim()) return;
  const newItem: QueryHistoryItem = {
    id: Date.now().toString(),
    query: query.trim(),
    timestamp: Date.now(),
    executionTime,
    isFavorite: false,
    database
  };
  saveHistory([newItem, ...history]);
};

const QueryHistory: React.FC<QueryHistoryProps> = ({
  onClose,
  onSelectQuery,
  currentDatabase
}) => {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [filter, setFilter] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const handleToggleFavorite = (id: string) => {
    const updated = history.map(item => item.id === id ? { ...item, isFavorite: !item.isFavorite } : item);
    setHistory(updated);
    saveHistory(updated);
  };

  const handleDelete = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  const handleClearHistory = () => {
    if (!confirm('确定要清空所有历史记录吗？收藏的查询将被保留。')) return;
    const favorites = history.filter(item => item.isFavorite);
    setHistory(favorites);
    saveHistory(favorites);
  };

  const handleCopy = async (query: string, id: string) => {
    await navigator.clipboard.writeText(query);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredHistory = history.filter(item => {
    if (showFavoritesOnly && !item.isFavorite) return false;
    if (filter && !item.query.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const favorites = history.filter(item => item.isFavorite);
  const regularHistory = filteredHistory.filter(item => !item.isFavorite);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="查询历史"
      description={`${history.length} 条记录，${favorites.length} 个收藏`}
      icon={<History className="w-5 h-5 text-neo-primary" />}
      size="2xl"
    >
      {/* Header Actions */}
      <div className="p-4 border-b border-neo-border flex justify-end">
        <button onClick={handleClearHistory} className="px-3 py-1.5 text-sm text-neo-dim hover:text-red-400 transition-colors">
          清空历史
        </button>
      </div>

      {/* Search & Filter */}
      <div className="p-4 border-b border-neo-border flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="搜索查询..."
            className="w-full bg-neo-bg border border-neo-border rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-neo-dim focus:ring-1 focus:ring-neo-primary outline-none" />
        </div>
        <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showFavoritesOnly ? 'bg-yellow-500/20 border border-yellow-400 text-yellow-400' : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-yellow-400/50'}`}>
          <Star className="w-4 h-4" /> 收藏
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto custom-scrollbar">
        {filteredHistory.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<History className="w-12 h-12" />}
              title={showFavoritesOnly ? '暂无收藏的查询' : '暂无查询历史'}
            />
          </div>
        ) : (
          <div className="divide-y divide-neo-border">
            {!showFavoritesOnly && favorites.length > 0 && (
              <>
                <div className="px-4 py-2 bg-yellow-500/5">
                  <span className="text-xs font-bold text-yellow-400 uppercase">收藏</span>
                </div>
                {favorites.filter(item => !filter || item.query.toLowerCase().includes(filter.toLowerCase())).map(item => (
                  <QueryHistoryItemComponent key={item.id} item={item} copiedId={copiedId}
                    onSelect={onSelectQuery} onToggleFavorite={handleToggleFavorite}
                    onDelete={handleDelete} onCopy={handleCopy} formatTimestamp={formatTimestamp} />
                ))}
              </>
            )}
            {!showFavoritesOnly && regularHistory.length > 0 && (
              <div className="px-4 py-2 bg-neo-bg/50">
                <span className="text-xs font-bold text-neo-dim uppercase">历史记录</span>
              </div>
            )}
            {(showFavoritesOnly ? filteredHistory : regularHistory).map(item => (
              <QueryHistoryItemComponent key={item.id} item={item} copiedId={copiedId}
                onSelect={onSelectQuery} onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete} onCopy={handleCopy} formatTimestamp={formatTimestamp} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

interface QueryHistoryItemComponentProps {
  item: QueryHistoryItem;
  copiedId: string | null;
  onSelect: (query: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy: (query: string, id: string) => void;
  formatTimestamp: (timestamp: number) => string;
}

const QueryHistoryItemComponent: React.FC<QueryHistoryItemComponentProps> = ({
  item, copiedId, onSelect, onToggleFavorite, onDelete, onCopy, formatTimestamp
}) => (
  <div className="p-4 hover:bg-neo-bg/50 transition-colors group">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-neo-text cursor-pointer hover:text-neo-primary transition-colors line-clamp-3"
          onClick={() => onSelect(item.query)}>
          {item.query}
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-neo-dim">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimestamp(item.timestamp)}</span>
          {item.executionTime !== undefined && <span>{item.executionTime}ms</span>}
          {item.database && <span className="bg-neo-panel px-2 py-0.5 rounded">{item.database}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onSelect(item.query)} className="p-2 text-neo-dim hover:text-neo-primary hover:bg-neo-primary/10 rounded-lg transition-colors" title="执行">
          <Play className="w-4 h-4" />
        </button>
        <button onClick={() => onCopy(item.query, item.id)} className="p-2 text-neo-dim hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="复制">
          {copiedId === item.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
        <button onClick={() => onToggleFavorite(item.id)}
          className={`p-2 rounded-lg transition-colors ${item.isFavorite ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-neo-dim hover:text-yellow-400 hover:bg-yellow-400/10'}`}
          title={item.isFavorite ? '取消收藏' : '收藏'}>
          {item.isFavorite ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
        </button>
        <button onClick={() => onDelete(item.id)} className="p-2 text-neo-dim hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="删除">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

export default QueryHistory;
