import React, { useState } from 'react';
import { ExecutionPlan, PlanOperator } from '../types';
import { ChevronDown, ChevronRight, Activity, Database, Clock, Database as DbIcon, AlertTriangle, Search, Filter, Layers, ArrowRight, Zap, List } from 'lucide-react';

interface ExecutionPlanViewProps {
  plan: ExecutionPlan;
}

interface PlanNodeProps {
  operator: PlanOperator;
  depth: number;
  isProfile: boolean;
  totalTime?: number;
  isLastChild?: boolean;
  parentPath?: boolean[]; // 记录父级路径是否存在连接线
}

const formatTime = (nanos: number): string => {
  if (nanos < 1000) return `${nanos}ns`;
  if (nanos < 1000000) return `${(nanos / 1000).toFixed(2)}µs`;
  return `${(nanos / 1000000).toFixed(2)}ms`;
};

const formatMemory = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
};

const getOperatorConfig = (operatorType: string) => {
  const base = operatorType.split('@')[0].toLowerCase();
  
  const scanOperators = ['allnodesscan', 'nodebylabelscan', 'nodeindexseek', 'nodeindexscan', 'directedrelationshipindexseek'];
  const transformOperators = ['projection', 'filter', 'selection', 'limit', 'skip'];
  const aggregationOperators = ['eageraggregation', 'sort', 'distinct', 'top'];
  const modificationOperators = ['createnode', 'deletenode', 'createrelationship', 'setnodeproperty', 'detachdelete'];
  const joinOperators = ['cartesianproduct', 'apply', 'optionalexpand', 'expand(all)', 'varlengthexpand(all)'];
  
  if (base.includes('cartesianproduct')) {
    return {
      color: 'bg-red-500/10 text-red-400 border-red-500/30',
      icon: AlertTriangle,
      label: '笛卡尔积 (性能警告)'
    };
  }

  if (aggregationOperators.includes(base) || base === 'eager') {
    return {
      color: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      icon: Layers,
      label: '聚合/排序'
    };
  }

  if (scanOperators.includes(base)) {
    return {
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      icon: Search,
      label: '扫描/查找'
    };
  }

  if (transformOperators.includes(base)) {
    return {
      color: 'bg-green-500/10 text-green-400 border-green-500/30',
      icon: Filter,
      label: '转换/过滤'
    };
  }

  if (modificationOperators.includes(base)) {
    return {
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      icon: Zap,
      label: '写入/修改'
    };
  }

  if (joinOperators.includes(base) || base.includes('expand')) {
    return {
      color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      icon: ArrowRight,
      label: '遍历/连接'
    };
  }
  
  return {
    color: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    icon: List,
    label: '操作'
  };
};

