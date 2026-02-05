import { driver, auth, Driver, Integer } from 'neo4j-driver';
import { ConnectionConfig, GraphData, Neo4jNode, Neo4jRelationship, ExecutionPlan, PlanOperator } from '../types';

// Types for schema information
export interface NodeLabel {
  label: string;
  count: number;
  properties: string[];
}

export interface RelationshipType {
  type: string;
  count: number;
  properties: string[];
  fromLabels: string[];
  toLabels: string[];
}

export interface SchemaInfo {
  labels: NodeLabel[];
  relationships: RelationshipType[];
}

// Neon color palette for different node types
const NEON_COLORS = [
  '#00F0FF', // Cyan
  '#FF00FF', // Magenta
  '#00FF88', // Neon Green
  '#FF6B00', // Neon Orange
  '#B388FF', // Purple
  '#FFEA00', // Yellow
  '#00FFEF', // Aqua
  '#FF4081', // Pink
  '#69F0AE', // Mint
  '#FFD740', // Amber
];

// Helper to generate consistent neon colors based on labels
const getColor = (label: string) => {
  // Generate consistent color from label string
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % NEON_COLORS.length;
  return NEON_COLORS[index];
};

export const createDriver = (config: ConnectionConfig): Driver => {
  const uri = `${config.protocol}://${config.host}:${config.port}`;
  return driver(uri, auth.basic(config.username, config.password));
};

export const checkConnection = async (config: ConnectionConfig): Promise<boolean> => {
  const drv = createDriver(config);
  try {
    await drv.verifyConnectivity();
    return true;
  } catch (error) {
    console.error("Connection failed", error);
    throw error;
  } finally {
    await drv.close();
  }
};

export const getSchemaInfo = async (driverInstance: Driver, database?: string): Promise<SchemaInfo> => {
  const session = driverInstance.session(database ? { database } : undefined);

  try {
    const labels: NodeLabel[] = [];
    const relationships: RelationshipType[] = [];

    // Get all node labels with counts
    const labelResult = await session.run(`
      CALL db.labels() YIELD label
    `);

    for (const record of labelResult.records) {
      const label = record.get('label');

      // Get count for this label
      const countResult = await session.run(
        `MATCH (n:${label}) RETURN count(n) as count`
      );
      const count = countResult.records[0]?.get('count').toNumber() || 0;

      // Get sample node to get properties
      const propResult = await session.run(
        `MATCH (n:${label}) RETURN keys(n) as props LIMIT 1`
      );
      const properties = propResult.records[0]?.get('props') || [];

      labels.push({ label, count, properties: Array.isArray(properties) ? properties : [] });
    }

    // Get all relationship types with counts
    const relResult = await session.run(`
      CALL db.relationshipTypes() YIELD relationshipType as type
    `);

    for (const record of relResult.records) {
      const type = record.get('type');

      // Get count for this relationship type
      const countResult = await session.run(
        `MATCH ()-[r:${type}]->() RETURN count(r) as count`
      );
      const count = countResult.records[0]?.get('count').toNumber() || 0;

      // Get sample relationship to get properties
      const propResult = await session.run(
        `MATCH ()-[r:${type}]->() RETURN keys(r) as props LIMIT 1`
      );
      const properties = propResult.records[0]?.get('props') || [];

      // Get source and target labels
      const typeResult = await session.run(
        `MATCH (a)-[r:${type}]->(b) RETURN labels(a) as fromLabels, labels(b) as toLabels LIMIT 1`
      );
      const fromLabels = typeResult.records[0]?.get('fromLabels') || [];
      const toLabels = typeResult.records[0]?.get('toLabels') || [];

      relationships.push({
        type,
        count,
        properties: Array.isArray(properties) ? properties : [],
        fromLabels: Array.isArray(fromLabels) ? fromLabels : [],
        toLabels: Array.isArray(toLabels) ? toLabels : []
      });
    }

    return { labels, relationships };
  } finally {
    await session.close();
  }
};

// Demo mock data for testing
const demoMockData: GraphData = {
  nodes: [
    { id: '1', labels: ['Person'], properties: { name: 'Alice', born: 1985 }, color: '#FF6B6B', radius: 28 },
    { id: '2', labels: ['Movie'], properties: { title: 'The Matrix', year: 1999 }, color: '#4ECDC4', radius: 35 },
    { id: '3', labels: ['Person'], properties: { name: 'Bob', born: 1990 }, color: '#FF6B6B', radius: 28 },
    { id: '4', labels: ['Movie'], properties: { title: 'Inception', year: 2010 }, color: '#4ECDC4', radius: 35 },
    { id: '5', labels: ['Company'], properties: { name: 'Warner Bros' }, color: '#45B7D1', radius: 30 }
  ],
  links: [
    { id: 'r1', type: 'ACTED_IN', startNode: '1', endNode: '2', properties: { role: 'Neo' }, source: '1', target: '2' },
    { id: 'r2', type: 'DIRECTED', startNode: '3', endNode: '2', properties: {}, source: '3', target: '2' },
    { id: 'r3', type: 'ACTED_IN', startNode: '1', endNode: '4', properties: { role: 'Cobb' }, source: '1', target: '4' },
    { id: 'r4', type: 'PRODUCED', startNode: '5', endNode: '4', properties: {}, source: '5', target: '4' }
  ]
};

export const executeCypher = async (
  driverInstance: Driver | null,
  query: string,
  database?: string,
  isDemoMode?: boolean
): Promise<GraphData | { columns: string[]; rows: any[] } | ExecutionPlan> => {
  // Return demo data if in demo mode
  if (isDemoMode) {
    return demoMockData;
  }

  if (!driverInstance) {
    throw new Error('No driver available');
  }

  const session = driverInstance.session(database ? { database } : undefined);

  try {
    const result = await session.run(query);

    console.log('[executeCypher] Query result records:', result.records.length);

    // Check if this is an EXPLAIN or PROFILE query
    const isExplainOrProfile = query.trim().toUpperCase().startsWith('EXPLAIN') ||
                                query.trim().toUpperCase().startsWith('PROFILE');

    console.log('[executeCypher] Is EXPLAIN/PROFILE:', isExplainOrProfile);

    // Handle EXPLAIN/PROFILE queries
    if (isExplainOrProfile) {
      const summary = result.summary;
      const plan = summary.hasProfile() ? summary.profile :
                  summary.hasPlan() ? summary.plan :
                  null;

      if (plan) {
        const mode = summary.hasProfile() ? 'profile' : 'explain';
        console.log('[executeCypher] Mode:', mode);

        // Convert Neo4j Plan to our PlanOperator type
        const convertPlan = (p: any): PlanOperator => ({
          operatorType: p.operatorType,
          identifiers: p.identifiers || [],
          arguments: p.arguments || {},
          children: (p.children || []).map(convertPlan)
        });

        const rootPlan = convertPlan(plan);

        // Calculate metrics for PROFILE queries
        let metrics;
        if (summary.hasProfile()) {
          const profile = summary.profile;
          
          const calculateMetrics = (op: any): { totalTime: number; totalDbHits: number; totalMemory: number; totalRows: number; pageCacheHitRatio?: number } => {
            const childrenMetrics = (op.children || []).reduce((acc: any, child: any) => {
              const childMetrics = calculateMetrics(child);
              acc.totalTime += childMetrics.totalTime;
              acc.totalDbHits += childMetrics.totalDbHits;
              acc.totalMemory += childMetrics.totalMemory;
              acc.totalRows += childMetrics.totalRows;
              return acc;
            }, { totalTime: 0, totalDbHits: 0, totalMemory: 0, totalRows: 0 });

            const args = op.arguments || {};
            return {
              totalTime: childrenMetrics.totalTime + (op.time || 0),
              totalDbHits: childrenMetrics.totalDbHits + (op.dbHits || 0),
              totalMemory: childrenMetrics.totalMemory + (op.memory || 0),
              totalRows: childrenMetrics.totalRows + (op.rows || 0),
              pageCacheHitRatio: op.pageCacheHitRatio
            };
          };

          metrics = calculateMetrics(profile);
          console.log('[executeCypher] Profile metrics:', metrics);
        }

        return {
          root: rootPlan,
          mode,
          metrics
        };
      }
    }

    const nodesMap = new Map<string, Neo4jNode>();
    const linksMap = new Map<string, Neo4jRelationship>();
    // Map from Neo4j internal ID (string) to node's display ID
    const internalIdToNodeId = new Map<string, string>();

    // Check if this is a graph query or a tabular query
    const hasGraphData = result.records.some(record =>
      record.keys.some(key => {
        const value = record.get(key);
        return value && typeof value === 'object' &&
               ((value.labels && value.identity) || (value.type && typeof value.start !== 'undefined'));
      })
    );

    console.log('[executeCypher] Has graph data:', hasGraphData);

    // If no graph data found, return tabular result
    if (!hasGraphData) {
      const columns = result.records[0]?.keys.map(String) || [];
      const rows = result.records.map(record =>
        columns.map(col => {
          const value = record.get(col);
          // Handle Neo4j Integer type
          if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
            return value.toNumber();
          }
          // Handle arrays and objects
          if (Array.isArray(value)) {
            return value.map(v => {
              if (v && typeof v === 'object' && typeof v.toNumber === 'function') {
                return v.toNumber();
              }
              return v;
            });
          }
          return value;
        })
      );
      return { columns, rows };
    }

    result.records.forEach((record, idx) => {
      console.log(`[executeCypher] Record ${idx} keys:`, record.keys);
      record.keys.forEach(key => {
        const stringKey = String(key);
        const value = record.get(key);
        console.log(`[executeCypher] Record ${idx} key='${stringKey}' value type:`, typeof value);
        if (value && typeof value === 'object') {
          console.log(`[executeCypher] Record ${idx} key='${stringKey}' keys:`, Object.keys(value));
          // Check if it's a relationship
          if (value.type && typeof value.start !== 'undefined') {
            console.log(`[executeCypher] Record ${idx} key='${stringKey}' IS RELATIONSHIP:`, {
              type: value.type,
              identity: value.identity?.toNumber()?.toString(),
              start: value.start?.toNumber()?.toString(),
              end: value.end?.toNumber()?.toString()
            });
          }
          // Check if it's a node
          if (value.labels && value.identity) {
            console.log(`[executeCypher] Record ${idx} key='${stringKey}' IS NODE:`, {
              labels: value.labels,
              identity: value.identity?.toNumber()?.toString()
            });
          }
        }
      });
    });

    console.log('[executeCypher] Starting first pass: collect nodes...');
    result.records.forEach(record => {
      record.keys.forEach(key => {
        const value = record.get(key);
        collectNodes(value, nodesMap, internalIdToNodeId);
      });
    });

    console.log('[executeCypher] First pass complete:', {
      nodesCount: nodesMap.size,
      mappingSize: internalIdToNodeId.size
    });
    console.log('[executeCypher] Node mapping:', Array.from(internalIdToNodeId.entries()));

    console.log('[executeCypher] Starting second pass: process relationships...');
    result.records.forEach(record => {
      record.keys.forEach(key => {
        const value = record.get(key);
        processRelationship(value, nodesMap, linksMap, internalIdToNodeId);
      });
    });

    console.log('[executeCypher] Second pass complete:', {
      linksCount: linksMap.size
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links: Array.from(linksMap.values())
    };
  } finally {
    await session.close();
  }
};

// First pass: collect nodes and build ID mapping
const collectNodes = (
  value: any,
  nodesMap: Map<string, Neo4jNode>,
  internalIdToNodeId: Map<string, string>
) => {
  if (value === null || value === undefined) return;

  // Handle Node
  if (value.labels && value.identity) {
    const internalId = value.identity.toString();
    const displayId = internalId; // Use internal Neo4j ID as display ID

    if (!nodesMap.has(displayId)) {
      const label = value.labels[0] || 'Node';
      nodesMap.set(displayId, {
        id: displayId,
        labels: value.labels,
        properties: value.properties,
        color: getColor(label),
        radius: 20 + (Object.keys(value.properties).length * 1.5)
      });
      // Build mapping from internal ID to node's display ID
      internalIdToNodeId.set(internalId, displayId);
    }
    return;
  }

  // Handle Path
  if (value.segments && Array.isArray(value.segments)) {
    collectNodes(value.start, nodesMap, internalIdToNodeId);
    value.segments.forEach((segment: any) => {
      collectNodes(segment.start, nodesMap, internalIdToNodeId);
      collectNodes(segment.end, nodesMap, internalIdToNodeId);
    });
    return;
  }

  // Handle List
  if (Array.isArray(value)) {
    value.forEach(item => collectNodes(item, nodesMap, internalIdToNodeId));
    return;
  }

  // Handle Map
  if (typeof value === 'object') {
    if (value && typeof value.toNumber === 'function') return;
    Object.values(value).forEach(v => collectNodes(v, nodesMap, internalIdToNodeId));
  }
};

