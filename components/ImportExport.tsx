import React, { useState, useRef } from 'react';
import { Driver, GraphData } from '../types';
import {
  exportToCypher,
  exportToJSON,
  exportNodesToCsv,
  exportToGraphML,
  exportToGEXF,
  exportToDOT,
  exportToMarkdown,
  exportToText,
  exportToExcelCsv,
  importFromJSON,
  importNodesFromCsv,
  exportGraphData,
  ExportOptions,
  ImportResult,
  ExportFormat
} from '../services/neo4j/import-export';
import { getSchemaInfo, SchemaInfo } from '../services/neo4j';
import {
  X, Download, Upload, FileText, FileJson, Table,
  Loader2, AlertCircle, CheckCircle, Copy, Check,
  FileCode, FileSpreadsheet, Share2, Code2
} from 'lucide-react';

interface ImportExportProps {
  driver: Driver | null;
  database?: string;
  graphData?: GraphData;
  onClose: () => void;
  onImportComplete?: () => void;
}

type TabType = 'export' | 'import';
type LocalExportFormat = 'cypher' | 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'text' | 'excel';
type ImportFormat = 'json' | 'csv';

// 导出格式配置
const EXPORT_FORMATS: { id: LocalExportFormat; name: string; icon: React.ReactNode; description: string; extension: string }[] = [
  { id: 'json', name: 'JSON', icon: <FileJson className="w-4 h-4" />, description: '标准 JSON 格式，方便程序处理', extension: 'json' },
  { id: 'cypher', name: 'Cypher', icon: <FileText className="w-4 h-4" />, description: 'Neo4j 原生脚本，可直接导入', extension: 'cypher' },
  { id: 'csv', name: 'CSV', icon: <Table className="w-4 h-4" />, description: '单标签节点导出，表格形式', extension: 'csv' },
  { id: 'excel', name: 'Excel CSV', icon: <FileSpreadsheet className="w-4 h-4" />, description: '支持中文的 Excel 兼容格式', extension: 'csv' },
  { id: 'graphml', name: 'GraphML', icon: <Share2 className="w-4 h-4" />, description: 'XML 标准图交换格式', extension: 'graphml' },
  { id: 'gexf', name: 'GEXF', icon: <Share2 className="w-4 h-4" />, description: 'Gephi 软件支持的格式', extension: 'gexf' },
  { id: 'dot', name: 'DOT', icon: <Code2 className="w-4 h-4" />, description: 'Graphviz 可视化格式', extension: 'dot' },
  { id: 'markdown', name: 'Markdown', icon: <FileCode className="w-4 h-4" />, description: '人类可读的表格文档', extension: 'md' },
  { id: 'text', name: '纯文本', icon: <FileText className="w-4 h-4" />, description: '简单文本格式，便于阅读', extension: 'txt' },
];

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
  const [exportFormat, setExportFormat] = useState<LocalExportFormat>('json');
  const [exportResult, setExportResult] = useState<string>('');
  const [exportResultExtra, setExportResultExtra] = useState<string>(''); // For Excel CSV relationships
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [csvLabel, setCsvLabel] = useState('');
  const [csvProperties, setCsvProperties] = useState<string[]>([]);
  const [includeConstraints, setIncludeConstraints] = useState(true);
  const [includeIndexes, setIncludeIndexes] = useState(true);
  const [includeProperties, setIncludeProperties] = useState(true);
  const [includeStatistics, setIncludeStatistics] = useState(true);
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
    setExportResultExtra('');

    try {
      let result: string;
      const commonOptions: ExportOptions = {
        labels: selectedLabels.length > 0 ? selectedLabels : undefined,
        includeProperties,
        includeStatistics
      };

      switch (exportFormat) {
        case 'cypher':
          result = await exportToCypher(driver, {
            ...commonOptions,
            includeConstraints,
            includeIndexes
          }, database);
          break;
          
        case 'json':
          const jsonData = await exportToJSON(driver, commonOptions, database);
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
          
        case 'excel':
          const excelData = await exportToExcelCsv(driver, commonOptions, database);
          result = excelData.nodes;
          setExportResultExtra(excelData.relationships);
          break;
          
        case 'graphml':
          result = await exportToGraphML(driver, commonOptions, database);
          break;
          
        case 'gexf':
          result = await exportToGEXF(driver, commonOptions, database);
          break;
          
        case 'dot':
          result = await exportToDOT(driver, commonOptions, database);
          break;
          
        case 'markdown':
          result = await exportToMarkdown(driver, commonOptions, database);
          break;
          
        case 'text':
          result = await exportToText(driver, commonOptions, database);
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

  const handleDownload = (content?: string, suffix?: string) => {
    const data = content || exportResult;
    if (!data) return;

    const formatConfig = EXPORT_FORMATS.find(f => f.id === exportFormat);
    const extension = formatConfig?.extension || 'txt';
    const filename = suffix 
      ? `neo4j-export-${suffix}.${extension}`
      : `neo4j-export.${extension}`;

    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {EXPORT_FORMATS.map(format => (
                    <button
                      key={format.id}
                      onClick={() => setExportFormat(format.id)}
                      className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg transition-colors ${
                        exportFormat === format.id
                          ? 'bg-orange-500/20 border border-orange-400 text-orange-400'
                          : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-orange-400/50'
                      }`}
                      title={format.description}
                    >
                      {format.icon}
                      <span className="text-xs">{format.name}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-neo-dim mt-2">
                  {EXPORT_FORMATS.find(f => f.id === exportFormat)?.description}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-4 p-4 bg-neo-bg/50 rounded-xl border border-neo-border">
                <div className="text-xs font-bold text-neo-dim uppercase mb-2">导出选项</div>
                <div className="flex flex-wrap gap-4">
                  {exportFormat === 'cypher' && (
                    <>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={includeConstraints}
                          onChange={(e) => setIncludeConstraints(e.target.checked)}
                          className="rounded border-neo-border bg-neo-bg"
                        />
                        <span className="text-sm text-neo-text">包含约束</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={includeIndexes}
                          onChange={(e) => setIncludeIndexes(e.target.checked)}
                          className="rounded border-neo-border bg-neo-bg"
                        />
                        <span className="text-sm text-neo-text">包含索引</span>
                      </label>
                    </>
                  )}
                  
                  {['graphml', 'gexf', 'dot', 'text'].includes(exportFormat) && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeProperties}
                        onChange={(e) => setIncludeProperties(e.target.checked)}
                        className="rounded border-neo-border bg-neo-bg"
                      />
                      <span className="text-sm text-neo-text">包含属性详情</span>
                    </label>
                  )}
                  
                  {['markdown', 'text'].includes(exportFormat) && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeStatistics}
                        onChange={(e) => setIncludeStatistics(e.target.checked)}
                        className="rounded border-neo-border bg-neo-bg"
                      />
                      <span className="text-sm text-neo-text">包含统计信息</span>
                    </label>
                  )}
                </div>
              </div>

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
                <div className="space-y-4">
                  {/* Main result */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-neo-dim uppercase">
                        {exportFormat === 'excel' ? '节点数据' : '导出结果'}
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-neo-dim hover:text-white transition-colors"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? '已复制' : '复制'}
                        </button>
                        <button
                          onClick={() => handleDownload(undefined, exportFormat === 'excel' ? 'nodes' : undefined)}
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
                      className="w-full h-48 bg-neo-bg border border-neo-border rounded-lg p-4 text-sm text-neo-text font-mono resize-none custom-scrollbar"
                    />
                  </div>
                  
                  {/* Extra result for Excel CSV (relationships) */}
                  {exportFormat === 'excel' && exportResultExtra && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-neo-dim uppercase">关系数据</label>
                        <button
                          onClick={() => handleDownload(exportResultExtra, 'relationships')}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-orange-400 hover:text-orange-300 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          下载
                        </button>
                      </div>
                      <textarea
                        value={exportResultExtra}
                        readOnly
                        className="w-full h-32 bg-neo-bg border border-neo-border rounded-lg p-4 text-sm text-neo-text font-mono resize-none custom-scrollbar"
                      />
                    </div>
                  )}
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
