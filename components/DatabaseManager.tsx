import React, { useState, useEffect } from 'react';
import { Driver } from '../types';
import {
  listDatabases,
  createDatabase,
  dropDatabase,
  startDatabase,
  stopDatabase,
  getDatabaseStatistics,
  getServerInfo,
  DatabaseInfo,
  DatabaseStatistics
} from '../services/neo4j/databases';
import {
  X, Database, Plus, Trash2, Loader2, RefreshCw,
  Play, Square, AlertCircle, CheckCircle, Server,
  HardDrive, GitBranch, Layers, Key
} from 'lucide-react';

interface DatabaseManagerProps {
  driver: Driver | null;
  currentDatabase?: string;
  onClose: () => void;
  onSelectDatabase?: (database: string) => void;
}

const DatabaseManager: React.FC<DatabaseManagerProps> = ({
  driver,
  currentDatabase,
  onClose,
  onSelectDatabase
}) => {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [serverInfo, setServerInfo] = useState<{ version: string; edition: string; name: string } | null>(null);
  const [statistics, setStatistics] = useState<Record<string, DatabaseStatistics>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [driver]);

  const loadData = async () => {
    if (!driver) return;

    setLoading(true);
    setError(null);

    try {
      const [dbList, info] = await Promise.all([
        listDatabases(driver),
        getServerInfo(driver)
      ]);
      setDatabases(dbList);
      setServerInfo(info);
      
      // Load statistics for online databases
      const stats: Record<string, DatabaseStatistics> = {};
      for (const db of dbList.filter(d => d.currentStatus === 'online' && d.name !== 'system')) {
        try {
          stats[db.name] = await getDatabaseStatistics(driver, db.name);
        } catch (e) {
          // Skip if can't get stats
        }
      }
      setStatistics(stats);
    } catch (err) {
      setError(`加载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDatabase = async () => {
    if (!driver || !newDbName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      await createDatabase(driver, newDbName.trim());
      await loadData();
      setShowCreateForm(false);
      setNewDbName('');
    } catch (err) {
      setError(`创建数据库失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDropDatabase = async (name: string) => {
    if (!driver || name === 'system' || name === 'neo4j') {
      setError('不能删除系统数据库');
      return;
    }

    if (!confirm(`确定要删除数据库 "${name}" 吗？此操作不可恢复！`)) return;

    setActionLoading(name);
    setError(null);

    try {
      await dropDatabase(driver, name);
      await loadData();
    } catch (err) {
      setError(`删除数据库失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartDatabase = async (name: string) => {
    if (!driver) return;

    setActionLoading(name);
    setError(null);

    try {
      await startDatabase(driver, name);
      await loadData();
    } catch (err) {
      setError(`启动数据库失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopDatabase = async (name: string) => {
    if (!driver || name === 'system') {
      setError('不能停止系统数据库');
      return;
    }

    setActionLoading(name);
    setError(null);

    try {
      await stopDatabase(driver, name);
      await loadData();
    } catch (err) {
      setError(`停止数据库失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-400';
      case 'offline':
        return 'text-gray-400';
      case 'starting':
      case 'stopping':
        return 'text-yellow-400';
      default:
        return 'text-red-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'offline':
        return <Square className="w-4 h-4 text-gray-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-80">
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neo-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-white font-medium">加载数据库信息...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-80 p-4">
      <div className="glass-panel rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-neo-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">数据库管理</h2>
              {serverInfo && (
                <p className="text-xs text-neo-dim">
                  {serverInfo.name} {serverInfo.version} ({serverInfo.edition})
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 text-neo-dim hover:text-white transition-colors"
              title="刷新"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">新建数据库</span>
            </button>
            <button onClick={onClose} className="text-neo-dim hover:text-white p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="p-4 border-b border-neo-border bg-neo-bg/50">
            <div className="flex gap-3">
              <input
                type="text"
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
                placeholder="数据库名称"
                className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white placeholder-neo-dim/50 focus:ring-1 focus:ring-blue-400 outline-none"
              />
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-neo-dim hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateDatabase}
                disabled={creating || !newDbName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    创建
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-neo-border flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          <div className="space-y-4">
            {databases.map(db => (
              <div
                key={db.name}
                className={`bg-neo-bg rounded-xl border transition-colors ${
                  currentDatabase === db.name
                    ? 'border-blue-400'
                    : 'border-neo-border hover:border-blue-400/50'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getStatusIcon(db.currentStatus)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{db.name}</span>
                          {db.default && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                              默认
                            </span>
                          )}
                          {db.home && (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                              主数据库
                            </span>
                          )}
                          {currentDatabase === db.name && (
                            <span className="text-xs bg-neo-primary/20 text-neo-primary px-2 py-0.5 rounded">
                              当前
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-neo-dim">
                          <span className={getStatusColor(db.currentStatus)}>
                            {db.currentStatus}
                          </span>
                          <span>{db.type}</span>
                          <span>{db.access}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {db.currentStatus === 'online' && db.name !== 'system' && onSelectDatabase && (
                        <button
                          onClick={() => onSelectDatabase(db.name)}
                          className="px-3 py-1.5 text-sm bg-neo-primary/20 hover:bg-neo-primary/30 text-neo-primary rounded-lg transition-colors"
                        >
                          切换
                        </button>
                      )}
                      {db.currentStatus === 'offline' && db.name !== 'system' && (
                        <button
                          onClick={() => handleStartDatabase(db.name)}
                          disabled={actionLoading === db.name}
                          className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors disabled:opacity-50"
                          title="启动"
                        >
                          {actionLoading === db.name ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {db.currentStatus === 'online' && db.name !== 'system' && db.name !== 'neo4j' && (
                        <button
                          onClick={() => handleStopDatabase(db.name)}
                          disabled={actionLoading === db.name}
                          className="p-2 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors disabled:opacity-50"
                          title="停止"
                        >
                          {actionLoading === db.name ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {db.name !== 'system' && db.name !== 'neo4j' && (
                        <button
                          onClick={() => handleDropDatabase(db.name)}
                          disabled={actionLoading === db.name}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                          title="删除"
                        >
                          {actionLoading === db.name ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Statistics */}
                  {statistics[db.name] && (
                    <div className="mt-4 pt-4 border-t border-neo-border">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-neo-dim" />
                          <div>
                            <div className="text-xs text-neo-dim">节点</div>
                            <div className="font-medium text-white">
                              {formatNumber(statistics[db.name].nodeCount)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-neo-dim" />
                          <div>
                            <div className="text-xs text-neo-dim">关系</div>
                            <div className="font-medium text-white">
                              {formatNumber(statistics[db.name].relationshipCount)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-neo-dim" />
                          <div>
                            <div className="text-xs text-neo-dim">标签</div>
                            <div className="font-medium text-white">
                              {statistics[db.name].labelCount}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-neo-dim" />
                          <div>
                            <div className="text-xs text-neo-dim">关系类型</div>
                            <div className="font-medium text-white">
                              {statistics[db.name].relationshipTypeCount}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-neo-dim" />
                          <div>
                            <div className="text-xs text-neo-dim">属性键</div>
                            <div className="font-medium text-white">
                              {statistics[db.name].propertyKeyCount}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseManager;
