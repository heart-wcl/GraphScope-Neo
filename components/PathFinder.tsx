import React, { useState, useEffect } from 'react';
import { Driver, Neo4jNode, Neo4jRelationship, GraphData } from '../types';
import {
  findShortestPath,
  findAllPaths,
  findAllShortestPaths,
  areNodesConnected,
  PathResult,
  PathOptions
} from '../services/neo4j/paths';
import { getAllNodes, getSchemaInfo, SchemaInfo } from '../services/neo4j';
import {
  Route, Search, ArrowRight, GitBranch, Target, Play
} from 'lucide-react';
import { Modal } from '../presentation/components/common/Modal';
import { ErrorAlert } from '../presentation/components/common/Alert';
import { WarningAlert } from '../presentation/components/common/Alert';
import { LoadingOverlay, LoadingButton } from '../presentation/components/common/Loading';

interface PathFinderProps {
  driver: Driver | null;
  database?: string;
  onClose: () => void;
  onPathFound?: (graphData: GraphData) => void;
  initialStartNode?: Neo4jNode;
  initialEndNode?: Neo4jNode;
}

type PathMode = 'shortest' | 'allShortest' | 'allPaths';

const PathFinder: React.FC<PathFinderProps> = ({
  driver,
  database,
  onClose,
  onPathFound,
  initialStartNode,
  initialEndNode
}) => {
  const [nodes, setNodes] = useState<Neo4jNode[]>([]);
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [startNodeId, setStartNodeId] = useState<string>(initialStartNode?.id || '');
  const [endNodeId, setEndNodeId] = useState<string>(initialEndNode?.id || '');
  const [startSearch, setStartSearch] = useState('');
  const [endSearch, setEndSearch] = useState('');
  
  const [pathMode, setPathMode] = useState<PathMode>('shortest');
  const [selectedRelTypes, setSelectedRelTypes] = useState<string[]>([]);
  const [direction, setDirection] = useState<'BOTH' | 'OUTGOING' | 'INCOMING'>('BOTH');
  const [maxDepth, setMaxDepth] = useState(10);
  const [maxPaths, setMaxPaths] = useState(10);
  
  const [paths, setPaths] = useState<PathResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => { loadData(); }, [driver, database]);
  useEffect(() => {
    if (initialStartNode) setStartNodeId(initialStartNode.id);
    if (initialEndNode) setEndNodeId(initialEndNode.id);
  }, [initialStartNode, initialEndNode]);

  const loadData = async () => {
    if (!driver) return;
    setLoading(true);
    setError(null);
    try {
      const [nodesData, schemaData] = await Promise.all([
        getAllNodes(driver, database, 500),
        getSchemaInfo(driver, database)
      ]);
      setNodes(nodesData);
      setSchema(schemaData);
    } catch (err) {
      setError(`加载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFindPath = async () => {
    if (!driver || !startNodeId || !endNodeId) return;
    setSearching(true);
    setError(null);
    setPaths([]);
    setIsConnected(null);
    try {
      const connected = await areNodesConnected(driver, startNodeId, endNodeId, maxDepth, database);
      setIsConnected(connected);
      if (!connected) { setSearching(false); return; }
      const options: PathOptions = {
        relationshipTypes: selectedRelTypes.length > 0 ? selectedRelTypes : undefined,
        direction,
        maxDepth
      };
      let results: PathResult[];
      switch (pathMode) {
        case 'shortest':
          const shortest = await findShortestPath(driver, startNodeId, endNodeId, options, database);
          results = shortest ? [shortest] : [];
          break;
        case 'allShortest':
          results = await findAllShortestPaths(driver, startNodeId, endNodeId, options, database);
          break;
        case 'allPaths':
          results = await findAllPaths(driver, startNodeId, endNodeId, options, maxPaths, database);
          break;
        default: results = [];
      }
      setPaths(results);
      if (results.length > 0 && onPathFound) {
        const mergedNodes = new Map<string, Neo4jNode>();
        const mergedRels = new Map<string, Neo4jRelationship>();
        results.forEach(path => {
          path.nodes.forEach(n => mergedNodes.set(n.id, n));
          path.relationships.forEach(r => mergedRels.set(r.id, r));
        });
        onPathFound({ nodes: Array.from(mergedNodes.values()), links: Array.from(mergedRels.values()) });
      }
    } catch (err) {
      setError(`查找路径失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSearching(false);
    }
  };

  const filteredStartNodes = nodes.filter(n =>
    startSearch === '' || n.labels.some(l => l.toLowerCase().includes(startSearch.toLowerCase())) ||
    Object.values(n.properties).some(v => String(v).toLowerCase().includes(startSearch.toLowerCase()))
  );
  const filteredEndNodes = nodes.filter(n =>
    endSearch === '' || n.labels.some(l => l.toLowerCase().includes(endSearch.toLowerCase())) ||
    Object.values(n.properties).some(v => String(v).toLowerCase().includes(endSearch.toLowerCase()))
  );

  const toggleRelType = (type: string) => {
    setSelectedRelTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const getNodeDisplay = (node: Neo4jNode) => {
    const name = node.properties.name || node.properties.title || node.properties.id || node.id;
    return `${node.labels.join(', ')} - ${name}`;
  };

  if (loading) {
    return <LoadingOverlay text="加载中..." />;
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="路径查找"
      description="在图中查找两个节点之间的路径"
      icon={<Route className="w-5 h-5 text-green-400" />}
      iconColorClass="bg-green-500/10"
    >
      <ErrorAlert message={error} dismissible onDismiss={() => setError(null)} />

      <div className="p-4 md:p-6 space-y-6">
        {/* Node Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
              <Target className="w-3 h-3 inline mr-1" /> 起始节点
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
                <input type="text" value={startSearch} onChange={(e) => setStartSearch(e.target.value)} placeholder="搜索节点..."
                  className="w-full bg-neo-bg border border-neo-border rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-neo-dim focus:ring-1 focus:ring-green-400 outline-none" />
              </div>
              <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                {filteredStartNodes.slice(0, 50).map(node => (
                  <button key={node.id} onClick={() => setStartNodeId(node.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${startNodeId === node.id ? 'bg-green-500/20 border border-green-400 text-white' : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-green-400/50'}`}>
                    {getNodeDisplay(node)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
              <Target className="w-3 h-3 inline mr-1" /> 目标节点
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
                <input type="text" value={endSearch} onChange={(e) => setEndSearch(e.target.value)} placeholder="搜索节点..."
                  className="w-full bg-neo-bg border border-neo-border rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-neo-dim focus:ring-1 focus:ring-neo-primary outline-none" />
              </div>
              <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                {filteredEndNodes.slice(0, 50).map(node => (
                  <button key={node.id} onClick={() => setEndNodeId(node.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${endNodeId === node.id ? 'bg-neo-primary/20 border border-neo-primary text-white' : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-neo-primary/50'}`}>
                    {getNodeDisplay(node)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">路径类型</label>
            <select value={pathMode} onChange={(e) => setPathMode(e.target.value as PathMode)}
              className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-neo-primary outline-none">
              <option value="shortest">最短路径</option>
              <option value="allShortest">所有最短路径</option>
              <option value="allPaths">所有路径</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">方向</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as 'BOTH' | 'OUTGOING' | 'INCOMING')}
              className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-neo-primary outline-none">
              <option value="BOTH">双向</option>
              <option value="OUTGOING">仅出向</option>
              <option value="INCOMING">仅入向</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">最大深度</label>
            <input type="number" value={maxDepth} onChange={(e) => setMaxDepth(parseInt(e.target.value) || 10)} min={1} max={50}
              className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-neo-primary outline-none" />
          </div>
        </div>

        {/* Relationship Types Filter */}
        {schema && schema.relationships.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
              <GitBranch className="w-3 h-3 inline mr-1" /> 关系类型过滤 (留空表示所有类型)
            </label>
            <div className="flex flex-wrap gap-2">
              {schema.relationships.map(r => (
                <button key={r.type} onClick={() => toggleRelType(r.type)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedRelTypes.includes(r.type) ? 'bg-neo-secondary text-black' : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-neo-secondary'}`}>
                  {r.type}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Find Button */}
        <div className="flex justify-center">
          <LoadingButton onClick={handleFindPath} loading={searching}
            disabled={!startNodeId || !endNodeId || startNodeId === endNodeId}
            loadingText="查找中..." icon={<Play className="w-5 h-5" />}
            className="px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-colors">
            查找路径
          </LoadingButton>
        </div>

        {/* Results */}
        {isConnected === false && (
          <WarningAlert message="两个节点不连通，在指定深度内未找到连接路径" />
        )}

        {paths.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">找到 {paths.length} 条路径</h3>
            <div className="space-y-3">
              {paths.map((path, idx) => (
                <div key={idx} className="bg-neo-bg rounded-lg border border-neo-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">路径 {idx + 1}</span>
                    <span className="text-xs text-neo-dim">
                      长度: {path.length} 跳{path.cost !== undefined && ` | 代价: ${path.cost.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-2">
                    {path.nodes.map((node, nodeIdx) => (
                      <React.Fragment key={node.id}>
                        <div className="px-3 py-1.5 rounded-lg text-sm"
                          style={{ backgroundColor: `${node.color}20`, borderColor: node.color, borderWidth: 1 }}>
                          <span className="text-white">{node.labels[0]}</span>
                          {node.properties.name && <span className="text-neo-dim ml-1">({node.properties.name})</span>}
                        </div>
                        {nodeIdx < path.nodes.length - 1 && path.relationships[nodeIdx] && (
                          <div className="flex items-center gap-1 text-neo-dim">
                            <ArrowRight className="w-4 h-4" />
                            <span className="text-xs text-neo-secondary">{path.relationships[nodeIdx].type}</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PathFinder;
