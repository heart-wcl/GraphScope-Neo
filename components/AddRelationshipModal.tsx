import React, { useState, useEffect } from 'react';
import { Neo4jNode } from '../types';
import { SchemaInfo } from '../services/neo4j';
import { X, Plus, Loader2, Search, Link } from 'lucide-react';

interface AddRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (endNodeId: string, relationshipType: string, properties: Record<string, any>) => Promise<void>;
  sourceNode: Neo4jNode | null;
  availableNodes: Neo4jNode[];
  schemaInfo: SchemaInfo | null;
  isLoading: boolean;
  error: string | null;
}

const AddRelationshipModal: React.FC<AddRelationshipModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  sourceNode,
  availableNodes,
  schemaInfo,
  isLoading,
  error
}) => {
  const [relationshipType, setRelationshipType] = useState('');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [properties, setProperties] = useState<{ key: string; value: string }[]>([
    { key: '', value: '' }
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  if (!isOpen || !sourceNode) return null;

  const filteredNodes = availableNodes.filter(node =>
    node.id !== sourceNode.id &&
    (searchTerm === '' ||
      node.labels.some(l => l.toLowerCase().includes(searchTerm.toLowerCase())) ||
      Object.values(node.properties).some(v =>
        String(v).toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  );

  const availableRelationshipTypes = schemaInfo?.relationships.map(r => r.type) || [];

  const handleAddProperty = () => {
    setProperties([...properties, { key: '', value: '' }]);
  };

  const handleRemoveProperty = (index: number) => {
    setProperties(properties.filter((_, i) => i !== index));
  };

  const handlePropertyChange = (index: number, field: 'key' | 'value', value: string) => {
    const newProps = [...properties];
    newProps[index][field] = value;
    setProperties(newProps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipType.trim() || !targetNodeId) return;

    const propsObject: Record<string, any> = {};
    properties.forEach(prop => {
      if (prop.key.trim()) {
        propsObject[prop.key.trim()] = prop.value;
      }
    });

    await onCreate(targetNodeId, relationshipType.trim(), propsObject);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" style={{ zIndex: 100 }}>
      <div className="bg-neo-panel border border-neo-border rounded-xl w-full max-w-lg mx-4 shadow-2xl animate-scale-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neo-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neo-secondary/20 flex items-center justify-center">
              <Link className="w-4 h-4 text-neo-secondary" />
            </div>
             <div>
               <h3 className="text-lg font-semibold text-neo-text">添加关系</h3>
               <p className="text-xs text-neo-dim">从：{sourceNode.labels.join(', ')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neo-dim hover:text-neo-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

         <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
           <div>
             <label className="text-xs font-bold text-neo-dim uppercase mb-1.5 block">
               关系类型
             </label>
            <div className="relative">
              <input
                type="text"
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                onFocus={() => setShowTypeDropdown(true)}
                onBlur={() => setTimeout(() => setShowTypeDropdown(false), 200)}
                placeholder="e.g., FRIEND_OF, WORKS_WITH"
                className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-secondary outline-none"
              />
              {showTypeDropdown && availableRelationshipTypes.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-neo-bg border border-neo-border rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                  {availableRelationshipTypes
                    .filter(type =>
                      type.toLowerCase().includes(relationshipType.toLowerCase())
                    )
                    .map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setRelationshipType(type);
                          setShowTypeDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-neo-text hover:bg-neo-secondary/20 transition-colors"
                      >
                        {type}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

           <div>
             <label className="text-xs font-bold text-neo-dim uppercase mb-1.5 block">
               目标节点
             </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
               <input
                 type="text"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 placeholder="搜索节点..."
                className="w-full bg-neo-bg border border-neo-border rounded-lg pl-10 pr-3 py-2 text-neo-text placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-secondary outline-none"
              />
            </div>
             <div className="mt-2 max-h-48 overflow-y-auto custom-scrollbar space-y-1">
               {filteredNodes.length === 0 ? (
                 <div className="text-center py-4 text-neo-dim text-sm">
                   未找到匹配的节点
                 </div>
              ) : (
                filteredNodes.map(node => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setTargetNodeId(node.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      targetNodeId === node.id
                        ? 'bg-neo-secondary/20 border border-neo-secondary text-neo-text'
                        : 'bg-neo-bg border border-neo-border text-neo-text hover:border-neo-secondary/50'
                    }`}
                  >
                    <div className="font-medium">
                      {node.labels.join(', ')}
                      {node.properties.name && (
                        <span className="ml-2 text-neo-dim">{node.properties.name}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

           <div>
             <div className="flex items-center justify-between mb-1.5">
               <label className="text-xs font-bold text-neo-dim uppercase">
                 属性（可选）
               </label>
               <button
                 type="button"
                 onClick={handleAddProperty}
                  className="text-xs text-neo-secondary hover:text-neo-text flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> 添加属性
                </button>
             </div>
             <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
               {properties.map((prop, index) => (
                 <div key={index} className="flex gap-2">
                   <input
                     type="text"
                     value={prop.key}
                     onChange={(e) => handlePropertyChange(index, 'key', e.target.value)}
                     placeholder="key"
                     className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text text-sm placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-secondary outline-none"
                   />
                   <input
                     type="text"
                     value={prop.value}
                     onChange={(e) => handlePropertyChange(index, 'value', e.target.value)}
                     placeholder="value"
                     className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text text-sm placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-secondary outline-none"
                   />
                  {properties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveProperty(index)}
                      className="text-neo-dim hover:text-red-400 px-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
        </form>

         <div className="flex gap-3 p-4 border-t border-neo-border shrink-0">
           <button
             type="button"
             onClick={onClose}
             className="flex-1 py-2 rounded-lg border border-neo-border text-neo-dim hover:text-neo-text hover:bg-neo-bg/5 transition-colors"
           >
             取消
           </button>
          <button
            type="submit"
            disabled={!relationshipType.trim() || !targetNodeId || isLoading}
            className="flex-1 py-2 rounded-lg bg-neo-secondary hover:bg-white text-black font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={handleSubmit}
          >
             {isLoading ? (
               <>
                 <Loader2 className="w-4 h-4 animate-spin" />
                 创建中...
               </>
             ) : (
               <>
                 <Link className="w-4 h-4" />
                 创建关系
               </>
             )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddRelationshipModal;
