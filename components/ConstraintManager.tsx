import React, { useState, useEffect } from 'react';
import { Driver } from '../types';
import { 
  getConstraints, 
  createUniqueConstraint, 
  createNodeExistenceConstraint,
  createNodeKeyConstraint,
  dropConstraint,
  Constraint 
} from '../services/neo4j/constraints';
import { getSchemaInfo, SchemaInfo } from '../services/neo4j';
import { 
  X, Shield, Plus, Trash2, Loader2, Search, 
  ChevronDown, ChevronRight, Key, CheckCircle, AlertCircle 
} from 'lucide-react';

interface ConstraintManagerProps {
  driver: Driver | null;
  database?: string;
  onClose: () => void;
}

type ConstraintType = 'UNIQUE' | 'EXISTENCE' | 'NODE_KEY';

interface NewConstraintForm {
  type: ConstraintType;
  label: string;
  properties: string[];
  name: string;
}

const ConstraintManager: React.FC<ConstraintManagerProps> = ({
  driver,
  database,
  onClose
}) => {
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [newConstraint, setNewConstraint] = useState<NewConstraintForm>({
    type: 'UNIQUE',
    label: '',
    properties: [''],
    name: ''
  });

  useEffect(() => {
    loadData();
  }, [driver, database]);

  const loadData = async () => {
    if (!driver) return;

    setLoading(true);
    setError(null);

    try {
      const [constraintsData, schemaData] = await Promise.all([
        getConstraints(driver, database),
        getSchemaInfo(driver, database)
      ]);
      setConstraints(constraintsData);
      setSchema(schemaData);
    } catch (err) {
      setError(`加载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConstraint = async () => {
    if (!driver || !newConstraint.label || newConstraint.properties.filter(p => p).length === 0) return;

    setCreating(true);
    setError(null);

    try {
      const validProps = newConstraint.properties.filter(p => p.trim());
      const constraintName = newConstraint.name || undefined;

      switch (newConstraint.type) {
        case 'UNIQUE':
          await createUniqueConstraint(
            driver,
            newConstraint.label,
            validProps[0],
            constraintName,
            { ifNotExists: true },
            database
          );
          break;
        case 'EXISTENCE':
          await createNodeExistenceConstraint(
            driver,
            newConstraint.label,
            validProps[0],
            constraintName,
            { ifNotExists: true },
            database
          );
          break;
        case 'NODE_KEY':
          await createNodeKeyConstraint(
            driver,
            newConstraint.label,
            validProps,
            constraintName,
            { ifNotExists: true },
            database
          );
          break;
      }

      await loadData();
      setShowCreateForm(false);
      setNewConstraint({ type: 'UNIQUE', label: '', properties: [''], name: '' });
    } catch (err) {
      setError(`创建约束失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteConstraint = async (constraintName: string) => {
    if (!driver) return;

    setDeleting(constraintName);
    setError(null);

    try {
      await dropConstraint(driver, constraintName, true, database);
      await loadData();
    } catch (err) {
      setError(`删除约束失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setDeleting(null);
    }
  };

  const filteredConstraints = constraints.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.labelsOrTypes.some(l => l.toLowerCase().includes(filter.toLowerCase())) ||
    c.properties.some(p => p.toLowerCase().includes(filter.toLowerCase()))
  );

  const getConstraintIcon = (type: string) => {
    switch (type) {
      case 'UNIQUENESS':
        return <Key className="w-4 h-4 text-neo-primary" />;
      case 'NODE_KEY':
        return <Key className="w-4 h-4 text-neo-secondary" />;
      case 'NODE_PROPERTY_EXISTENCE':
      case 'RELATIONSHIP_PROPERTY_EXISTENCE':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      default:
        return <Shield className="w-4 h-4 text-neo-dim" />;
    }
  };

  const getConstraintTypeLabel = (type: string) => {
    switch (type) {
      case 'UNIQUENESS':
        return '唯一性';
      case 'NODE_KEY':
        return '节点键';
      case 'NODE_PROPERTY_EXISTENCE':
        return '节点属性存在性';
      case 'RELATIONSHIP_PROPERTY_EXISTENCE':
        return '关系属性存在性';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" style={{ zIndex: 100 }}>
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neo-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-white font-medium">加载约束中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" style={{ zIndex: 100 }}>
      <div className="glass-panel rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-neo-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neo-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-neo-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">约束管理</h2>
              <p className="text-xs text-neo-dim">
                {constraints.length} 个约束
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-3 py-2 bg-neo-primary/20 hover:bg-neo-primary/30 text-neo-primary rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">新建约束</span>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Constraint Type */}
                <div>
                  <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
                    约束类型
                  </label>
                  <select
                    value={newConstraint.type}
                    onChange={(e) => setNewConstraint({ ...newConstraint, type: e.target.value as ConstraintType })}
                    className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-neo-primary outline-none"
                  >
                    <option value="UNIQUE">唯一性约束</option>
                    <option value="EXISTENCE">存在性约束</option>
                    <option value="NODE_KEY">节点键约束</option>
                  </select>
                </div>

                {/* Label Selection */}
                <div>
                  <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
                    节点标签
                  </label>
                  <select
                    value={newConstraint.label}
                    onChange={(e) => setNewConstraint({ ...newConstraint, label: e.target.value })}
                    className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-neo-primary outline-none"
                  >
                    <option value="">选择标签...</option>
                    {schema?.labels.map(l => (
                      <option key={l.label} value={l.label}>{l.label}</option>
                    ))}
                  </select>
                </div>

                {/* Constraint Name */}
                <div>
                  <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
                    约束名称 (可选)
                  </label>
                  <input
                    type="text"
                    value={newConstraint.name}
                    onChange={(e) => setNewConstraint({ ...newConstraint, name: e.target.value })}
                    placeholder="自动生成"
                    className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
                  />
                </div>
              </div>

              {/* Properties */}
              <div>
                <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
                  属性 {newConstraint.type === 'NODE_KEY' && '(可多选)'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {newConstraint.properties.map((prop, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={prop}
                        onChange={(e) => {
                          const newProps = [...newConstraint.properties];
                          newProps[idx] = e.target.value;
                          setNewConstraint({ ...newConstraint, properties: newProps });
                        }}
                        className="bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-neo-primary outline-none"
                      >
                        <option value="">选择属性...</option>
                        {schema?.labels
                          .find(l => l.label === newConstraint.label)
                          ?.properties.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))
                        }
                      </select>
                      {newConstraint.type === 'NODE_KEY' && idx === newConstraint.properties.length - 1 && (
                        <button
                          onClick={() => setNewConstraint({ 
                            ...newConstraint, 
                            properties: [...newConstraint.properties, ''] 
                          })}
                          className="p-2 text-neo-primary hover:bg-neo-primary/20 rounded-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-neo-dim hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateConstraint}
                  disabled={creating || !newConstraint.label || !newConstraint.properties[0]}
                  className="flex items-center gap-2 px-4 py-2 bg-neo-primary hover:bg-white text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      创建约束
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-neo-border">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="搜索约束..."
              className="w-full bg-neo-bg border border-neo-border rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-neo-dim focus:ring-1 focus:ring-neo-primary outline-none"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-neo-border flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          {filteredConstraints.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-neo-dim mx-auto mb-4" />
              <p className="text-neo-dim">暂无约束</p>
              <p className="text-neo-dim text-sm mt-1">点击"新建约束"按钮创建第一个约束</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConstraints.map(constraint => (
                <div
                  key={constraint.name}
                  className="bg-neo-bg rounded-lg border border-neo-border p-4 hover:border-neo-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getConstraintIcon(constraint.type)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{constraint.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-neo-panel text-neo-primary px-2 py-0.5 rounded">
                            {getConstraintTypeLabel(constraint.type)}
                          </span>
                          <span className="text-xs text-neo-dim">
                            {constraint.entityType === 'NODE' ? '节点' : '关系'}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-neo-dim">
                          <span className="text-neo-text">{constraint.labelsOrTypes.join(', ')}</span>
                          <span className="mx-1">→</span>
                          <span className="text-neo-secondary">{constraint.properties.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteConstraint(constraint.name)}
                      disabled={deleting === constraint.name}
                      className="p-2 text-neo-dim hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                      title="删除约束"
                    >
                      {deleting === constraint.name ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConstraintManager;