// Second pass: process relationships using the ID mapping
const processRelationship = (
  value: any,
  nodesMap: Map<string, Neo4jNode>,
  linksMap: Map<string, Neo4jRelationship>,
  internalIdToNodeId: Map<string, string>
) => {
  if (value === null || value === undefined) return;

  // Handle Relationship
  // Neo4j driver returns: identity, type, start, end, properties (NOT startNode/endNode)
  if (value.type && typeof value.start !== 'undefined' && typeof value.end !== 'undefined' && value.identity) {
    const relInternalId = value.identity.toString();
    if (!linksMap.has(relInternalId)) {
      const startInternalId = value.start.toNumber()?.toString() || String(value.start);
      const endInternalId = value.end.toNumber()?.toString() || String(value.end);

      console.log('[processRelationship] Found relationship:', {
        relId: relInternalId,
        type: value.type,
        start: startInternalId,
        end: endInternalId,
        hasStartNode: internalIdToNodeId.has(startInternalId),
        hasEndNode: internalIdToNodeId.has(endInternalId)
      });

      // Look up the actual node IDs from the mapping
      const startNodeId = internalIdToNodeId.get(startInternalId) || startInternalId;
      const endNodeId = internalIdToNodeId.get(endInternalId) || endInternalId;

      linksMap.set(relInternalId, {
        id: relInternalId,
        type: value.type,
        startNode: startNodeId,
        endNode: endNodeId,
        source: startNodeId,
        target: endNodeId,
        properties: value.properties
      });

      console.log('[processRelationship] Created link:', linksMap.get(relInternalId));
    }
    return;
  }

  // Handle Path
  if (value.segments && Array.isArray(value.segments)) {
    value.segments.forEach((segment: any) => {
      processRelationship(segment.relationship, nodesMap, linksMap, internalIdToNodeId);
    });
    return;
  }

  // Handle List
  if (Array.isArray(value)) {
    value.forEach(item => processRelationship(item, nodesMap, linksMap, internalIdToNodeId));
    return;
  }

  // Handle Map
  if (typeof value === 'object') {
    if (value && typeof value.toNumber === 'function') return;
    Object.values(value).forEach(v => processRelationship(v, nodesMap, linksMap, internalIdToNodeId));
  }
};

// Update a single node property
export const updateNodeProperty = async (
  driverInstance: Driver,
  nodeId: string,
  propertyKey: string,
  newValue: any,
  database?: string
): Promise<void> => {
  const session = driverInstance.session(database ? { database } : undefined);

  try {
    // Convert value to appropriate Cypher format
    const cypherValue = formatValueForCypher(newValue);

    await session.run(`
      MATCH (n)
      WHERE id(n) = $nodeId
      SET n.${propertyKey} = ${cypherValue}
    `, { nodeId: parseInt(nodeId) });
  } finally {
    await session.close();
  }
};

// Update a single relationship property
export const updateRelationshipProperty = async (
  driverInstance: Driver,
  relId: string,
  propertyKey: string,
  newValue: any,
  database?: string
): Promise<void> => {
  const session = driverInstance.session(database ? { database } : undefined);

  try {
    // Convert value to appropriate Cypher format
    const cypherValue = formatValueForCypher(newValue);

    await session.run(`
      MATCH ()-[r]->()
      WHERE id(r) = $relId
      SET r.${propertyKey} = ${cypherValue}
    `, { relId: parseInt(relId) });
  } finally {
    await session.close();
  }
};

// Create a new node
export const createNode = async (
  driverInstance: Driver,
  label: string,
  properties: Record<string, any>,
  database?: string
): Promise<{ id: string }> => {
  const session = driverInstance.session(database ? { database } : undefined);

  try {
    // Format properties for Cypher
    const propParts: string[] = [];
    const propValues: Record<string, any> = {};

    Object.entries(properties).forEach(([key, value], idx) => {
      propParts.push(`${key}: $prop${idx}`);
      propValues[`prop${idx}`] = value;
    });

    const cypher = propParts.length > 0
      ? `CREATE (n:${label} { ${propParts.join(', ')} }) RETURN id(n) as id`
      : `CREATE (n:${label}) RETURN id(n) as id`;

    const result = await session.run(cypher, propValues);
    const record = result.records[0];
    const nodeId = record?.get('id')?.toNumber()?.toString() || '';

    return { id: nodeId };
  } finally {
    await session.close();
  }
};

