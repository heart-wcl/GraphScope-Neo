import React, { useState } from 'react';
import { Neo4jNode } from '../types';
import { SchemaInfo } from '../services/neo4j';
import { Plus, Search, Link } from 'lucide-react';
import { Modal } from '../presentation/components/common/Modal';
import { ErrorAlert } from '../presentation/components/common/Alert';
import { LoadingButton } from '../presentation/components/common/Loading';
import { usePropertyList } from '../presentation/hooks';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const { properties, addProperty, removeProperty, updateProperty, toRecord } = usePropertyList();

  if (!sourceNode) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipType.trim() || !targetNodeId) return;
    await onCreate(targetNodeId, relationshipType.trim(), toRecord());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="添加关系"
      description={`从：${sourceNode.labels.join(', ')}`}
      icon={<Link className="w-5 h-5 text-neo-secondary" />}
      iconColorClass="bg-neo-secondary/20"
      size="lg"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-neo-border text-neo-dim hover:text-neo-text hover:bg-neo-bg/5 transition-colors"
          >
            取消
          </button>
          <LoadingButton
            loading={isLoading}
            disabled={!relationshipType.trim() || !targetNodeId}
            loadingText="创建中..."
            icon={<Link className="w-4 h-4" />}
            className="flex-1 py-2 rounded-lg bg-neo-secondary hover:bg-white text-black font-medium transition-colors"
            onClick={handleSubmit}
          >
            创建关系
          </LoadingButton>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
                  .filter(type => type.toLowerCase().includes(relationshipType.toLowerCase()))
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
              onClick={addProperty}
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
                  onChange={(e) => updateProperty(index, 'key', e.target.value)}
                  placeholder="key"
                  className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text text-sm placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-secondary outline-none"
                />
                <input
                  type="text"
                  value={prop.value}
                  onChange={(e) => updateProperty(index, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text text-sm placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-secondary outline-none"
                />
                {properties.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProperty(index)}
                    className="text-neo-dim hover:text-red-400 px-2"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <ErrorAlert message={error} />
      </form>
    </Modal>
  );
};

export default AddRelationshipModal;
