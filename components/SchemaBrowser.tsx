import React, { useState, useEffect } from 'react';
import { SchemaInfo, NodeLabel, RelationshipType, getSchemaInfo } from '../services/neo4j';
import { Driver } from '../types';
import { Database, GitBranch, Layers, Search, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { Modal } from '../presentation/components/common/Modal';
import { ErrorAlert } from '../presentation/components/common/Alert';
import { LoadingOverlay } from '../presentation/components/common/Loading';
import { EmptyState } from '../presentation/components/common/Empty';

interface SchemaBrowserProps {
  driver: Driver | null;
  database?: string;
  onClose: () => void;
  onSelectLabel?: (label: string) => void;
  onSelectRelationship?: (type: string) => void;
}

const SchemaBrowser: React.FC<SchemaBrowserProps> = ({
  driver,
  database,
  onClose,
  onSelectLabel,
  onSelectRelationship
}) => {
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(new Set());
  const [expandedRels, setExpandedRels] = useState<Set<string>>(new Set());
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => { loadSchema(); }, [driver, database]);

  const loadSchema = async () => {
    if (!driver) return;
    setLoading(true);
    setError(null);
    try {
      const schemaInfo = await getSchemaInfo(driver, database);
      setSchema(schemaInfo);
    } catch (err) {
      setError(`Failed to load schema: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleLabel = (label: string) => {
    const newExpanded = new Set(expandedLabels);
    newExpanded.has(label) ? newExpanded.delete(label) : newExpanded.add(label);
    setExpandedLabels(newExpanded);
  };

  const toggleRel = (type: string) => {
    const newExpanded = new Set(expandedRels);
    newExpanded.has(type) ? newExpanded.delete(type) : newExpanded.add(type);
    setExpandedRels(newExpanded);
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  const filteredLabels = schema?.labels.filter(l =>
    l.label.toLowerCase().includes(filter.toLowerCase()) ||
    l.properties.some(p => p.toLowerCase().includes(filter.toLowerCase()))
  ) || [];

  const filteredRels = schema?.relationships.filter(r =>
    r.type.toLowerCase().includes(filter.toLowerCase()) ||
    r.properties.some(p => p.toLowerCase().includes(filter.toLowerCase()))
  ) || [];

  const generateCypher = (label: NodeLabel) => {
    const props = label.properties.map(p => `${p}: 'value'`).join(', ');
    return `MATCH (n:${label.label}${props ? ` { ${props} }` : ''}) RETURN n LIMIT 25`;
  };

  const generateRelCypher = (rel: RelationshipType) => {
    const from = rel.fromLabels[0] || 'Start';
    const to = rel.toLabels[0] || 'End';
    return `MATCH (a:${from})-[r:${rel.type}]->(b:${to}) RETURN a, r, b LIMIT 25`;
  };

  if (loading) {
    return <LoadingOverlay text="加载模式中..." />;
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="数据库模式"
      description={`${schema?.labels.length || 0} 种节点类型，${schema?.relationships.length || 0} 种关系类型`}
      icon={<Database className="w-5 h-5 text-neo-primary" />}
    >
      {/* Search */}
      <div className="p-4 border-b border-neo-border">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="搜索标签、关系、属性..."
            className="w-full bg-neo-bg border border-neo-border rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-neo-dim focus:ring-1 focus:ring-neo-primary outline-none" />
        </div>
      </div>

      <ErrorAlert message={error} />

      <div className="p-4 md:p-6 space-y-6">
        {/* Node Labels Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-neo-primary" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">节点标签</h3>
          </div>
          {filteredLabels.length === 0 ? (
            <p className="text-neo-dim text-sm">未找到节点标签。</p>
          ) : (
            <div className="space-y-2">
              {filteredLabels.map(label => (
                <div key={label.label} className="bg-neo-bg rounded-lg border border-neo-border overflow-hidden">
                  <button onClick={() => toggleLabel(label.label)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      {expandedLabels.has(label.label) ? <ChevronDown className="w-4 h-4 text-neo-dim" /> : <ChevronRight className="w-4 h-4 text-neo-dim" />}
                      <span className="font-medium text-white">{label.label}</span>
                      <span className="text-xs text-neo-dim bg-neo-panel px-2 py-0.5 rounded-full">{label.count.toLocaleString()} 个节点</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(`:${label.label}`, label.label); }}
                      className="text-neo-dim hover:text-white p-1" title="复制标签">
                      {copiedLabel === label.label ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </button>
                  {expandedLabels.has(label.label) && (
                    <div className="px-4 pb-4 border-t border-neo-border">
                      <div className="mt-3">
                        <span className="text-xs text-neo-dim uppercase font-mono">属性</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {label.properties.map(prop => (
                            <span key={prop} className="text-xs bg-neo-panel text-neo-primary px-2 py-1 rounded">{prop}</span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3">
                        <span className="text-xs text-neo-dim uppercase font-mono">快速查询</span>
                        <button onClick={() => onSelectLabel?.(generateCypher(label))}
                          className="mt-2 w-full text-left bg-black/40 rounded p-2 font-mono text-xs text-neo-dim hover:bg-black/60 transition-colors">
                          {generateCypher(label)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Relationship Types Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-neo-secondary" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">关系类型</h3>
          </div>
          {filteredRels.length === 0 ? (
            <p className="text-neo-dim text-sm">未找到关系类型。</p>
          ) : (
            <div className="space-y-2">
              {filteredRels.map(rel => (
                <div key={rel.type} className="bg-neo-bg rounded-lg border border-neo-border overflow-hidden">
                  <button onClick={() => toggleRel(rel.type)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      {expandedRels.has(rel.type) ? <ChevronDown className="w-4 h-4 text-neo-dim" /> : <ChevronRight className="w-4 h-4 text-neo-dim" />}
                      <span className="font-medium text-white">{rel.type}</span>
                      <span className="text-xs text-neo-dim bg-neo-panel px-2 py-0.5 rounded-full">{rel.count.toLocaleString()} 条关系</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(`:${rel.type}`, rel.type); }}
                      className="text-neo-dim hover:text-white p-1" title="复制关系类型">
                      {copiedLabel === rel.type ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </button>
                  {expandedRels.has(rel.type) && (
                    <div className="px-4 pb-4 border-t border-neo-border">
                      <div className="mt-3 flex gap-4">
                        <div>
                          <span className="text-xs text-neo-dim uppercase font-mono">起始节点</span>
                          <div className="flex gap-1 mt-1">
                            {rel.fromLabels.map(l => (
                              <span key={l} className="text-xs bg-neo-primary/20 text-neo-primary px-2 py-1 rounded">{l}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-neo-dim uppercase font-mono">终止节点</span>
                          <div className="flex gap-1 mt-1">
                            {rel.toLabels.map(l => (
                              <span key={l} className="text-xs bg-neo-secondary/20 text-neo-secondary px-2 py-1 rounded">{l}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {rel.properties.length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs text-neo-dim uppercase font-mono">属性</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {rel.properties.map(prop => (
                              <span key={prop} className="text-xs bg-neo-panel text-neo-dim px-2 py-1 rounded">{prop}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-3">
                        <span className="text-xs text-neo-dim uppercase font-mono">快速查询</span>
                        <button onClick={() => onSelectRelationship?.(generateRelCypher(rel))}
                          className="mt-2 w-full text-left bg-black/40 rounded p-2 font-mono text-xs text-neo-dim hover:bg-black/60 transition-colors">
                          {generateRelCypher(rel)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default SchemaBrowser;
