import React from 'react';
import { Table } from 'lucide-react';

interface QueryResultTableProps {
  columns: string[];
  rows: any[];
}

const QueryResultTable: React.FC<QueryResultTableProps> = ({ columns, rows }) => {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neo-dim">
        <Table className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">无结果</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-[#0B0E14] z-10">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className="px-4 py-3 text-xs font-bold text-neo-primary uppercase tracking-wider border-b border-neo-border whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="hover:bg-white/5 transition-colors"
            >
              {row.map((cell: any, colIdx) => (
                <td
                  key={colIdx}
                  className="px-4 py-3 text-sm text-white border-b border-neo-border whitespace-nowrap"
                >
                  {cell === null || cell === undefined ? (
                    <span className="text-neo-dim italic">null</span>
                  ) : typeof cell === 'object' ? (
                    <pre className="text-xs text-neo-secondary font-mono overflow-hidden max-w-md">
                      {JSON.stringify(cell, null, 2)}
                    </pre>
                  ) : Array.isArray(cell) ? (
                    <span className="text-neo-secondary font-mono text-xs">
                      [{cell.join(', ')}]
                    </span>
                  ) : typeof cell === 'boolean' ? (
                    <span className={cell ? 'text-green-400' : 'text-red-400'}>
                      {String(cell)}
                    </span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

       <div className="fixed bottom-4 left-4">
         <div className="glass-panel px-3 py-1.5 rounded-full flex items-center gap-2 text-xs text-neo-dim shadow-lg backdrop-blur-md">
           <div className="w-2 h-2 rounded-full bg-neo-primary"></div>
           {rows.length} {rows.length === 1 ? '行' : '行'}
         </div>
       </div>
    </div>
  );
};

export default QueryResultTable;
