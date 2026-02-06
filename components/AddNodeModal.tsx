import React, { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';

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
  const [properties, setProperties] = useState<{ key: string; value: string }[]>([
    { key: '', value: '' }
  ]);

  if (!isOpen) return null;

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
    if (!label.trim()) return;

    const propsObject: Record<string, string> = {};
    properties.forEach(prop => {
      if (prop.key.trim()) {
        propsObject[prop.key.trim()] = prop.value;
      }
    });

    await onCreate(label.trim(), propsObject);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" style={{ zIndex: 100 }}>
      <div className="bg-neo-panel border border-neo-border rounded-xl w-full max-w-md mx-4 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neo-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neo-primary/20 flex items-center justify-center">
              <Plus className="w-4 h-4 text-neo-primary" />
            </div>
            <h3 className="text-lg font-semibold text-neo-text">添加新节点</h3>
          </div>
          <button
            onClick={onClose}
            className="text-neo-dim hover:text-neo-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
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
                onClick={handleAddProperty}
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
                    onChange={(e) => handlePropertyChange(index, 'key', e.target.value)}
                    placeholder="key"
                    className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text text-sm placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
                  />
                  <input
                    type="text"
                    value={prop.value}
                    onChange={(e) => handlePropertyChange(index, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-neo-text text-sm placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
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

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

           {/* Actions */}
           <div className="flex gap-3 pt-2">
             <button
               type="button"
               onClick={onClose}
               className="flex-1 py-2 rounded-lg border border-neo-border text-neo-dim hover:text-neo-text hover:bg-neo-bg/5 transition-colors"
             >
               取消
             </button>
            <button
              type="submit"
              disabled={!label.trim() || isLoading}
               className="flex-1 py-2 rounded-lg bg-neo-primary hover:bg-white text-black font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
               {isLoading ? (
                 <>
                   <Loader2 className="w-4 h-4 animate-spin" />
                   创建中...
                 </>
               ) : (
                 <>
                   <Plus className="w-4 h-4" />
                   创建节点
                 </>
               )}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNodeModal;
