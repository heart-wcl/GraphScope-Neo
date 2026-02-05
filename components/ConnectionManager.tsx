import React, { useState } from 'react';
import { ConnectionConfig } from '../types';
import { checkConnection } from '../services/neo4j';
import { Database, Lock, Server, ShieldCheck, Globe, Tag, AlertCircle, CheckCircle } from 'lucide-react';

interface ConnectionManagerProps {
  onConnect: (config: ConnectionConfig) => void;
  isLoading: boolean;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({ onConnect, isLoading }) => {
  const [config, setConfig] = useState<ConnectionConfig>({
    name: '我的图数据库',
    protocol: 'bolt',
    host: '192.168.8.119',
    port: '7687',
    username: 'neo4j',
    password: '',
    database: 'neo4j'
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (field: keyof ConnectionConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Reset status when config changes
    if (connectionStatus !== 'idle') {
      setConnectionStatus('idle');
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectionStatus('idle');
    setErrorMessage(null);

    // Validate required fields
    if (!config.host || !config.username || !config.password) {
      setConnectionStatus('error');
      setErrorMessage('请填写所有必填字段（主机、用户名、密码）');
      return;
    }

    try {
      // Test actual Neo4j connection
      const isConnected = await checkConnection(config);

      if (isConnected) {
        setConnectionStatus('success');
        // Short delay to show success state
        setTimeout(() => {
          onConnect(config);
          setConnectionStatus('idle');
        }, 800);
      }
    } catch (err) {
      setConnectionStatus('error');
      setErrorMessage(`连接失败：${err instanceof Error ? err.message : '未知错误'}。请检查您的连接详情。`);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center relative overflow-hidden bg-neo-bg p-4">
      {/* Background with pseudo-Nano generated texture hotlinked */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://picsum.photos/1920/1080?grayscale&blur=2" 
          alt="Abstract Data Texture"
          className="w-full h-full object-cover opacity-20 filter contrast-125 brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neo-bg via-neo-bg/90 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-6 md:p-8 glass-panel rounded-2xl shadow-2xl animate-float border border-neo-border overflow-y-auto max-h-full">
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-neo-primary/10 rounded-full flex items-center justify-center mb-4 neon-glow border border-neo-primary">
            <Database className="w-6 h-6 md:w-8 md:h-8 text-neo-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-neo-text tracking-tight text-center">Neo4j OmniVis</h1>
          <p className="text-neo-dim text-xs md:text-sm mt-2 text-center">安全图数据库连接网关</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="text-xs text-neo-dim uppercase font-semibold ml-1 mb-1 block">连接名称</label>
            <div className="relative">
              <Tag className="absolute left-3 top-2.5 w-4 h-4 text-neo-primary" />
              <input 
                type="text" 
                value={config.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="生产数据库"
                className="w-full bg-neo-bg border border-neo-border text-neo-text text-sm rounded-lg py-2.5 pl-10 placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary focus:border-neo-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="text-xs text-neo-dim uppercase font-semibold ml-1 mb-1 block">协议</label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
                <select 
                  value={config.protocol}
                  onChange={(e) => handleChange('protocol', e.target.value as any)}
                  className="w-full bg-neo-bg border border-neo-border text-neo-text text-sm rounded-lg py-2.5 pl-9 pr-2 focus:ring-1 focus:ring-neo-primary focus:border-neo-primary appearance-none outline-none"
                >
                  <option value="bolt">bolt://</option>
                  <option value="bolt+s">bolt+s://</option>
                  <option value="neo4j">neo4j://</option>
                  <option value="neo4j+s">neo4j+s://</option>
                  <option value="http">http://</option>
                  <option value="https">https://</option>
                </select>
              </div>
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="text-xs text-neo-dim uppercase font-semibold ml-1 mb-1 block">主机地址</label>
              <div className="relative">
                <Server className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
                <input 
                  type="text" 
                  value={config.host}
                  onChange={(e) => handleChange('host', e.target.value)}
                  placeholder="localhost"
                className="w-full bg-neo-bg border border-neo-border text-neo-text text-sm rounded-lg py-2.5 pl-10 placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary focus:border-neo-primary outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
             <div className="col-span-1">
                <label className="text-xs text-neo-dim uppercase font-semibold ml-1 mb-1 block">端口</label>
                <input 
                  type="text" 
                  value={config.port}
                  onChange={(e) => handleChange('port', e.target.value)}
                  className="w-full bg-neo-bg border border-neo-border text-neo-text text-sm rounded-lg py-2.5 px-3 text-center placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
                />
             </div>
             <div className="col-span-1 md:col-span-2">
                <label className="text-xs text-neo-dim uppercase font-semibold ml-1 mb-1 block">数据库（可选）</label>
                <input 
                  type="text" 
                  value={config.database}
                  onChange={(e) => handleChange('database', e.target.value)}
                  placeholder="neo4j"
                  className="w-full bg-neo-bg border border-neo-border text-neo-text text-sm rounded-lg py-2.5 px-3 placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
                />
             </div>
          </div>

          <div>
            <label className="text-xs text-neo-dim uppercase font-semibold ml-1 mb-1 block">身份验证</label>
            <div className="space-y-2">
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
                <input 
                  type="text" 
                  value={config.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  placeholder="用户名"
                  className="w-full bg-neo-bg border border-neo-border text-neo-text text-sm rounded-lg py-2.5 pl-10 placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-neo-dim" />
                <input 
                  type="password" 
                  value={config.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="密码"
                  className="w-full bg-neo-bg border border-neo-border text-neo-text text-sm rounded-lg py-2.5 pl-10 placeholder-neo-dim/50 focus:ring-1 focus:ring-neo-primary outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || connectionStatus === 'success'}
            className={`w-full mt-6 py-3 rounded-lg font-bold transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2 ${
              connectionStatus === 'success'
                ? 'bg-green-500 text-neo-text'
                : connectionStatus === 'error'
                ? 'bg-red-500 text-neo-text hover:bg-red-600'
                : 'bg-neo-primary hover:bg-white text-black'
            } ${isLoading || connectionStatus === 'success' ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                连接中...
              </>
            ) : connectionStatus === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                已连接！
              </>
            ) : connectionStatus === 'error' ? (
              <>
                <AlertCircle className="w-4 h-4" />
                重试
              </>
            ) : (
              <>
                初始化连接 <Server className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Connection Error Message */}
          {connectionStatus === 'error' && errorMessage && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
          )}

          {/* Demo Mode Button */}
          <button
            type="button"
            onClick={() => {
              // Create a demo session with mock config
              const demoConfig: ConnectionConfig = {
                name: '演示图数据库',
                protocol: 'demo',
                host: 'demo',
                port: '0',
                username: 'demo',
                password: 'demo',
                database: 'demo'
              };
              onConnect(demoConfig);
            }}
             className="w-full mt-3 py-2 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-neo-dim hover:text-neo-text border border-neo-border/50"
           >
            <Database className="w-4 h-4" />
            试用演示模式（模拟数据）
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConnectionManager;