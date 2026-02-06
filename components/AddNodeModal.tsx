import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '../presentation/components/common/Modal';
import { ErrorAlert } from '../presentation/components/common/Alert';
import { LoadingButton } from '../presentation/components/common/Loading';
import { usePropertyList } from '../presentation/hooks';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (label: string, properties: Record<string, string>) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AddNodeModal: React.FC<AddNodeModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading,
  error
}) => {
  const [label, setLabel] = useState('');
  const { properties, addProperty, removeProperty, updateProperty, toRecord } = usePropertyList();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    await onCreate(label.trim(), toRecord() as Record<string, string>);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="添加新节点"
      icon={<Plus className="w-5 h-5 text-neo-primary" />}
      iconColorClass="bg-neo-primary/20"
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="block text-xs font-bold text-neo-dim uppercase mb-1.5">
            节点标签
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Person, Movie, Company"
            className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
          />
        </div>

        {/* Properties */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-neo-dim uppercase">
              属性（可选）
            </label>
            <button
              type="button"
              onClick={addProperty}
              className="text-xs text-neo-primary hover:text-neo-text flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> 添加属性
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {properties.map((prop, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={prop.key}
                  onChange={(e) => updateProperty(index, 'key', e.target.value)}
                  placeholder="key"
                  className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text text-sm placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
                />
                <input
                  type="text"
                  value={prop.value}
                  onChange={(e) => updateProperty(index, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text text-sm placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
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

        {/* Error */}
        <ErrorAlert message={error} />

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-neo-border text-neo-dim hover:text-neo-text hover:bg-neo-bg/5 transition-colors"
          >
            取消
          </button>
          <LoadingButton
            type="submit"
            loading={isLoading}
            disabled={!label.trim()}
            loadingText="创建中..."
            icon={<Plus className="w-4 h-4" />}
            className="flex-1 py-2 rounded-lg bg-neo-primary hover:bg-white text-black font-medium transition-colors"
          >
            创建节点
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
};

export default AddNodeModal;
