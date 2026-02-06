import React, { useState, useEffect } from 'react';
import { Driver } from '../types';
import {
  isGDSAvailable, getGDSVersion, listGraphProjections, createGraphProjection,
  dropGraphProjection, runPageRank, runLouvain, runDegreeCentrality,
  runBetweennessCentrality, runLabelPropagation, runWeaklyConnectedComponents,
  GraphProjection, PageRankResult, CommunityResult, CentralityResult
} from '../services/neo4j/algorithms';
import { getSchemaInfo, SchemaInfo } from '../services/neo4j';
import {
  X, Cpu, Plus, Trash2, Play, BarChart2, Users, GitBranch, Target, Layers
} from 'lucide-react';
import { Modal } from '../presentation/components/common/Modal';
import { ErrorAlert } from '../presentation/components/common/Alert';
import { WarningAlert } from '../presentation/components/common/Alert';
import { LoadingOverlay, LoadingButton } from '../presentation/components/common/Loading';
import { EmptyState } from '../presentation/components/common/Empty';

interface AlgorithmRunnerProps {
  driver: Driver | null;
  database?: string;
  onClose: () => void;
  onResultsReady?: (results: any) => void;
}

type AlgorithmType = 'pagerank' | 'louvain' | 'degree' | 'betweenness' | 'labelPropagation' | 'wcc';

interface AlgorithmConfig {
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'centrality' | 'community';
}

const ALGORITHMS: Record<AlgorithmType, AlgorithmConfig> = {
  pagerank: { name: 'PageRank', description: '计算节点重要性分数', icon: <BarChart2 className="w-4 h-4" />, category: 'centrality' },
  degree: { name: '度中心性', description: '计算节点的连接数', icon: <Target className="w-4 h-4" />, category: 'centrality' },
  betweenness: { name: '介数中心性', description: '计算节点作为桥梁的重要性', icon: <GitBranch className="w-4 h-4" />, category: 'centrality' },
  louvain: { name: 'Louvain 社区检测', description: '发现紧密连接的社区', icon: <Users className="w-4 h-4" />, category: 'community' },
  labelPropagation: { name: '标签传播', description: '基于标签传播的社区检测', icon: <Layers className="w-4 h-4" />, category: 'community' },
  wcc: { name: '弱连通分量', description: '找出所有连通的组件', icon: <Users className="w-4 h-4" />, category: 'community' }
};

