import React, { useState, useEffect } from 'react';
import { Driver, Neo4jNode } from '../types';
import {
  getFulltextIndexes,
  createNodeFulltextIndex,
  dropFulltextIndex,
  fulltextSearchNodes,
  fuzzySearchNodes,
  getAvailableAnalyzers,
  FulltextIndex,
  SearchResult
} from '../services/neo4j/fulltext';
import { getSchemaInfo, SchemaInfo } from '../services/neo4j';
import {
  X, Search, Plus, Trash2, Loader2, FileText,
  ChevronDown, ChevronRight, AlertCircle, Star, Settings
} from 'lucide-react';

interface FulltextSearchProps {
  driver: Driver | null;
  database?: string;
  onClose: () => void;
  onSelectNode?: (node: Neo4jNode) => void;
}

const FulltextSearch: React.FC<FulltextSearchProps> = ({
  driver,
  database,
  onClose,
  onSelectNode
}) => {
  const [indexes, setIndexes] = useState<FulltextIndex[]>([]);
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search state
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<'normal' | 'fuzzy'>('normal');
  const [fuzziness, setFuzziness] = useState(2);
  
  // Create index state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newIndex, setNewIndex] = useState({
    name: '',
    labels: [] as string[],
    properties: [] as string[],
    analyzer: 'standard-no-stop-words'
  });
  
  const analyzers = getAvailableAnalyzers();

  useEffect(() => {
    loadData();
  }, [driver, database]);

  const loadData = async () => {
    if (!driver) return;

    setLoading(true);
    setError(null);

    try {
      const [indexesData, schemaData] = await Promise.all([
        getFulltextIndexes(driver, database),
        getSchemaInfo(driver, database)
      ]);
      setIndexes(indexesData);
      setSchema(schemaData);
      
      // Auto-select first node index
      const nodeIndex = indexesData.find(i => i.entityType === 'NODE');
      if (nodeIndex) {
        setSelectedIndex(nodeIndex.name);
      }
    } catch (err) {
      setError(`加载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    console.log('[FulltextSearch] handleSearch called', { driver: !!driver, selectedIndex, searchTerm });
    
    if (!driver) {
      console.log('[FulltextSearch] No driver');
      setError('没有数据库连接');
      return;
    }
    if (!selectedIndex) {
      console.log('[FulltextSearch] No index selected');
      setError('请先选择一个索引');
      return;
    }
    if (!searchTerm.trim()) {
      console.log('[FulltextSearch] No search term');
      setError('请输入搜索词');
      return;
    }

    setSearching(true);
    setError(null);

    try {
      let results: SearchResult[];
      
      console.log('[FulltextSearch] Searching with', { mode: searchMode, index: selectedIndex, term: searchTerm });
      
      if (searchMode === 'fuzzy') {
        results = await fuzzySearchNodes(driver, selectedIndex, searchTerm, fuzziness, 50, database);
      } else {
        results = await fulltextSearchNodes(driver, selectedIndex, searchTerm, 50, database);
      }
      
      console.log('[FulltextSearch] Search results:', results.length);
      setSearchResults(results);
      setHasSearched(true);
    } catch (err) {
      console.error('[FulltextSearch] Search error:', err);
      setError(`搜索失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateIndex = async () => {
    if (!driver || !newIndex.name || newIndex.labels.length === 0 || newIndex.properties.length === 0) return;

    setCreating(true);
    setError(null);

    try {
      await createNodeFulltextIndex(
        driver,
        newIndex.name,
        newIndex.labels,
        newIndex.properties,
        newIndex.analyzer,
        database
      );
      
      await loadData();
      setShowCreateForm(false);
      setNewIndex({ name: '', labels: [], properties: [], analyzer: 'standard-no-stop-words' });
    } catch (err) {
      setError(`创建索引失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteIndex = async (indexName: string) => {
    if (!driver) return;

    try {
      await dropFulltextIndex(driver, indexName, database);
      await loadData();
      if (selectedIndex === indexName) {
        setSelectedIndex('');
        setSearchResults([]);
      }
    } catch (err) {
      setError(`删除索引失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const toggleLabel = (label: string) => {
    setNewIndex(prev => ({
      ...prev,
      labels: prev.labels.includes(label)
        ? prev.labels.filter(l => l !== label)
        : [...prev.labels, label]
    }));
  };

  const toggleProperty = (prop: string) => {
    setNewIndex(prev => ({
      ...prev,
      properties: prev.properties.includes(prop)
        ? prev.properties.filter(p => p !== prop)
        : [...prev.properties, prop]
    }));
  };

  // Get all unique properties from selected labels
  const availableProperties = schema?.labels
    .filter(l => newIndex.labels.includes(l.label))
    .flatMap(l => l.properties)
    .filter((p, i, arr) => arr.indexOf(p) === i) || [];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" style={{ zIndex: 100 }}>
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neo-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-white font-medium">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" style={{ zIndex: 100 }}>
      <div className="glass-panel rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-neo-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neo-secondary/10 flex items-center justify-center">
              <Search className="w-5 h-5 text-neo-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">全文搜索</h2>
              <p className="text-xs text-neo-dim">
                {indexes.length} 个全文索引
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-3 py-2 bg-neo-secondary/20 hover:bg-neo-secondary/30 text-neo-secondary rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">新建索引</span>
            </button>
            <button onClick={onClose} className="text-neo-dim hover:text-white p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="p-4 border-b border-neo-border bg-neo-bg/50">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Index Name */}
                <div>
                  <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
                    索引名称
                  </label>
                  <input
                    type="text"
                    value={newIndex.name}
                    onChange={(e) => setNewIndex({ ...newIndex, name: e.target.value })}
                    placeholder="my_fulltext_index"
                    className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-secondary outline-none"
                  />
                </div>

                {/* Analyzer */}
                <div>
                  <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
                    分析器
                  </label>
                  <select
                    value={newIndex.analyzer}
                    onChange={(e) => setNewIndex({ ...newIndex, analyzer: e.target.value })}
                    className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-neo-secondary outline-none"
                  >
                    {analyzers.slice(0, 10).map(a => (
                      <option key={a.name} value={a.name}>{a.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Labels Selection */}
              <div>
                <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
                  节点标签 (可多选)
                </label>
                <div className="flex flex-wrap gap-2">
                  {schema?.labels.map(l => (
                    <button
                      key={l.label}
                      onClick={() => toggleLabel(l.label)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        newIndex.labels.includes(l.label)
                          ? 'bg-neo-secondary text-black'
                          : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-neo-secondary'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Properties Selection */}
              {newIndex.labels.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
                    索引属性 (可多选)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableProperties.map(p => (
                      <button
                        key={p}
                        onClick={() => toggleProperty(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          newIndex.properties.includes(p)
                            ? 'bg-neo-primary text-black'
                            : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-neo-primary'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-neo-dim hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateIndex}
                  disabled={creating || !newIndex.name || newIndex.labels.length === 0 || newIndex.properties.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-neo-secondary hover:bg-white text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      创建索引
                    </>
                  )}
                </button>
              </div>
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

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Index List */}
          <div className="w-64 border-r border-neo-border p-4 overflow-y-auto custom-scrollbar">
            <h3 className="text-xs font-bold text-neo-dim uppercase mb-3">索引列表</h3>
            {indexes.length === 0 ? (
              <p className="text-neo-dim text-sm">暂无全文索引</p>
            ) : (
              <div className="space-y-2">
                {indexes.filter(i => i.entityType === 'NODE').map(index => (
                  <div
                    key={index.name}
                    className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                      selectedIndex === index.name
                        ? 'bg-neo-secondary/20 border border-neo-secondary'
                        : 'bg-neo-bg border border-neo-border hover:border-neo-secondary/50'
                    }`}
                    onClick={() => setSelectedIndex(index.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-neo-secondary" />
                        <span className="text-sm text-white font-medium truncate">{index.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteIndex(index.name);
                        }}
                        className="p-1 text-neo-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-neo-dim">
                      {index.labelsOrTypes.join(', ')}
                    </div>
                    <div className="mt-1 text-xs text-neo-dim">
                      属性: {index.properties.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Search */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-neo-border">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="输入搜索词..."
                    className="w-full bg-neo-bg border border-neo-border rounded-lg py-2 pl-10 pr-4 text-white placeholder-neo-dim focus:ring-1 focus:ring-neo-secondary outline-none"
                    disabled={!selectedIndex}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={searchMode}
                    onChange={(e) => setSearchMode(e.target.value as 'normal' | 'fuzzy')}
                    className="bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-neo-secondary outline-none"
                  >
                    <option value="normal">精确搜索</option>
                    <option value="fuzzy">模糊搜索</option>
                  </select>
                  {searchMode === 'fuzzy' && (
                    <select
                      value={fuzziness}
                      onChange={(e) => setFuzziness(parseInt(e.target.value))}
                      className="bg-neo-bg border border-neo-border rounded-lg px-2 py-2 text-white text-sm focus:ring-1 focus:ring-neo-secondary outline-none"
                    >
                      <option value={1}>容错 1</option>
                      <option value={2}>容错 2</option>
                      <option value={3}>容错 3</option>
                    </select>
                  )}
                  <button
                    onClick={handleSearch}
                    disabled={searching || !selectedIndex || !searchTerm.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-neo-secondary hover:bg-white text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {searching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    搜索
                  </button>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {!selectedIndex ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-neo-dim mx-auto mb-4" />
                  <p className="text-neo-dim">请先选择一个索引</p>
                </div>
              ) : !hasSearched ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-neo-dim mx-auto mb-4" />
                  <p className="text-neo-dim">输入搜索词开始搜索</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-neo-dim mx-auto mb-4" />
                  <p className="text-neo-dim">未找到匹配结果</p>
                  <p className="text-neo-dim text-sm mt-2">尝试使用不同的搜索词或模糊搜索</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-neo-dim mb-4">
                    找到 {searchResults.length} 个结果
                  </div>
                  {searchResults.map((result, idx) => (
                    <div
                      key={`${result.node.id}-${idx}`}
                      className="bg-neo-bg rounded-lg border border-neo-border p-4 hover:border-neo-secondary/50 transition-colors cursor-pointer"
                      onClick={() => onSelectNode?.(result.node)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {result.node.labels.join(', ')}
                            </span>
                            <span className="text-xs text-neo-dim">
                              ID: {result.node.id}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-neo-dim">
                            {Object.entries(result.node.properties).slice(0, 5).map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="text-neo-primary">{key}:</span>
                                <span className="text-neo-text truncate max-w-md">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-neo-secondary">
                          <Star className="w-4 h-4" />
                          <span className="text-sm">{result.score.toFixed(3)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FulltextSearch;
