import { GraphData, Neo4jNode, Neo4jRelationship } from './types';

export const generateMockGraph = (query: string): GraphData => {
  // Deterministic mock data based on query length or random
  const nodeCount = 15 + Math.floor(Math.random() * 10);
  const nodes: Neo4jNode[] = [];
  const links: Neo4jRelationship[] = [];

  const labels = ['Person', 'Movie', 'Genre', 'Director', 'Actor'];
  const colors = ['#FF0055', '#00F2FF', '#3746A3', '#F5A623', '#7ED321'];

  for (let i = 0; i < nodeCount; i++) {
    const labelIndex = Math.floor(Math.random() * labels.length);
    nodes.push({
      id: `node-${i}`,
      labels: [labels[labelIndex]],
      properties: {
        name: `Mock Node ${i}`,
        title: `Movie Title ${i}`,
        released: 1990 + i,
        tagline: "A mock tagline for demo purposes"
      },
      x: 0,
      y: 0,
      color: colors[labelIndex],
      radius: 20 + Math.random() * 10
    });
  }

  // Create random links
  for (let i = 0; i < nodeCount * 1.5; i++) {
    const source = Math.floor(Math.random() * nodeCount);
    const target = Math.floor(Math.random() * nodeCount);
    if (source !== target) {
      links.push({
        id: `link-${i}`,
        type: ['ACTED_IN', 'DIRECTED', 'PRODUCED', 'WROTE'][Math.floor(Math.random() * 4)],
        startNode: `node-${source}`,
        endNode: `node-${target}`,
        source: `node-${source}`,
        target: `node-${target}`,
        properties: { roles: ['Character A'] }
      });
    }
  }

  return { nodes, links };
};