// Delete a node by ID (and its relationships)
export const deleteNode = async (
  driverInstance: Driver,
  nodeId: string,
  database?: string
): Promise<void> => {
  const session = driverInstance.session(database ? { database } : undefined);

  try {
    // First delete all relationships, then the node
    await session.run(`
      MATCH (n)
      WHERE id(n) = $nodeId
      OPTIONAL MATCH (n)-[r]-()
      DELETE r
    `, { nodeId: parseInt(nodeId) });

    await session.run(`
      MATCH (n)
      WHERE id(n) = $nodeId
      DELETE n
    `, { nodeId: parseInt(nodeId) });
  } finally {
    await session.close();
  }
};

// Helper to format values for Cypher query
const formatValueForCypher = (value: any): string => {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'object') {
    // Handle arrays and objects
    return JSON.stringify(value);
  }
  // Escape single quotes for strings
  const escaped = String(value).replace(/'/g, "\\'");
  return `'${escaped}'`;
};

// Create a new relationship between two nodes
export const createRelationship = async (
  driverInstance: Driver,
  startNodeId: string,
  endNodeId: string,
  relationshipType: string,
  properties: Record<string, any>,
  database?: string
): Promise<{ id: string }> => {
  const session = driverInstance.session(database ? { database } : undefined);

  try {
    // Format properties for Cypher
    const propParts: string[] = [];
    const propValues: Record<string, any> = {};

    Object.entries(properties).forEach(([key, value], idx) => {
      propParts.push(`${key}: $prop${idx}`);
      propValues[`prop${idx}`] = value;
    });

    const cypher = propParts.length > 0
      ? `MATCH (a), (b) WHERE id(a) = $startNodeId AND id(b) = $endNodeId CREATE (a)-[r:${relationshipType} { ${propParts.join(', ')} }]->(b) RETURN id(r) as id`
      : `MATCH (a), (b) WHERE id(a) = $startNodeId AND id(b) = $endNodeId CREATE (a)-[r:${relationshipType}]->(b) RETURN id(r) as id`;

    const result = await session.run(cypher, {
      startNodeId: parseInt(startNodeId),
      endNodeId: parseInt(endNodeId),
      ...propValues
    });
    const record = result.records[0];
    const relId = record?.get('id')?.toNumber()?.toString() || '';

    return { id: relId };
  } finally {
    await session.close();
  }
};

// Get all available nodes for relationship creation
export const getAllNodes = async (
  driverInstance: Driver,
  database?: string,
  limit: number = 1000
): Promise<Neo4jNode[]> => {
  const session = driverInstance.session(database ? { database } : undefined);

  // Ensure limit is always an integer
  const intLimit = Math.floor(limit);

  try {
    const result = await session.run(`
      MATCH (n)
      RETURN id(n) as id, labels(n) as labels, properties(n) as props
      LIMIT ${intLimit}
    `);

    const nodes: Neo4jNode[] = [];
    result.records.forEach(record => {
      const id = record.get('id').toNumber().toString();
      const labels = record.get('labels');
      const props = record.get('props');
      const label = labels[0] || 'Node';

      nodes.push({
        id,
        labels,
        properties: props,
        color: getColor(label),
        radius: 20 + (Object.keys(props).length * 1.5)
      });
    });

    return nodes;
  } finally {
    await session.close();
  }
};

// Delete a relationship by ID
export const deleteRelationship = async (
  driverInstance: Driver,
  relId: string,
  database?: string
): Promise<void> => {
  const session = driverInstance.session(database ? { database } : undefined);

  try {
    await session.run(`
      MATCH ()-[r]->()
      WHERE id(r) = $relId
      DELETE r
    `, { relId: parseInt(relId) });
  } finally {
    await session.close();
  }
};

// Delete a node property
export const deleteNodeProperty = async (
  driverInstance: Driver,
  nodeId: string,
  propertyKey: string,
  database?: string
): Promise<void> => {
  const session = driverInstance.session(database ? { database } : undefined);

  try {
    await session.run(`
      MATCH (n)
      WHERE id(n) = $nodeId
      REMOVE n.${propertyKey}
    `, { nodeId: parseInt(nodeId) });
  } finally {
    await session.close();
  }
};

// Delete a relationship property
export const deleteRelationshipProperty = async (
  driverInstance: Driver,
  relId: string,
  propertyKey: string,
  database?: string
): Promise<void> => {
  const session = driverInstance.session(database ? { database } : undefined);

  try {
    await session.run(`
      MATCH ()-[r]->()
      WHERE id(r) = $relId
      REMOVE r.${propertyKey}
    `, { relId: parseInt(relId) });
  } finally {
    await session.close();
  }
};

// Performance optimization exports
export * from './performance';