const AlgorithmRunner: React.FC<AlgorithmRunnerProps> = ({ driver, database, onClose, onResultsReady }) => {
  const [gdsAvailable, setGdsAvailable] = useState<boolean | null>(null);
  const [gdsVersion, setGdsVersion] = useState<string | null>(null);
  const [projections, setProjections] = useState<GraphProjection[]>([]);
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmType>('pagerank');
  const [selectedProjection, setSelectedProjection] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<(PageRankResult | CommunityResult | CentralityResult)[]>([]);
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectionName, setNewProjectionName] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedRelTypes, setSelectedRelTypes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [basicMode, setBasicMode] = useState(false);
  const [basicResults, setBasicResults] = useState<any[]>([]);
  const [basicAlgorithm, setBasicAlgorithm] = useState<'degree' | 'distribution' | 'paths' | 'hubs'>('degree');

  useEffect(() => { checkGDS(); }, [driver]);

  const checkGDS = async () => {
    if (!driver) return;
    setLoading(true);
    setError(null);
    try {
      const available = await isGDSAvailable(driver);
      setGdsAvailable(available);
      if (available) {
        const [version, projList, schemaInfo] = await Promise.all([
          getGDSVersion(driver), listGraphProjections(driver), getSchemaInfo(driver, database)
        ]);
        setGdsVersion(version);
        setProjections(projList);
        setSchema(schemaInfo);
        if (projList.length > 0) setSelectedProjection(projList[0].name);
      }
    } catch (err) {
      setError(`检查 GDS 失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProjection = async () => {
    if (!driver || !newProjectionName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createGraphProjection(driver, newProjectionName.trim(),
        selectedLabels.length > 0 ? selectedLabels : '*' as any,
        selectedRelTypes.length > 0 ? selectedRelTypes : '*' as any, database);
      if (result.success) {
        await checkGDS();
        setShowCreateForm(false);
        setNewProjectionName('');
        setSelectedLabels([]);
        setSelectedRelTypes([]);
        setSelectedProjection(newProjectionName.trim());
      } else setError(result.error || '创建投影失败');
    } catch (err) {
      setError(`创建投影失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDropProjection = async (name: string) => {
    if (!driver) return;
    try {
      await dropGraphProjection(driver, name);
      await checkGDS();
      if (selectedProjection === name) { setSelectedProjection(''); setResults([]); }
    } catch (err) { setError(`删除投影失败: ${err instanceof Error ? err.message : '未知错误'}`); }
  };

  const handleRunAlgorithm = async () => {
    if (!driver || !selectedProjection) return;
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      let result;
      switch (selectedAlgorithm) {
        case 'pagerank': result = await runPageRank(driver, selectedProjection, {}, 100, database); break;
        case 'degree': result = await runDegreeCentrality(driver, selectedProjection, 'NATURAL', 100, database); break;
        case 'betweenness': result = await runBetweennessCentrality(driver, selectedProjection, {}, 100, database); break;
        case 'louvain': result = await runLouvain(driver, selectedProjection, {}, database); break;
        case 'labelPropagation': result = await runLabelPropagation(driver, selectedProjection, 10, database); break;
        case 'wcc': result = await runWeaklyConnectedComponents(driver, selectedProjection, database); break;
      }
      if (result?.success && result.data) { setResults(result.data); onResultsReady?.(result.data); }
      else setError(result?.error || '算法执行失败');
    } catch (err) { setError(`算法执行失败: ${err instanceof Error ? err.message : '未知错误'}`); }
    finally { setRunning(false); }
  };

  const toggleLabel = (label: string) => setSelectedLabels(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  const toggleRelType = (type: string) => setSelectedRelTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  const isCommunityAlgorithm = ALGORITHMS[selectedAlgorithm].category === 'community';

  if (loading) return <LoadingOverlay text="检查 GDS 可用性..." />;

  const runBasicAlgorithm = async () => {
    if (!driver) return;
    setRunning(true);
    setError(null);
    setBasicResults([]);
    try {
      const session = driver.session({ database });
      let query = '';
      switch (basicAlgorithm) {
        case 'degree': query = `MATCH (n) OPTIONAL MATCH (n)-[r]-() WITH n, count(r) as degree, labels(n) as labels RETURN id(n) as nodeId, labels, n.name as name, degree ORDER BY degree DESC LIMIT 100`; break;
        case 'distribution': query = `MATCH (n) WITH labels(n) as labels, count(*) as count RETURN labels, count ORDER BY count DESC`; break;
        case 'paths': query = `MATCH p = (a)-[*1..3]-(b) WHERE id(a) < id(b) WITH length(p) as pathLength, count(*) as pathCount RETURN pathLength, pathCount ORDER BY pathLength LIMIT 10`; break;
        case 'hubs': query = `MATCH (n) OPTIONAL MATCH (n)-[r]->() WITH n, count(r) as outDegree, labels(n) as labels OPTIONAL MATCH (n)<-[r2]-() WITH n, outDegree, count(r2) as inDegree, labels WITH n, outDegree, inDegree, outDegree + inDegree as totalDegree, labels WHERE totalDegree > 2 RETURN id(n) as nodeId, labels, n.name as name, outDegree, inDegree, totalDegree ORDER BY totalDegree DESC LIMIT 50`; break;
      }
      const result = await session.run(query);
      setBasicResults(result.records.map(r => r.toObject()));
      await session.close();
    } catch (err) { setError(`算法执行失败: ${err instanceof Error ? err.message : '未知错误'}`); }
    finally { setRunning(false); }
  };

  // Basic mode
  if (gdsAvailable === false || basicMode) {
    return (
      <Modal isOpen={true} onClose={onClose} title="图分析 (基础模式)" description="使用 Cypher 查询进行基础图分析"
        icon={<Cpu className="w-5 h-5 text-purple-400" />} iconColorClass="bg-purple-500/10" size="2xl"
        contentClassName="flex flex-col overflow-hidden">
        {!gdsAvailable && <WarningAlert message="GDS 未安装。当前为基础模式，提供简单的图分析功能。安装 GDS 可解锁更多高级算法。" />}
        <ErrorAlert message={error} dismissible onDismiss={() => setError(null)} />
        <div className="flex-1 flex overflow-hidden">
          <div className="w-56 border-r border-neo-border p-4 space-y-2">
            <h3 className="text-xs font-bold text-neo-dim uppercase mb-3">基础算法</h3>
            {(['degree', 'hubs', 'distribution', 'paths'] as const).map(algo => (
              <button key={algo} onClick={() => setBasicAlgorithm(algo)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${basicAlgorithm === algo ? 'bg-purple-500/20 border border-purple-400' : 'bg-neo-bg border border-neo-border hover:border-purple-400/50'}`}>
                <div className="text-sm text-white font-medium">
                  {algo === 'degree' ? '度中心性' : algo === 'hubs' ? '枢纽节点' : algo === 'distribution' ? '标签分布' : '路径统计'}
                </div>
                <p className="text-xs text-neo-dim">
                  {algo === 'degree' ? '计算节点连接数' : algo === 'hubs' ? '找出高连接度节点' : algo === 'distribution' ? '节点类型统计' : '路径长度分布'}
                </p>
              </button>
            ))}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neo-border">
              <LoadingButton onClick={runBasicAlgorithm} loading={running} loadingText="运行中..."
                icon={<Play className="w-5 h-5" />} fullWidth
                className="py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-colors">
                运行分析
              </LoadingButton>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {basicResults.length === 0 ? (
                <EmptyState icon={<Cpu className="w-12 h-12" />} title="选择算法并点击运行" />
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-neo-dim mb-4">{basicResults.length} 个结果</div>
                  {basicResults.map((result, idx) => (
                    <div key={idx} className="bg-neo-bg rounded-lg border border-neo-border p-3">
                      {basicAlgorithm === 'degree' || basicAlgorithm === 'hubs' ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-white font-medium">{result.labels?.join(', ')}</span>
                            {result.name && <span className="text-neo-primary text-sm ml-2">{result.name}</span>}
                          </div>
                          <div className="text-right text-sm">
                            {basicAlgorithm === 'hubs' ? (
                              <div className="flex gap-3">
                                <span className="text-green-400">出:{result.outDegree?.low ?? result.outDegree}</span>
                                <span className="text-blue-400">入:{result.inDegree?.low ?? result.inDegree}</span>
                                <span className="text-purple-400 font-medium">总:{result.totalDegree?.low ?? result.totalDegree}</span>
                              </div>
                            ) : (
                              <span className="text-purple-400 font-medium">度: {result.degree?.low ?? result.degree}</span>
                            )}
                          </div>
                        </div>
                      ) : basicAlgorithm === 'distribution' ? (
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{result.labels?.join(', ') || '(无标签)'}</span>
                          <span className="text-purple-400 font-medium">{result.count?.low ?? result.count} 个节点</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">路径长度 {result.pathLength?.low ?? result.pathLength}</span>
                          <span className="text-purple-400 font-medium">{result.pathCount?.low ?? result.pathCount} 条路径</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // GDS mode
  return (
    <Modal isOpen={true} onClose={onClose} title="图算法"
      description={gdsVersion ? `GDS ${gdsVersion}` : undefined}
      icon={<Cpu className="w-5 h-5 text-purple-400" />} iconColorClass="bg-purple-500/10" size="4xl"
      contentClassName="flex overflow-hidden">
      <ErrorAlert message={error} dismissible onDismiss={() => setError(null)} />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-neo-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-neo-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-neo-dim uppercase">图投影</h3>
              <button onClick={() => setShowCreateForm(!showCreateForm)} className="p-1 text-neo-primary hover:bg-neo-primary/20 rounded">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {showCreateForm && (
              <div className="mb-3 p-3 bg-neo-bg rounded-lg border border-neo-border space-y-3">
                <input type="text" value={newProjectionName} onChange={(e) => setNewProjectionName(e.target.value)} placeholder="投影名称"
                  className="w-full bg-neo-panel border border-neo-border rounded px-2 py-1.5 text-sm text-white placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none" />
                {schema && (
                  <>
                    <div>
                      <div className="text-xs text-neo-dim mb-1">节点标签 (留空=全部)</div>
                      <div className="flex flex-wrap gap-1">
                        {schema.labels.map(l => (
                          <button key={l.label} onClick={() => toggleLabel(l.label)}
                            className={`px-2 py-0.5 rounded text-xs ${selectedLabels.includes(l.label) ? 'bg-neo-primary text-black' : 'bg-neo-panel text-neo-dim'}`}>{l.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-neo-dim mb-1">关系类型 (留空=全部)</div>
                      <div className="flex flex-wrap gap-1">
                        {schema.relationships.map(r => (
                          <button key={r.type} onClick={() => toggleRelType(r.type)}
                            className={`px-2 py-0.5 rounded text-xs ${selectedRelTypes.includes(r.type) ? 'bg-neo-secondary text-black' : 'bg-neo-panel text-neo-dim'}`}>{r.type}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <button onClick={handleCreateProjection} disabled={creating || !newProjectionName.trim()}
                  className="w-full py-1.5 bg-neo-primary text-black text-sm font-medium rounded disabled:opacity-50">
                  {creating ? '创建中...' : '创建投影'}
                </button>
              </div>
            )}
            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
              {projections.map(proj => (
                <div key={proj.name}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group ${selectedProjection === proj.name ? 'bg-purple-500/20 border border-purple-400' : 'bg-neo-bg border border-neo-border hover:border-purple-400/50'}`}
                  onClick={() => setSelectedProjection(proj.name)}>
                  <div>
                    <div className="text-sm text-white font-medium">{proj.name}</div>
                    <div className="text-xs text-neo-dim">{proj.nodeCount} 节点, {proj.relationshipCount} 关系</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDropProjection(proj.name); }}
                    className="p-1 text-neo-dim hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              {projections.length === 0 && <p className="text-neo-dim text-sm text-center py-4">暂无图投影</p>}
            </div>
          </div>
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            <h3 className="text-xs font-bold text-neo-dim uppercase mb-3">算法</h3>
            <div className="space-y-2">
              {(Object.entries(ALGORITHMS) as [AlgorithmType, AlgorithmConfig][]).map(([key, algo]) => (
                <button key={key} onClick={() => setSelectedAlgorithm(key)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedAlgorithm === key ? 'bg-purple-500/20 border border-purple-400' : 'bg-neo-bg border border-neo-border hover:border-purple-400/50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">{algo.icon}</span>
                    <span className="text-sm text-white font-medium">{algo.name}</span>
                  </div>
                  <p className="text-xs text-neo-dim mt-1">{algo.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-neo-border">
            <LoadingButton onClick={handleRunAlgorithm} loading={running} disabled={!selectedProjection}
              loadingText="运行中..." icon={<Play className="w-5 h-5" />} fullWidth
              className="py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-colors">
              运行 {ALGORITHMS[selectedAlgorithm].name}
            </LoadingButton>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {results.length === 0 ? (
              <EmptyState icon={<Cpu className="w-12 h-12" />} title="选择一个算法并点击运行" />
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-neo-dim mb-4">{results.length} 个结果</div>
                {results.slice(0, 100).map((result, idx) => (
                  <div key={`${result.nodeId}-${idx}`} className="bg-neo-bg rounded-lg border border-neo-border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-medium">{result.labels?.join(', ')}</span>
                        <span className="text-neo-dim text-sm ml-2">ID: {result.nodeId}</span>
                        {result.properties?.name && <span className="text-neo-primary text-sm ml-2">{result.properties.name}</span>}
                      </div>
                      <div className="text-right">
                        {isCommunityAlgorithm ? (
                          <span className="text-purple-400 font-medium">社区 {(result as CommunityResult).communityId}</span>
                        ) : (
                          <span className="text-purple-400 font-medium">{(result as CentralityResult).score?.toFixed(4)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AlgorithmRunner;
