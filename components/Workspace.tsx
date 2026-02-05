import React, { useState, useEffect, useRef } from 'react';
import { ConnectionConfig, GraphData, Neo4jNode, Neo4jRelationship, Driver, ExecutionPlan, isExecutionPlan } from '../types';
import { createDriver, executeCypher, checkConnection, updateNodeProperty, updateRelationshipProperty, createNode, deleteNode, createRelationship, getAllNodes, getSchemaInfo, SchemaInfo } from '../services/neo4j';
import GraphCanvas from './GraphCanvas';
import AddNodeModal from './AddNodeModal';
import AddRelationshipModal from './AddRelationshipModal';
import QueryResultTable from './QueryResultTable';
import ExecutionPlanView from './ExecutionPlanView';
import ImportExport from './ImportExport';
import { Play, Terminal, X, Search, Database, AlertCircle, Save, Edit2, Check, RotateCcw, Plus, Trash2, Table, FileText, Activity, Download } from 'lucide-react';

interface WorkspaceProps {
  config: ConnectionConfig;
  onDisconnect: () => void;
  isActive: boolean;
}

const Workspace: React.FC<WorkspaceProps> = ({ config, onDisconnect, isActive }) => {
  const [query, setQuery] = useState("MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100");
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<Neo4jNode | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<Neo4jRelationship | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editedNodeProps, setEditedNodeProps] = useState<Record<string, any>>({});
  const [editedRelProps, setEditedRelProps] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Add Node Modal states
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [createNodeError, setCreateNodeError] = useState<string | null>(null);

  const [showAddRelModal, setShowAddRelModal] = useState(false);
  const [isCreatingRel, setIsCreatingRel] = useState(false);
  const [createRelError, setCreateRelError] = useState<string | null>(null);
  const [availableNodes, setAvailableNodes] = useState<Neo4jNode[]>([]);
  const [schemaInfo, setSchemaInfo] = useState<SchemaInfo | null>(null);
  const [relSourceNode, setRelSourceNode] = useState<Neo4jNode | null>(null);

  // Import/Export modal state
  const [showImportExport, setShowImportExport] = useState(false);

  // Query result type and data
  const [isGraphResult, setIsGraphResult] = useState(true);
   const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: any[] } | null>(null);
   const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
   
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Robust Resize Observer for layout changes
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

  // Initialize driver on mount
  useEffect(() => {
    if (isActive && config) {
      // Skip driver creation in demo mode
      if (config.protocol === 'demo') {
        setDriver(null);
        return;
      }

      try {
        const driverInstance = createDriver(config);
        setDriver(driverInstance);
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

  // Run initial query only once on mount
  useEffect(() => {
    const isDemoMode = config.protocol === 'demo';
    if (driver || isDemoMode) {
      runQuery();
    }
  }, [driver, config]);

  const runQuery = async () => {
    const isDemoMode = config.protocol === 'demo';

    if (!driver && !isDemoMode) {
      setError('No driver available. Please reconnect to the database.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await executeCypher(driver, query, config.database || undefined, isDemoMode);

      if (isExecutionPlan(result)) {
        setExecutionPlan(result);
        setData({ nodes: [], links: [] });
        setQueryResult(null);
        setIsGraphResult(false);
      } else if ('nodes' in result && 'links' in result) {
        setData(result);
        setQueryResult(null);
        setExecutionPlan(null);
        setIsGraphResult(true);
      } else if ('columns' in result && 'rows' in result) {
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

  // Initialize edited properties when selection changes
  useEffect(() => {
    if (selectedNode) {
      setEditedNodeProps({ ...selectedNode.properties });
    }
    if (selectedRelationship) {
      setEditedRelProps({ ...selectedRelationship.properties });
    }
    setIsEditing(false);
  }, [selectedNode, selectedRelationship]);

  // Handle property value changes
  const handleNodePropChange = (key: string, value: any) => {
    setEditedNodeProps(prev => ({ ...prev, [key]: value }));
  };

  const handleRelPropChange = (key: string, value: any) => {
    setEditedRelProps(prev => ({ ...prev, [key]: value }));
  };

  // Save changes to database
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

  // Cancel editing
  const handleCancelEdit = () => {
    if (selectedNode) {
      setEditedNodeProps({ ...selectedNode.properties });
    }
    if (selectedRelationship) {
      setEditedRelProps({ ...selectedRelationship.properties });
    }
    setIsEditing(false);
  };

  // Create node handler
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

  // Delete node handler
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

  const handleOpenAddRel = async (node: Neo4jNode) => {
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

  // Check if query returns graph data
  const isGraphQuery = (q: string): boolean => {
    const normalized = q.trim().toUpperCase();
    // Queries that modify data or return non-graph results
    const nonGraphPatterns = [
      /^CREATE/i,
      /^SET/i,
      /^DELETE/i,
      /^REMOVE/i,
      /^MERGE/i,
      /^WITH\s+\w+/i,  // WITH clause typically used for aggregations
      /^RETURN\s+\w+.*COUNT/i,
      /^RETURN\s+\w+.*SUM/i,
      /^RETURN\s+\w+.*AVG/i,
      /^RETURN\s+\w+.*COLLECT/i
    ];
    return !nonGraphPatterns.some(pattern => pattern.test(normalized));
  };

  return (
    <div 
      ref={rootRef}
      className="flex flex-col h-full w-full bg-neo-bg text-neo-text"
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      {/* Top Bar - Compact on Mobile */}
      <header className="h-12 md:h-14 bg-neo-panel border-b border-neo-border flex items-center justify-between px-3 md:px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-neo-primary/10 p-1.5 rounded-lg border border-neo-primary/30">
            <Database className="w-4 h-4 md:w-5 md:h-5 text-neo-primary" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-white leading-none truncate max-w-[150px] md:max-w-xs">{config.name}</h2>
            <div className="hidden md:flex items-center gap-2 mt-0.5">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-[10px] text-neo-dim font-mono">{config.username}@{config.host}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
           {/* User Avatar - Hotlinked - Hidden on small mobile */}
           <div className="hidden sm:flex items-center gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-black/20 border border-white/5">
              <img 
                src="https://picsum.photos/id/64/100/100" 
                alt="User" 
                className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-neo-secondary"
              />
              <span className="hidden md:inline text-xs font-medium text-white">{config.username}</span>
           </div>
           
             <button
              onClick={onDisconnect}
              className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2 py-1.5 md:px-3 md:py-1.5 rounded-md border border-red-500/20 transition-colors whitespace-nowrap"
            >
              <span className="hidden md:inline">关闭视图</span>
             <X className="w-4 h-4 md:hidden" />
           </button>
        </div>
      </header>

      {/* Main Layout - No internal Sidebar, full width */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 relative">
          
          {/* Query Editor Bar - Compact */}
          <div className="bg-neo-panel border-b border-neo-border p-2 md:p-3 flex flex-col gap-2 shrink-0 z-10">
            <div className="flex items-center gap-2 text-xs text-neo-dim font-mono mb-1 hidden md:flex">
              <Terminal className="w-3 h-3" />
              <span>CYPHER 编辑器</span>
            </div>
              <div className="flex gap-2">
                <div className="flex-1 relative group">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full h-16 md:h-24 bg-neo-bg border border-neo-border rounded-lg p-2 md:p-3 font-mono text-xs md:text-sm text-neo-primary focus:ring-1 focus:ring-neo-primary outline-none resize-none transition-all"
                    spellCheck={false}
                    disabled={isLoading}
                  />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button className="p-1 text-neo-dim hover:text-neo-text bg-neo-bg/50 rounded"><X className="w-3 h-3"/></button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={runQuery}
                    disabled={isLoading}
                    className={`h-full px-4 md:px-6 bg-neo-primary hover:bg-white text-black font-bold rounded-lg flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 shadow-lg shadow-neo-primary/20 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                    )}
                     <span className="text-[10px] md:text-xs uppercase tracking-wider hidden md:inline">{isLoading ? '运行中' : '运行'}</span>
                  </button>
                </div>
              </div>

               {/* Action Toolbar */}
               <div className="flex items-center gap-2 pt-1">
                 <button
                   onClick={() => setShowAddNodeModal(true)}
                   disabled={isLoading || config.protocol === 'demo'}
                   className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neo-primary/10 hover:bg-neo-primary/20 text-neo-primary border border-neo-primary/30 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Plus className="w-3.5 h-3.5" />
                   <span className="hidden sm:inline">添加节点</span>
                 </button>

                 <button
                   onClick={() => setShowImportExport(true)}
                   disabled={isLoading}
                   className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Download className="w-3.5 h-3.5" />
                   <span className="hidden sm:inline">导入/导出</span>
                 </button>

                 {selectedNode && (
                    <div className="ml-auto flex items-center gap-2 px-2 py-1 rounded bg-neo-bg/30 text-xs text-neo-dim">
                      <span>已选择：</span>
                      <span className="text-neo-text font-medium">{selectedNode.labels.join(', ')}</span>
                    </div>
                 )}
              </div>
          </div>

          {/* Visualization Area */}
          <div className="flex-1 relative overflow-hidden bg-neo-bg" ref={containerRef}>
            {/* Error Display */}
            {error && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
                <button onClick={() => setError(null)} className="ml-2 hover:text-neo-text">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

             {executionPlan ? (
               <ExecutionPlanView plan={executionPlan} />
             ) : isGraphResult ? (
               <>
                 {dimensions.width > 0 && dimensions.height > 0 && (
                   <GraphCanvas
                     data={data}
                     onNodeClick={setSelectedNode}
                     onRelationshipClick={setSelectedRelationship}
                     onAddRelationship={config.protocol !== 'demo' ? handleOpenAddRel : undefined}
                     width={dimensions.width}
                     height={dimensions.height}
                     isLoading={isLoading}
                   />
                 )}

                  <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
                    <div className="glass-panel px-2 py-1 md:px-3 md:py-1.5 rounded-full flex items-center gap-2 text-[10px] md:text-xs text-neo-dim shadow-lg backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-neo-primary"></div>
                        节点: <span className="text-neo-text font-mono">{data.nodes.length}</span>
                     </div>
                     <div className="glass-panel px-2 py-1 md:px-3 md:py-1.5 rounded-full flex items-center gap-2 text-[10px] md:text-xs text-neo-dim shadow-lg backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-neo-secondary"></div>
                        关系: <span className="text-neo-text font-mono">{data.links.length}</span>
                    </div>
                  </div>
               </>
             ) : (
               queryResult && (
                 <QueryResultTable columns={queryResult.columns} rows={queryResult.rows} />
               )
             )}

             {/* Properties/Relationship Panel - Responsive: Side Panel on Desktop, Bottom Sheet on Mobile */}
             {(selectedNode || selectedRelationship) && (
               <div className="fixed md:absolute inset-x-0 bottom-0 top-auto md:top-4 md:right-4 md:bottom-auto md:left-auto w-full md:w-80 h-[50vh] md:h-auto md:max-h-[calc(100%-2rem)] glass-panel md:rounded-xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up md:animate-slide-in-right z-70 border-t md:border border-neo-primary/20">

                 {/* Drag Handle for Mobile */}
                 <div className="w-full flex justify-center pt-2 pb-1 md:hidden bg-neo-bg/5 cursor-grab">
                    <div className="w-10 h-1 rounded-full bg-neo-dim/30"></div>
                 </div>

                 <div className="p-3 md:p-4 border-b border-neo-border bg-neo-bg/5 flex justify-between items-center">
                   <div className="flex items-center gap-2 overflow-hidden">
                      {selectedNode ? (
                        <>
                           <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-neo-bg text-sm shrink-0" style={{ backgroundColor: selectedNode.color || '#555' }}>
                            {selectedNode.labels[0]?.[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] md:text-xs text-neo-dim uppercase font-bold tracking-wider truncate">{selectedNode.labels.join(", ")}</div>
                              <div className="text-sm font-semibold text-neo-text truncate w-full">
                                {selectedNode.id ?? ''}
                              </div>
                          </div>
                        </>
                      ) : selectedRelationship ? (
                        <>
                           <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-neo-bg text-sm shrink-0 bg-neo-secondary">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                           <div className="min-w-0">
                             <div className="text-[10px] md:text-xs text-neo-dim uppercase font-bold tracking-wider truncate">关系</div>
                             <div className="text-sm font-semibold text-neo-text truncate w-full">
                               {selectedRelationship.type}
                             </div>
                           </div>
                        </>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                         <button
                             onClick={handleSaveChanges}
                             disabled={isSaving}
                             className="text-neo-dim hover:text-green-400 p-1 disabled:opacity-50"
                             title="保存更改"
                           >
                            {isSaving ? (
                              <div className="w-5 h-5 border-2 border-neo-dim border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-5 h-5" />
                            )}
                          </button>
                           <button
                             onClick={handleCancelEdit}
                             disabled={isSaving}
                             className="text-neo-dim hover:text-red-400 p-1 disabled:opacity-50"
                             title="取消"
                           >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="text-neo-dim hover:text-neo-text p-1"
                            title="编辑属性"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                       )}
                       <button onClick={() => { setSelectedNode(null); setSelectedRelationship(null); }} className="text-neo-dim hover:text-neo-text p-1">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                 </div>
                  <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                    {selectedNode ? (
                      <>
                        <h4 className="text-xs font-bold text-neo-primary uppercase mb-3 flex items-center gap-2">
                          <Search className="w-3 h-3" /> 节点属性
                        </h4>
                        <div className="space-y-2">
                           <div className="bg-neo-bg/40 rounded p-2 flex flex-col border border-neo-border/50">
                             <span className="text-[10px] text-neo-dim uppercase font-mono mb-0.5">标签</span>
                             <span className="text-sm text-neo-text">{selectedNode.labels.join(":")}</span>
                           </div>
                         {Object.entries(isEditing ? editedNodeProps : selectedNode.properties).map(([key, value]) => (
                            <div key={key} className="bg-neo-bg/40 rounded p-2 flex flex-col border border-neo-border/50 hover:border-neo-primary/30 transition-colors">
                             <span className="text-[10px] text-neo-dim uppercase font-mono mb-0.5">{key}</span>
                             {isEditing ? (
                               <input
                                 type="text"
                                 value={typeof editedNodeProps[key] === 'object' ? JSON.stringify(editedNodeProps[key], null, 2) : String(editedNodeProps[key] ?? '')}
                                 onChange={(e) => {
                                   try {
                                     // Try to parse as JSON, fallback to string
                                     const parsed = JSON.parse(e.target.value);
                                     handleNodePropChange(key, parsed);
                                   } catch {
                                     handleNodePropChange(key, e.target.value);
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
                              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>删除节点</span>
                            </button>
                         )}
                       </>
                      ) : selectedRelationship ? (
                       <>
                         <h4 className="text-xs font-bold text-neo-secondary uppercase mb-3 flex items-center gap-2">
                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                           </svg> 关系属性
                         </h4>
                         <div className="space-y-2">
                           <div className="bg-neo-bg/40 rounded p-2 flex flex-col border border-neo-border/50">
                             <span className="text-[10px] text-neo-dim uppercase font-mono mb-0.5">类型</span>
                             <span className="text-sm text-neo-text">{selectedRelationship.type}</span>
                           </div>
                           <div className="bg-neo-bg/40 rounded p-2 flex flex-col border border-neo-border/50">
                             <span className="text-[10px] text-neo-dim uppercase font-mono mb-0.5">起始节点</span>
                             <span className="text-sm text-neo-text">{selectedRelationship.startNode}</span>
                           </div>
                           <div className="bg-neo-bg/40 rounded p-2 flex flex-col border border-neo-border/50">
                             <span className="text-[10px] text-neo-dim uppercase font-mono mb-0.5">终止节点</span>
                             <span className="text-sm text-neo-text">{selectedRelationship.endNode}</span>
                           </div>
                         {Object.entries(isEditing ? editedRelProps : selectedRelationship.properties).map(([key, value]) => (
                            <div key={key} className="bg-neo-bg/40 rounded p-2 flex flex-col border border-neo-border/50 hover:border-neo-secondary/30 transition-colors">
                              <span className="text-[10px] text-neo-dim uppercase font-mono mb-0.5">{key}</span>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={typeof editedRelProps[key] === 'object' ? JSON.stringify(editedRelProps[key], null, 2) : String(editedRelProps[key] ?? '')}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      handleRelPropChange(key, parsed);
                                    } catch {
                                      handleRelPropChange(key, e.target.value);
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
               </div>
             )}
           </div>
         </div>
       </div>

        {/* Add Node Modal */}
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

        {/* Import/Export Modal */}
        {showImportExport && (
          <ImportExport
            driver={driver}
            database={config.database}
            graphData={data}
            onClose={() => setShowImportExport(false)}
            onImportComplete={runQuery}
          />
        )}
     </div>
   );
 };

export default Workspace;