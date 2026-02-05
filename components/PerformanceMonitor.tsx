/**
 * Performance Monitor Component
 * 性能监控面板 - 实时显示性能指标
 */

import React, { useState, useEffect } from 'react';
import type { PerformanceMetrics } from '../types';
import { Activity, Cpu, HardDrive, Zap, Layers, Network } from 'lucide-react';

interface PerformanceMonitorProps {
  metrics: PerformanceMetrics | null;
  isVisible: boolean;
  onToggle: () => void;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  metrics,
  isVisible,
  onToggle
}) => {
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    if (metrics?.fps) {
      setHistory(prev => {
        const newHistory = [...prev, metrics.fps];
        return newHistory.slice(-60); // 保留最近60帧
      });
    }
  }, [metrics?.fps]);

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMemoryColor = (memory: number) => {
    if (memory < 200) return 'text-green-400';
    if (memory < 400) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCullRateColor = (rate: number) => {
    if (rate > 0.7) return 'text-green-400';
    if (rate > 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!metrics || !isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 left-4 bg-neo-panel/80 backdrop-blur-md px-3 py-2 rounded-lg border border-neo-border text-neo-dim hover:text-neo-text transition-all z-50 flex items-center gap-2"
      >
        <Activity className="w-4 h-4" />
        <span className="text-xs font-medium">性能监控</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 w-80 bg-neo-panel/95 backdrop-blur-md rounded-xl border border-neo-border shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neo-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-neo-primary" />
          <span className="text-sm font-bold text-white">性能监控</span>
        </div>
        <button
          onClick={onToggle}
          className="text-neo-dim hover:text-neo-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* FPS */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-neo-primary" />
            <span className="text-xs text-neo-dim">帧率 (FPS)</span>
          </div>
          <span className={`text-lg font-bold ${getFpsColor(metrics.fps)}`}>
            {metrics.fps.toFixed(1)}
          </span>
        </div>

        {/* FPS Chart */}
        <div className="h-12 bg-neo-bg rounded-lg p-2">
          <svg width="100%" height="100%" viewBox="0 0 280 32" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke={metrics.fps >= 55 ? '#00FF88' : metrics.fps >= 30 ? '#FFEA00' : '#FF4081'}
              strokeWidth="2"
              points={history.map((fps, i) => {
                const x = (i / 59) * 280;
                const y = 32 - (fps / 60) * 32;
                return `${x},${y}`;
              }).join(' ')}
            />
          </svg>
        </div>

        {/* Memory */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-neo-secondary" />
            <span className="text-xs text-neo-dim">内存占用</span>
          </div>
          <span className={`text-sm font-bold ${getMemoryColor(metrics.memory)}`}>
            {metrics.memory.toFixed(1)} MB
          </span>
        </div>

        {/* Render Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-neo-dim">渲染时间</span>
          </div>
          <span className="text-sm font-bold text-white">
            {metrics.renderTime.toFixed(2)} ms
          </span>
        </div>

        {/* Separator */}
        <div className="border-t border-neo-border pt-3 space-y-3">
          {/* Visible Nodes */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-neo-dim">可见节点</span>
            </div>
            <span className="text-sm font-medium text-white">
              {metrics.visibleNodes.toLocaleString()} / {metrics.totalNodes.toLocaleString()}
            </span>
          </div>

          {/* Visible Links */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-neo-dim">可见关系</span>
            </div>
            <span className="text-sm font-medium text-white">
              {metrics.visibleLinks.toLocaleString()} / {metrics.totalLinks.toLocaleString()}
            </span>
          </div>

          {/* Cull Rate */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-xs text-neo-dim">裁剪率</span>
            </div>
            <span className={`text-sm font-bold ${getCullRateColor(metrics.cullRate)}`}>
              {(metrics.cullRate * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
