import React, { useState, useEffect, useRef } from 'react';
import type { ConnectionConfig, Session, CacheConfig } from '../types';
import { DEFAULT_CACHE_CONFIG } from '../types';
import {
  createDriver,
  executeCypher,
  updateNodeProperty,
  updateRelationshipProperty,
  createNode,
  deleteNode,
  createRelationship,
  getAllNodes,
  getSchemaInfo,
  SchemaInfo,
  createLoaderManager,
  LoaderManager
} from '../services/neo4j';
import OptimizedGraphCanvas from './OptimizedGraphCanvas';
import AddNodeModal from './AddNodeModal';
import AddRelationshipModal from './AddRelationshipModal';
import QueryResultTable from './QueryResultTable';
import ExecutionPlanView from './ExecutionPlanView';
import ErrorBoundary from './ErrorBoundary';
import {
  validateGraphData,
  sanitizeGraphData,
  generateNodeCoordinates,
  truncateGraphData
} from '../utils/dataValidation';
import { Play, X, Plus, Database, AlertCircle, Activity } from 'lucide-react';

interface OptimizedWorkspaceProps {
  config: ConnectionConfig;
  onDisconnect: () => void;
  isActive: boolean;
}

const OptimizedWorkspace: React.FC<OptimizedWorkspaceProps> = ({
  config,
  onDisconnect,
  isActive
}) => {
  const [query, setQuery] = useState("MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100");
  const [data, setData] = useState<any>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driver, setDriver] = useState<any>(null);
  const [loaderManager, setLoaderManager] = useState<LoaderManager | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editedNodeProps, setEditedNodeProps] = useState<Record<string, any>>({});
  const [editedRelProps, setEditedRelProps] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [createNodeError, setCreateNodeError] = useState<string | null>(null);

  const [showAddRelModal, setShowAddRelModal] = useState(false);
  const [isCreatingRel, setIsCreatingRel] = useState(false);
  const [createRelError, setCreateRelError] = useState<string | null>(null);
  const [availableNodes, setAvailableNodes] = useState<any[]>([]);
  const [schemaInfo, setSchemaInfo] = useState<SchemaInfo | null>(null);
  const [relSourceNode, setRelSourceNode] = useState<any>(null);
  const [cacheConfig, setCacheConfig] = useState<CacheConfig>(DEFAULT_CACHE_CONFIG);

  const [isGraphResult, setIsGraphResult] = useState(true);
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: any[] } | null>(null);
  const [executionPlan, setExecutionPlan] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isActive && config) {
      const isDemoMode = config.protocol === 'demo';
      if (isDemoMode) {
        setDriver(null);
        setLoaderManager(null);
        return;
      }

      try {
        const driverInstance = createDriver(config);
        setDriver(driverInstance);

        const loader = createLoaderManager(driverInstance, {
          incremental: {
            batchSize: 50,
            preloadThreshold: 10,
            maxBatches: 20
          },
          cacheEnabled: cacheConfig.enabled,
          cacheTTL: cacheConfig.ttl
        }, config.database);

        setLoaderManager(loader);
      } catch (err) {
        setError(`Failed to create driver: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    return () => {
      if (driver) {
        driver.close();
      }
    };
  }, [config, isActive]);

  useEffect(() => {
    const isDemoMode = config.protocol === 'demo';
    if (driver || isDemoMode) {
      runQuery();
    }
  }, [driver, config]);

  const runQuery = async () => {
    const isDemoMode = config.protocol === 'demo';

    if (!driver && !isDemoMode) {
      setError('No driver available. Please reconnect to database.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result: any;

      // 检查是否需要分页查询（大图检测）
      const isLargeQuery = query.toLowerCase().includes('limit') &&
                          query.match(/limit\s+(\d+)/i) &&
                          parseInt(query.match(/limit\s+(\d+)/i)![1]) > 500;

      if (isLargeQuery && loaderManager) {
        console.log('[OptimizedWorkspace] 检测到大图查询，使用分页加载...');

        // 使用分页查询加载大图
        const paginatedResult = await loaderManager.executePaginated(
          query.replace(/LIMIT\s+\d+/i, ''), // 移除 LIMIT 以便完整统计
          {},
          { limit: 100, skip: 0 }
        );

        // 分页查询返回的是表格数据，需要转换为 GraphData
        // 注意：这里我们实际上不使用分页结果，而是直接执行原始查询
        // 因为分页结果不包含图关系信息
        console.log('[OptimizedWorkspace] 分页结果：', paginatedResult);

        // 直接执行原始查询（使用 LIMIT）
        result = await executeCypher(driver, query, config.database || undefined, isDemoMode);
      } else {
        // 小图或无 loaderManager，直接执行
        result = await executeCypher(driver, query, config.database || undefined, isDemoMode);
      }

      const isExecutionPlan = result && typeof result === 'object' && 'root' in result;
      const isTabularResult = result && 'columns' in result;
      const isGraphData = result && 'nodes' in result;

      if (isExecutionPlan) {
        setExecutionPlan(result);
        setData({ nodes: [], links: [] });
        setQueryResult(null);
        setIsGraphResult(false);
      } else if (isGraphData) {
        // 数据验证和清理（解耦设计）
        const sanitized = sanitizeGraphData(result, {
          maxNodes: 10000,
          maxRelationships: 20000,
        });

        // 检查是否需要截断
        if (sanitized.nodes.length !== result.nodes.length) {
          console.warn(`数据已截断：${result.nodes.length} -> ${sanitized.nodes.length} 节点`);
        }

        // 生成随机坐标（用于没有坐标的节点）
        const withCoordinates = generateNodeCoordinates(
          sanitized.nodes,
          dimensions.width || 800,
          dimensions.height || 600
        );

        // 更新数据
        setData({
          nodes: withCoordinates,
          links: sanitized.links,
        });
        setQueryResult(null);
        setExecutionPlan(null);
        setIsGraphResult(true);
      } else if (isTabularResult) {
        setQueryResult(result);
        setData({ nodes: [], links: [] });
        setExecutionPlan(null);
        setIsGraphResult(false);
      }

      setSelectedNode(null);
      setSelectedRelationship(null);

    } catch (err) {
      setError(`Query failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!driver) return;
    setIsSaving(true);
    setError(null);

    try {
      if (selectedNode) {
        for (const [key, newValue] of Object.entries(editedNodeProps)) {
          const oldValue = selectedNode.properties[key];
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            await updateNodeProperty(driver, selectedNode.id, key, newValue, config.database);
          }
        }
      }

      if (selectedRelationship) {
        for (const [key, newValue] of Object.entries(editedRelProps)) {
          const oldValue = selectedRelationship.properties[key];
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            await updateRelationshipProperty(driver, selectedRelationship.id, key, newValue, config.database);
          }
        }
      }

      await runQuery();
      setIsEditing(false);
    } catch (err) {
      setError(`Failed to save changes: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (selectedNode) {
      setEditedNodeProps({ ...selectedNode.properties });
    }
    if (selectedRelationship) {
      setEditedRelProps({ ...selectedRelationship.properties });
    }
    setIsEditing(false);
  };

  const handleCreateNode = async (label: string, properties: Record<string, string>) => {
    if (!driver) return;
    setIsCreatingNode(true);
    setCreateNodeError(null);

    try {
      await createNode(driver, label, properties, config.database);
      setShowAddNodeModal(false);
      await runQuery();
    } catch (err) {
      setCreateNodeError(`Failed to create node: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsCreatingNode(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!driver || !selectedNode) return;

    const confirmed = window.confirm(`Delete node "${selectedNode.labels.join(':')}" and all its relationships?`);
    if (!confirmed) return;

    setIsLoading(true);
    setError(null);

    try {
      await deleteNode(driver, selectedNode.id, config.database);
      setSelectedNode(null);
      await runQuery();
    } catch (err) {
      setError(`Failed to delete node: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddRel = async (node: any) => {
    if (!driver) return;

    setIsLoading(true);
    setError(null);

    try {
      const [nodes, schema] = await Promise.all([
        getAllNodes(driver, config.database, 1000),
        getSchemaInfo(driver, config.database)
      ]);

      setAvailableNodes(nodes);
      setSchemaInfo(schema);
      setRelSourceNode(node);
      setShowAddRelModal(true);
    } catch (err) {
      setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRelationship = async (endNodeId: string, relationshipType: string, properties: Record<string, any>) => {
    if (!driver || !relSourceNode) return;
    setIsCreatingRel(true);
    setCreateRelError(null);

    try {
      await createRelationship(driver, relSourceNode.id, endNodeId, relationshipType, properties, config.database);
      setShowAddRelModal(false);
      setRelSourceNode(null);
      await runQuery();
    } catch (err) {
      setCreateRelError(`Failed to create relationship: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsCreatingRel(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className="flex flex-col h-full w-full bg-neo-bg text-neo-text"
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      <header className="h-14 bg-neo-panel border-b border-neo-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-neo-primary/10 p-2 rounded-lg border border-neo-primary/30">
            <Database className="w-5 h-5 text-neo-primary" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-white leading-none">{config.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] text-neo-dim font-mono">{config.username}@{config.host}</span>
              <span className="text-[10px] text-neo-primary font-mono">✨ 性能优化已启用</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-black/20 border border-white/5">
            <span className="text-xs text-neo-dim">
              {data?.nodes?.length || 0} 节点 • {data?.links?.length || 0} 关系
            </span>
          </div>

          <button
            onClick={onDisconnect}
            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-md border border-red-500/20 transition-colors"
          >
            关闭视图 <X className="w-4 h-4 inline ml-1" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="bg-neo-panel border-b border-neo-border p-3 flex flex-col gap-2 shrink-0 z-10">
            <div className="flex items-center gap-2 text-xs text-neo-dim font-mono">
              <Activity className="w-3 h-3" />
              <span>CYPHER 编辑器</span>
              {data?.nodes?.length > 500 && (
                <span className="text-neo-primary ml-auto">大图模式已启用</span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative group">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-24 bg-neo-bg border border-neo-border rounded-lg p-3 font-mono text-sm text-neo-primary focus:ring-1 focus:ring-neo-primary outline-none resize-none transition-all"
                  spellCheck={false}
                  disabled={isLoading}
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={runQuery}
                  disabled={isLoading}
                  className="h-full px-6 bg-neo-primary hover:bg-white text-black font-bold rounded-lg flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 shadow-lg shadow-neo-primary/20"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                  <span className="text-[10px] uppercase tracking-wider">{isLoading ? '运行中' : '运行'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddNodeModal(true)}
                disabled={isLoading || config.protocol === 'demo'}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-neo-primary/10 hover:bg-neo-primary/20 text-neo-primary border border-neo-primary/30 transition-colors text-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                添加节点
              </button>

              {selectedNode && (
                <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-neo-bg/30 text-xs text-neo-dim">
                  <span>已选择：</span>
                  <span className="text-neo-text font-medium">{selectedNode.labels.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden bg-neo-bg" ref={containerRef}>
            {error && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 shadow-xl">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
                <button onClick={() => setError(null)} className="ml-2 hover:text-neo-text">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {executionPlan ? (
              <div className="w-full h-full overflow-auto">
                <ExecutionPlanView plan={executionPlan} />
              </div>
            ) : isGraphResult ? (
              <>
                {dimensions.width > 0 && dimensions.height > 0 && (
                  <OptimizedGraphCanvas
                    data={data}
                    onNodeClick={setSelectedNode}
                    onRelationshipClick={setSelectedRelationship}
                    onAddRelationship={config.protocol !== 'demo' ? handleOpenAddRel : undefined}
                    width={dimensions.width}
                    height={dimensions.height}
                    isLoading={isLoading}
                  />
                )}

                {data?.nodes?.length > 100 && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-neo-panel/90 backdrop-blur-md px-4 py-2 rounded-lg border border-neo-primary/30 text-xs text-neo-primary z-10 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span className="font-medium">✨ 性能优化已启用</span>
                    <span className="text-neo-dim ml-2">Canvas 渲染 • 视锥体裁剪 • LOD 渲染 • 性能监控</span>
                  </div>
                )}

                {(selectedNode || selectedRelationship) && (
                  <div className="fixed md:absolute bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:top-4 md:right-4 w-full md:w-80 h-[50vh] md:h-auto md:max-h-[calc(100%-2rem)] glass-panel md:rounded-xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up md:animate-slide-in-right z-50 border-t md:border border-neo-primary/20">
                    <div className="w-full flex justify-center pt-2 pb-1 md:hidden bg-neo-bg/5 cursor-grab">
                      <div className="w-10 h-1 rounded-full bg-neo-dim/30"></div>
                    </div>

                    <div className="p-4 border-b border-neo-border bg-neo-bg/5 flex justify-between items-center">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {selectedNode ? (
                          <>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-neo-bg text-sm shrink-0" style={{ backgroundColor: selectedNode.color || '#555' }}>
                              {selectedNode.labels[0]?.[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] text-neo-dim uppercase font-bold tracking-wider truncate">{selectedNode.labels.join(", ")}</div>
                              <div className="text-sm font-semibold text-neo-text truncate w-full">
                                {Object.entries(selectedNode.properties).find(([k]) => k.toLowerCase().includes('name'))?.[1] || selectedNode.id}
                              </div>
                            </div>
                          </>
                        ) : selectedRelationship ? (
                          <>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-neo-bg text-sm shrink-0 bg-neo-secondary">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] text-neo-dim uppercase font-bold tracking-wider truncate">关系</div>
                              <div className="text-sm font-semibold text-neo-text truncate w-full">
                                {selectedRelationship.type}
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>
                      <button onClick={() => { setSelectedNode(null); setSelectedRelationship(null); }} className="text-neo-dim hover:text-neo-text">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                      {selectedNode ? (
                        <>
                          <div className="space-y-2">
                            <div className="bg-neo-bg/40 rounded p-3 flex flex-col border border-neo-border/50">
                              <span className="text-[10px] text-neo-dim uppercase font-mono mb-1">标签</span>
                              <span className="text-sm text-neo-text">{selectedNode.labels.join(":")}</span>
                            </div>
                            {Object.entries(isEditing ? editedNodeProps : selectedNode.properties).map(([key, value]) => (
                              <div key={key} className="bg-neo-bg/40 rounded p-3 flex flex-col border border-neo-border/50">
                                <span className="text-[10px] text-neo-dim uppercase font-mono mb-1">{key}</span>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={typeof editedNodeProps[key] === 'object' ? JSON.stringify(editedNodeProps[key], null, 2) : String(editedNodeProps[key] ?? '')}
                                    onChange={(e) => {
                                      try {
                                        const parsed = JSON.parse(e.target.value);
                                        setEditedNodeProps(prev => ({ ...prev, [key]: parsed }));
                                      } catch {
                                        setEditedNodeProps(prev => ({ ...prev, [key]: e.target.value }));
                                      }
                                    }}
                                    className="w-full bg-transparent border-none outline-none text-sm text-neo-text font-mono"
                                  />
                                ) : (
                                  <span className="text-sm text-neo-text break-all">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</span>
                                )}
                              </div>
                            ))}
                          </div>

                          {config.protocol !== 'demo' && (
                            <button
                              onClick={handleDeleteNode}
                              disabled={isLoading}
                              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                            >
                              删除节点
                            </button>
                          )}
                        </>
                      ) : selectedRelationship ? (
                        <>
                          <div className="space-y-2">
                            <div className="bg-neo-bg/40 rounded p-3 flex flex-col border border-neo-border/50">
                              <span className="text-[10px] text-neo-dim uppercase font-mono mb-1">类型</span>
                              <span className="text-sm text-neo-text">{selectedRelationship.type}</span>
                            </div>
                            <div className="bg-neo-bg/40 rounded p-3 flex flex-col border border-neo-border/50">
                              <span className="text-[10px] text-neo-dim uppercase font-mono mb-1">起始节点</span>
                              <span className="text-sm text-neo-text">{selectedRelationship.startNode}</span>
                            </div>
                            <div className="bg-neo-bg/40 rounded p-3 flex flex-col border border-neo-border/50">
                              <span className="text-[10px] text-neo-dim uppercase font-mono mb-1">终止节点</span>
                              <span className="text-sm text-neo-text">{selectedRelationship.endNode}</span>
                            </div>
                            {Object.entries(isEditing ? editedRelProps : selectedRelationship.properties).map(([key, value]) => (
                              <div key={key} className="bg-neo-bg/40 rounded p-3 flex flex-col border border-neo-border/50">
                                <span className="text-[10px] text-neo-dim uppercase font-mono mb-1">{key}</span>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={typeof editedRelProps[key] === 'object' ? JSON.stringify(editedRelProps[key], null, 2) : String(editedRelProps[key] ?? '')}
                                    onChange={(e) => {
                                      try {
                                        const parsed = JSON.parse(e.target.value);
                                        setEditedRelProps(prev => ({ ...prev, [key]: parsed }));
                                      } catch {
                                        setEditedRelProps(prev => ({ ...prev, [key]: e.target.value }));
                                      }
                                    }}
                                    className="w-full bg-transparent border-none outline-none text-sm text-neo-text font-mono"
                                  />
                                ) : (
                                  <span className="text-sm text-neo-text break-all">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>

                    <div className="p-4 border-t border-neo-border flex gap-3">
                      {isEditing ? (
                        <>
                          <button onClick={handleSaveChanges} disabled={isSaving} className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors disabled:opacity-50">
                            {isSaving ? '保存中...' : '保存'}
                          </button>
                          <button onClick={handleCancelEdit} disabled={isSaving} className="flex-1 py-2 rounded-lg border border-neo-border text-neo-dim hover:text-neo-text transition-colors">
                            取消
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setIsEditing(true)} className="flex-1 py-2 rounded-lg bg-neo-primary hover:bg-white text-black font-medium transition-colors">
                          编辑
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              queryResult && <QueryResultTable columns={queryResult.columns} rows={queryResult.rows} />
            )}

            {!isLoading && !data?.nodes?.length && !queryResult && !executionPlan && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3 text-neo-dim">
                  <div className="w-16 h-16 rounded-full bg-neo-panel flex items-center justify-center border border-neo-border">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <span className="text-sm">未返回任何节点。请尝试其他查询。</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddNodeModal
        isOpen={showAddNodeModal}
        onClose={() => setShowAddNodeModal(false)}
        onCreate={handleCreateNode}
        isLoading={isCreatingNode}
        error={createNodeError}
      />

      <AddRelationshipModal
        isOpen={showAddRelModal}
        onClose={() => {
          setShowAddRelModal(false);
          setRelSourceNode(null);
        }}
        onCreate={handleCreateRelationship}
        sourceNode={relSourceNode}
        availableNodes={availableNodes}
        schemaInfo={schemaInfo}
        isLoading={isCreatingRel}
        error={createRelError}
      />
    </div>
  );
};

export default OptimizedWorkspace;