const PlanNode: React.FC<PlanNodeProps> = ({ operator, depth, isProfile, totalTime, isLastChild, parentPath = [] }) => {
  const [expanded, setExpanded] = useState(true);
  const operatorType = operator.operatorType.split('@')[0];
  const hasChildren = operator.children && operator.children.length > 0;
  const isEager = operatorType.toLowerCase().includes('eager');
  const { color, icon: Icon, label } = getOperatorConfig(operatorType);

  const args = operator.arguments || {};
  const estimatedRows = args['EstimatedRows'] as number | undefined;
  const details = args['Details'] as string | undefined;
  const actualRows = args['Rows'] as number | undefined;
  const dbHits = args['DbHits'] as number | undefined;
  const time = args['Time'] as number | undefined;
  const memory = args['Memory'] as number | undefined;
  const pipeline = args['Pipeline'] as string | undefined;

  // 计算进度条宽度
  const timePercentage = totalTime && time ? Math.min((time / totalTime) * 100, 100) : 0;
  
  return (
    <div className="relative">
      {/* 连接线渲染 */}
      {depth > 0 && (
        <>
          {/* 垂直线 - 基于父级路径绘制 */}
          {parentPath.map((hasLine, index) => (
            hasLine && (
              <div
                key={index}
                className="absolute w-px bg-neo-border"
                style={{
                  left: `${index * 24 + 11}px`,
                  top: '-12px',
                  bottom: isLastChild && index === parentPath.length - 1 ? '50%' : '0'
                }}
              />
            )
          ))}
          {/* 水平线 */}
          <div
            className="absolute h-px bg-neo-border"
            style={{
              left: `${(depth - 1) * 24 + 11}px`,
              width: '12px',
              top: '50%',
              marginTop: '-0.5px'
            }}
          />
        </>
      )}

      <div
        className={`
          relative flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-all hover:bg-neo-bg/50
          ${color}
          ${expanded ? '' : 'opacity-80'}
          mb-2
        `}
        style={{ marginLeft: `${depth * 24}px` }}
        onClick={(e) => {
          e.stopPropagation();
          hasChildren && setExpanded(!expanded);
        }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5" onClick={(e) => {
             e.stopPropagation();
             hasChildren && setExpanded(!expanded);
          }}>
            {hasChildren ? (
              expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <Icon className="w-4 h-4 opacity-50" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-sm text-neo-text">{operatorType}</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-black/20 text-current opacity-70 border border-current/20">
                {label}
              </span>
              
              {isEager && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-black rounded animate-pulse">
                  EAGER
                </span>
              )}
              
              {pipeline && (
                <span className="px-1.5 py-0.5 text-[10px] bg-neo-primary/10 text-neo-primary rounded border border-neo-primary/20 font-mono">
                  {pipeline}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-neo-dim">
              {estimatedRows !== undefined && (
                <div className="flex items-center gap-1">
                  <span>估:</span>
                  <span className="text-neo-text font-mono">{estimatedRows.toLocaleString()}</span>
                </div>
              )}

              {actualRows !== undefined && (
                <div className="flex items-center gap-1">
                  <span>行:</span>
                  <span className={`font-mono ${actualRows > 10000 ? 'text-orange-400' : 'text-neo-text'}`}>
                    {actualRows.toLocaleString()}
                  </span>
                </div>
              )}

              {dbHits !== undefined && (
                <div className="flex items-center gap-1">
                  <span>命中:</span>
                  <span className={`font-mono ${dbHits > 100000 ? 'text-red-400' : 'text-neo-text'}`}>
                    {dbHits.toLocaleString()}
                  </span>
                </div>
              )}

              {memory !== undefined && (
                <div className="flex items-center gap-1">
                  <span>内存:</span>
                  <span className="text-neo-text font-mono">{formatMemory(memory)}</span>
                </div>
              )}
            </div>

            {isProfile && time !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <div className="text-xs font-mono w-16 text-right shrink-0">{formatTime(time)}</div>
                <div className="flex-1 h-1.5 bg-neo-bg/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-current opacity-60 rounded-full"
                    style={{ width: `${timePercentage}%` }}
                  />
                </div>
                <div className="text-[10px] w-8 text-right opacity-50">{timePercentage.toFixed(0)}%</div>
              </div>
            )}

            {details && (
              <div className="mt-2 pt-2 border-t border-current/10 text-xs opacity-80 break-all font-mono">
                {details}
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="relative">
          {operator.children.map((child, index) => (
            <PlanNode
              key={index}
              operator={child}
              depth={depth + 1}
              isProfile={isProfile}
              totalTime={totalTime}
              isLastChild={index === operator.children.length - 1}
              parentPath={[...parentPath, !isLastChild]} // 传递当前层级是否有后续兄弟节点
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ExecutionPlanView: React.FC<ExecutionPlanViewProps> = ({ plan }) => {
  const { root, mode, metrics } = plan;
  const isProfile = mode === 'profile';

  return (
    <div className="execution-plan-view p-6 space-y-6 max-w-5xl mx-auto">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="p-2 bg-neo-primary/10 rounded-lg">
             <Activity className="w-6 h-6 text-neo-primary" />
           </div>
           <div>
             <h2 className="text-xl font-bold text-white">
               {mode === 'explain' ? 'EXPLAIN' : 'PROFILE'} 分析报告
             </h2>
             <p className="text-sm text-neo-dim">
               {isProfile ? '实际执行的查询性能数据' : 'Neo4j 估计的查询执行计划'}
             </p>
           </div>
         </div>
       </div>

       {metrics && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="p-4 rounded-xl bg-neo-panel border border-neo-border flex flex-col items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-neo-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="text-3xl font-bold text-neo-primary mb-1">
               {formatTime(metrics.totalTime)}
             </div>
             <div className="text-xs text-neo-dim uppercase tracking-wider font-semibold">总耗时</div>
           </div>

           <div className="p-4 rounded-xl bg-neo-panel border border-neo-border flex flex-col items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="text-3xl font-bold text-green-400 mb-1">
               {metrics.totalRows.toLocaleString()}
             </div>
             <div className="text-xs text-neo-dim uppercase tracking-wider font-semibold">总行数</div>
           </div>

           <div className="p-4 rounded-xl bg-neo-panel border border-neo-border flex flex-col items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="text-3xl font-bold text-blue-400 mb-1">
               {metrics.totalDbHits.toLocaleString()}
             </div>
             <div className="text-xs text-neo-dim uppercase tracking-wider font-semibold">DB 命中</div>
           </div>

           <div className="p-4 rounded-xl bg-neo-panel border border-neo-border flex flex-col items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="text-3xl font-bold text-purple-400 mb-1">
               {formatMemory(metrics.totalMemory)}
             </div>
             <div className="text-xs text-neo-dim uppercase tracking-wider font-semibold">内存峰值</div>
           </div>
         </div>
       )}

      <div className="bg-neo-panel border border-neo-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-neo-border bg-neo-bg/30 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <DbIcon className="w-4 h-4 text-neo-secondary" />
             <span className="text-sm font-semibold text-neo-text">
               执行计划详情
             </span>
           </div>
           <div className="text-xs text-neo-dim">
             {isProfile ? '基于实际运行统计' : '基于统计数据估算'}
           </div>
        </div>
        
        <div className="p-4 overflow-x-auto">
          <PlanNode 
            operator={root} 
            depth={0} 
            isProfile={isProfile} 
            totalTime={metrics?.totalTime}
            isLastChild={true} // 根节点是唯一的
            parentPath={[]} // 根节点没有父级线
          />
        </div>
      </div>

       <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
         <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-500 mt-0.5" />
         <div>
           <div className="text-sm font-bold text-yellow-500 mb-1">性能优化建议</div>
           <ul className="space-y-1.5 list-disc list-inside text-xs text-neo-dim">
             <li>如果看到 <span className="text-red-400">CartesianProduct</span>，请检查是否可以添加连接条件以避免笛卡尔积。</li>
             <li>大量的 <span className="text-blue-400">NodeByLabelScan</span> 可能意味着缺少特定属性的索引。</li>
             <li><span className="text-orange-400">Eager</span> 操作符会强制加载所有数据到内存，可能导致性能问题。</li>
             <li>比较 <span className="text-neo-text">估计行数</span> 和 <span className="text-neo-text">实际行数</span>，巨大差异可能意味着统计信息过时。</li>
           </ul>
         </div>
       </div>
    </div>
  );
};

export default ExecutionPlanView;