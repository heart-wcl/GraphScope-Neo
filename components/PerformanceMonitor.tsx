/**
 * Performance Monitor Component
 * 性能监控面板 - 实时显示性能指标，支持拖动
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PerformanceMetrics } from '../types';
import { Activity, Cpu, HardDrive, Zap, Layers, Network, GripVertical } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

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
  const { theme } = useTheme();
  const [history, setHistory] = useState<number[]>([]);
  const [position, setPosition] = useState({ x: 16, y: window.innerHeight - 300 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // 主题适配颜色
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textMutedColor = theme === 'dark' ? 'text-neo-dim' : 'text-gray-600';
  const bgColor = theme === 'dark' ? 'bg-neo-bg/50' : 'bg-gray-100';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y
    };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      
      const newX = Math.max(0, Math.min(window.innerWidth - 280, dragRef.current.startPosX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPosY + deltaY));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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
        style={{ left: position.x, top: position.y }}
        className="fixed bg-neo-panel/80 backdrop-blur-md px-3 py-2 rounded-lg border border-neo-border text-neo-dim hover:text-neo-text transition-all z-50 flex items-center gap-2"
      >
        <Activity className="w-4 h-4" />
        <span className="text-xs font-medium">性能监控</span>
      </button>
    );
  }

  return (
    <div 
      ref={panelRef}
      style={{ left: position.x, top: position.y }}
      className="fixed w-64 bg-neo-panel/95 backdrop-blur-md rounded-xl border border-neo-border shadow-2xl z-50 overflow-hidden"
    >
      {/* Header - Draggable */}
      <div 
        className={`px-3 py-2 border-b border-neo-border flex items-center justify-between cursor-move select-none ${isDragging ? 'bg-neo-primary/10' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical className={`w-3 h-3 ${textMutedColor}`} />
          <Activity className="w-4 h-4 text-neo-primary" />
          <span className={`text-xs font-bold ${textColor}`}>性能监控</span>
        </div>
        <button
          onClick={onToggle}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-neo-dim hover:text-neo-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* FPS */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-neo-primary" />
            <span className={`text-[10px] ${textMutedColor}`}>帧率 (FPS)</span>
          </div>
          <span className={`text-sm font-bold ${getFpsColor(metrics.fps)}`}>
            {metrics.fps.toFixed(1)}
          </span>
        </div>

        {/* FPS Chart */}
        <div className={`h-8 ${bgColor} rounded-lg p-1`}>
          <svg width="100%" height="100%" viewBox="0 0 220 24" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke={metrics.fps >= 55 ? '#00FF88' : metrics.fps >= 30 ? '#FFEA00' : '#FF4081'}
              strokeWidth="2"
              points={history.map((fps, i) => {
                const x = (i / 59) * 220;
                const y = 24 - (fps / 60) * 24;
                return `${x},${y}`;
              }).join(' ')}
            />
          </svg>
        </div>

        {/* Memory & Render Time - Side by side */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`flex items-center justify-between ${bgColor} rounded px-2 py-1`}>
            <HardDrive className="w-3 h-3 text-neo-secondary" />
            <span className={`text-xs font-bold ${getMemoryColor(metrics.memory)}`}>
              {metrics.memory.toFixed(1)} MB
            </span>
          </div>
          <div className={`flex items-center justify-between ${bgColor} rounded px-2 py-1`}>
            <Cpu className="w-3 h-3 text-orange-400" />
            <span className={`text-xs font-bold ${textColor}`}>
              {metrics.renderTime.toFixed(2)} ms
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="border-t border-neo-border pt-2 grid grid-cols-3 gap-1.5 text-center">
          <div className={`${bgColor} rounded px-1.5 py-1`}>
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Layers className="w-3 h-3 text-blue-400" />
              <span className={`text-[9px] ${textMutedColor}`}>节点</span>
            </div>
            <span className={`text-[10px] font-medium ${textColor}`}>
              {metrics.visibleNodes} / {metrics.totalNodes}
            </span>
          </div>
          <div className={`${bgColor} rounded px-1.5 py-1`}>
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Network className="w-3 h-3 text-purple-400" />
              <span className={`text-[9px] ${textMutedColor}`}>关系</span>
            </div>
            <span className={`text-[10px] font-medium ${textColor}`}>
              {metrics.visibleLinks} / {metrics.totalLinks}
            </span>
          </div>
          <div className={`${bgColor} rounded px-1.5 py-1`}>
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Activity className="w-3 h-3 text-green-400" />
              <span className={`text-[9px] ${textMutedColor}`}>裁剪</span>
            </div>
            <span className={`text-[10px] font-bold ${getCullRateColor(metrics.cullRate)}`}>
              {(metrics.cullRate * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
