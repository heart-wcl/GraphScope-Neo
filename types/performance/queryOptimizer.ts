/**
 * Query Optimizer Types
 */

export interface RequiredProperties {
  nodes?: Record<string, string[]>; // { n: ['id', 'name'] }
  relationships?: Record<string, string[]>; // { r: ['type', 'properties'] }
}

export type IndexType = 'PROPERTY' | 'UNIQUE' | 'EXISTENCE';
