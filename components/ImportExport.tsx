import React, { useState, useRef } from 'react';
import { Driver, GraphData } from '../types';
import {
  exportToCypher,
  exportToJSON,
  exportNodesToCsv,
  importFromJSON,
  importNodesFromCsv,
  exportGraphData,
  ExportOptions,
  ImportResult
} from '../services/neo4j/import-export';
import { getSchemaInfo, SchemaInfo } from '../services/neo4j';
import {
  X, Download, Upload, FileText, FileJson, Table,
  Loader2, AlertCircle, CheckCircle, Copy, Check
} from 'lucide-react';

interface ImportExportProps {
  driver: Driver | null;
  database?: string;
  graphData?: GraphData;
  onClose: () => void;
  onImportComplete?: () => void;
}

type TabType = 'export' | 'import';
type ExportFormat = 'cypher' | 'json' | 'csv';
type ImportFormat = 'json' | 'csv';

const ImportExport: React.FC<ImportExportProps> = ({
  driver,
  database,
  graphData,
  onClose,
  onImportComplete
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('export');
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Export state
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [exportResult, setExportResult] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [csvLabel, setCsvLabel] = useState('');
  const [csvProperties, setCsvProperties] = useState<string[]>([]);
  const [includeConstraints, setIncludeConstraints] = useState(true);
  const [includeIndexes, setIncludeIndexes] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Import state
  const [importFormat, setImportFormat] = useState<ImportFormat>('json');
  const [importData, setImportData] = useState('');
  const [csvImportLabel, setCsvImportLabel] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    loadSchema();
  }, [driver, database]);

  const loadSchema = async () => {
    if (!driver) return;
    try {
      const schemaInfo = await getSchemaInfo(driver, database);
      setSchema(schemaInfo);
    } catch (err) {
      // Ignore schema loading errors
    }
  };

  const handleExport = async () => {
    if (!driver) return;

    setLoading(true);
    setError(null);
    setExportResult('');

    try {
      let result: string;

      switch (exportFormat) {
        case 'cypher':
          result = await exportToCypher(driver, {
            includeConstraints,
            includeIndexes,
            labels: selectedLabels.length > 0 ? selectedLabels : undefined
          }, database);
          break;
          
        case 'json':
          const jsonData = await exportToJSON(driver, {
            labels: selectedLabels.length > 0 ? selectedLabels : undefined
          }, database);
          result = JSON.stringify(jsonData, null, 2);
          break;
          
        case 'csv':
          if (!csvLabel || csvProperties.length === 0) {
            setError('请选择标签和属性');
            setLoading(false);
            return;
          }
          result = await exportNodesToCsv(driver, csvLabel, csvProperties, 10000, database);
          break;
          
        default:
          result = '';
      }

      setExportResult(result);
    } catch (err) {
      setError(`导出失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCurrentView = () => {
    if (!graphData) {
      setError('没有可导出的图形数据');
      return;
    }
    
    const result = exportGraphData(graphData);
    setExportResult(result);
  };

  const handleImport = async () => {
    if (!driver || !importData.trim()) return;

    setLoading(true);
    setError(null);
    setImportResult(null);

    try {
      let result: ImportResult;

      switch (importFormat) {
        case 'json':
          const jsonData = JSON.parse(importData);
          result = await importFromJSON(driver, jsonData, database);
          break;
          
        case 'csv':
          if (!csvImportLabel) {
            setError('请输入节点标签');
            setLoading(false);
            return;
          }
          result = await importNodesFromCsv(driver, importData, csvImportLabel, undefined, database);
          break;
          
        default:
          result = { success: false, nodesCreated: 0, relationshipsCreated: 0, error: 'Unsupported format' };
      }

      setImportResult(result);
      
      if (result.success) {
        setSuccess(`导入成功: ${result.nodesCreated} 个节点, ${result.relationshipsCreated} 个关系`);
        onImportComplete?.();
      } else {
        setError(result.error || '导入失败');
      }
    } catch (err) {
      setError(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImportData(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!exportResult) return;

    const extensions: Record<ExportFormat, string> = {
      cypher: 'cypher',
      json: 'json',
      csv: 'csv'
    };

    const blob = new Blob([exportResult], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neo4j-export.${extensions[exportFormat]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!exportResult) return;
    await navigator.clipboard.writeText(exportResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleLabel = (label: string) => {
    setSelectedLabels(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  const toggleProperty = (prop: string) => {
    setCsvProperties(prev =>
      prev.includes(prop)
        ? prev.filter(p => p !== prop)
        : [...prev, prop]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-80 p-4">
      <div className="glass-panel rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-neo-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              {activeTab === 'export' ? (
                <Download className="w-5 h-5 text-orange-400" />
              ) : (
                <Upload className="w-5 h-5 text-orange-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">导入/导出</h2>
              <p className="text-xs text-neo-dim">支持 Cypher、JSON、CSV 格式</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neo-dim hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neo-border">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-orange-400 border-b-2 border-orange-400'
                : 'text-neo-dim hover:text-white'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            导出
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-orange-400 border-b-2 border-orange-400'
                : 'text-neo-dim hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            导入
          </button>
        </div>

        {/* Error/Success */}
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-neo-border flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/10 border-b border-neo-border flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          {activeTab === 'export' ? (
            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-xs font-bold text-neo-dim uppercase mb-2">
                  导出格式
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportFormat('json')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      exportFormat === 'json'
                        ? 'bg-orange-500/20 border border-orange-400 text-orange-400'
                        : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-orange-400/50'
                    }`}
                  >
                    <FileJson className="w-4 h-4" />
                    JSON
                  </button>
                  <button
                    onClick={() => setExportFormat('cypher')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      exportFormat === 'cypher'
                        ? 'bg-orange-500/20 border border-orange-400 text-orange-400'
                        : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-orange-400/50'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Cypher
                  </button>
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      exportFormat === 'csv'
                        ? 'bg-orange-500/20 border border-orange-400 text-orange-400'
                        : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-orange-400/50'
                    }`}
                  >
                    <Table className="w-4 h-4" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Options */}
              {exportFormat === 'cypher' && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeConstraints}
                        onChange={(e) => setIncludeConstraints(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-neo-text">包含约束</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeIndexes}
                        onChange={(e) => setIncludeIndexes(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-neo-text">包含索引</span>
                    </label>
                  </div>
                </div>
              )}

              {exportFormat === 'csv' && schema && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neo-dim uppercase mb-2">
                      选择标签
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {schema.labels.map(l => (
                        <button
                          key={l.label}
                          onClick={() => {
                            setCsvLabel(l.label);
                            setCsvProperties([]);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            csvLabel === l.label
                              ? 'bg-orange-500 text-black'
                              : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-orange-400'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {csvLabel && (
                    <div>
                      <label className="block text-xs font-bold text-neo-dim uppercase mb-2">
                        选择属性
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {schema.labels.find(l => l.label === csvLabel)?.properties.map(p => (
                          <button
                            key={p}
                            onClick={() => toggleProperty(p)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              csvProperties.includes(p)
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
                </div>
              )}

              {(exportFormat === 'json' || exportFormat === 'cypher') && schema && (
                <div>
                  <label className="block text-xs font-bold text-neo-dim uppercase mb-2">
                    筛选标签 (留空导出全部)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {schema.labels.map(l => (
                      <button
                        key={l.label}
                        onClick={() => toggleLabel(l.label)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedLabels.includes(l.label)
                            ? 'bg-neo-secondary text-black'
                            : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-neo-secondary'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleExport}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      导出中...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      导出数据库
                    </>
                  )}
                </button>
                
                {graphData && (
                  <button
                    onClick={handleExportCurrentView}
                    className="flex items-center gap-2 px-6 py-3 bg-neo-bg border border-neo-border hover:border-orange-400 text-neo-text rounded-xl transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    导出当前视图
                  </button>
                )}
              </div>

              {/* Result */}
              {exportResult && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-neo-dim uppercase">导出结果</label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-neo-dim hover:text-white transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? '已复制' : '复制'}
                      </button>
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        下载
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={exportResult}
                    readOnly
                    className="w-full h-64 bg-neo-bg border border-neo-border rounded-lg p-4 text-sm text-neo-text font-mono resize-none custom-scrollbar"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-xs font-bold text-neo-dim uppercase mb-2">
                  导入格式
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportFormat('json')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      importFormat === 'json'
                        ? 'bg-orange-500/20 border border-orange-400 text-orange-400'
                        : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-orange-400/50'
                    }`}
                  >
                    <FileJson className="w-4 h-4" />
                    JSON
                  </button>
                  <button
                    onClick={() => setImportFormat('csv')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      importFormat === 'csv'
                        ? 'bg-orange-500/20 border border-orange-400 text-orange-400'
                        : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-orange-400/50'
                    }`}
                  >
                    <Table className="w-4 h-4" />
                    CSV
                  </button>
                </div>
              </div>

              {/* CSV Label */}
              {importFormat === 'csv' && (
                <div>
                  <label className="block text-xs font-bold text-neo-dim uppercase mb-2">
                    节点标签
                  </label>
                  <input
                    type="text"
                    value={csvImportLabel}
                    onChange={(e) => setCsvImportLabel(e.target.value)}
                    placeholder="例如: Person"
                    className="w-full bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-white placeholder-neo-dim/50 focus:ring-1 focus:ring-orange-400 outline-none"
                  />
                </div>
              )}

              {/* File Upload */}
              <div>
                <label className="block text-xs font-bold text-neo-dim uppercase mb-2">
                  上传文件
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={importFormat === 'json' ? '.json' : '.csv'}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-neo-border hover:border-orange-400 rounded-xl text-neo-dim hover:text-white transition-colors"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  点击选择文件或拖放到此处
                </button>
              </div>

              {/* Data Input */}
              <div>
                <label className="block text-xs font-bold text-neo-dim uppercase mb-2">
                  或粘贴数据
                </label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder={importFormat === 'json' ? '{"nodes": [...], "relationships": [...]}' : 'name,age,city\nAlice,30,Beijing\nBob,25,Shanghai'}
                  className="w-full h-48 bg-neo-bg border border-neo-border rounded-lg p-4 text-sm text-neo-text font-mono resize-none placeholder-neo-dim/50 focus:ring-1 focus:ring-orange-400 outline-none custom-scrollbar"
                />
              </div>

              {/* Actions */}
              <button
                onClick={handleImport}
                disabled={loading || !importData.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    导入数据
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportExport;
