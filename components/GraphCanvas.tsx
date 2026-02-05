import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, Neo4jNode, Neo4jRelationship } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (node: Neo4jNode) => void;
  onRelationshipClick?: (relationship: Neo4jRelationship) => void;
  onAddRelationship?: (node: Neo4jNode) => void;
  width: number;
  height: number;
  isLoading?: boolean;
}

const GraphCanvas: React.FC<GraphCanvasProps> = ({ data, onNodeClick, onRelationshipClick, onAddRelationship, width, height, isLoading = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const { theme } = useTheme();
  const getNodeFillColor = () => theme === 'dark' ? '#0B0E14' : '#FFFFFF';
  const getNodeTextColor = () => theme === 'dark' ? '#E2E8F0' : '#1E293B';
  const getLinkHoverColor = () => theme === 'dark' ? '#FFFFFF' : '#000000';

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Define defs for glow effects and arrow markers
    const defs = svg.append("defs");

    // Glow filter
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-100%")
      .attr("y", "-100%")
      .attr("width", "300%")
      .attr("height", "300%");

    filter.append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Zoom behavior
    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });
    svg.call(zoom);

    // Render Links with labels
    const linkGroup = g.append("g").attr("class", "links");

    // Arrow marker for relationship direction
    data.links.forEach((d, i) => {
      const markerId = `arrow-${i}`;
      const color = (d.target as Neo4jNode).color || '#94A3B8';
      
      defs.append("marker")
        .attr("id", markerId)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25)  // Position at end of link
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    });

    // Create gradient for flow effect
    data.links.forEach((d, i) => {
      const gradientId = `flow-gradient-${i}`;
      const color = (d.target as Neo4jNode).color || '#94A3B8';
      
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

      // Gradient with pulsing effect
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", color)
        .attr("stop-opacity", 0.2);

      gradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", color)
        .attr("stop-opacity", 1);

      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", color)
        .attr("stop-opacity", 0.2);
    });

    // Add animated lightning/pulse effects on links
    const pulseEffects = linkGroup.selectAll(".pulse-effect")
      .data(data.links)
      .enter().append("circle")
      .attr("class", "pulse-effect")
      .attr("r", 4)
      .attr("fill", d => (d.target as Neo4jNode).color || '#94A3B8')
      .style("filter", "url(#glow)")
      .style("opacity", 0);

    // Simulation Setup - Optimized for better node distribution with longer edges
    const simulation = d3.forceSimulation<Neo4jNode>(data.nodes)
      .force("link", d3.forceLink<Neo4jNode, Neo4jRelationship>(data.links)
        .id(d => d.id)
        .distance(200))  // Longer links to spread nodes apart
      .force("charge", d3.forceManyBody().strength(-500))  // Stronger repulsion to push nodes apart
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(d => (d.radius || 20) + 40))  // More collision space between nodes
      .force("x", d3.forceX(width / 2).strength(0.02))  // Weaker gravity to center
      .force("y", d3.forceY(height / 2).strength(0.02));

    // Link lines - With gradient, no glow on lines
    const link = linkGroup.selectAll(".link-line")
      .data(data.links)
      .enter().append("line")
      .attr("class", "link-line")
      .attr("stroke", d => `url(#flow-gradient-${data.links.indexOf(d)})`)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.5)
      .attr("marker-end", d => `url(#arrow-${data.links.indexOf(d)})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onRelationshipClick) {
          onRelationshipClick(d);
        }
      })
      .on("mouseover", function(event, d) {
        d3.select(this).attr("stroke", getLinkHoverColor()).attr("stroke-width", 3).attr("stroke-opacity", 0.8);
        // Highlight arrow
        const idx = data.links.indexOf(d);
        d3.select(`#arrow-${idx} path`).attr("fill", "#FFFFFF");
      })
      .on("mouseout", function(event, d) {
        const color = (d.target as Neo4jNode).color || '#94A3B8';
        d3.select(this).attr("stroke", `url(#flow-gradient-${data.links.indexOf(d)})`).attr("stroke-width", 2).attr("stroke-opacity", 0.5);
        // Reset arrow
        const idx = data.links.indexOf(d);
        d3.select(`#arrow-${idx} path`).attr("fill", color);
      });

      // Update gradients and arrow colors on tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as Neo4jNode).x!)
        .attr("y1", d => (d.source as Neo4jNode).y!)
        .attr("x2", d => (d.target as Neo4jNode).x!)
        .attr("y2", d => (d.target as Neo4jNode).y!);

      // Update label positions (midpoint of link)
      linkLabel
        .attr("x", d => ((d.source as Neo4jNode).x! + (d.target as Neo4jNode).x!) / 2)
        .attr("y", d => ((d.source as Neo4jNode).y! + (d.target as Neo4jNode).y!) / 2);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Relationship type labels - Match node border color
    const linkLabel = linkGroup.selectAll(".link-label")
      .data(data.links)
      .enter().append("text")
      .attr("class", "link-label")
      .attr("text-anchor", "middle")
      .attr("fill", d => (d.source as Neo4jNode).color || '#94A3B8')
      .attr("font-size", "8px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-weight", "500")
      .attr("dy", -5)
      .style("pointer-events", "none")
      .style("text-shadow", "0 0 8px currentColor")
      .text(d => d.type);

    // Render Nodes Group
    const node = g.append("g")
      .selectAll("g")
      .data(data.nodes)
      .enter().append("g")
      .call(d3.drag<SVGGElement, Neo4jNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    const nodeFillColor = getNodeFillColor();
    const nodeCircle = node.append("circle")
      .attr("r", d => d.radius || 20)
      .attr("fill", nodeFillColor)
      .attr("stroke", d => d.color || '#94A3B8')
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      })
      .on("mouseover", function() {
        d3.select(this).attr("stroke", getLinkHoverColor()).attr("stroke-width", 3);
        if (onAddRelationship) {
          d3.select(this.parentNode).select(".add-rel-btn").style("opacity", "1");
        }
      })
      .on("mouseout", function(event, d) {
        d3.select(this).attr("stroke", d.color || '#94A3B8').attr("stroke-width", 2);
        if (onAddRelationship) {
          d3.select(this.parentNode).select(".add-rel-btn").style("opacity", "0");
        }
      });

    // Add Relationship Button (small circle on top-right of node)
    if (onAddRelationship) {
      node.append("circle")
        .attr("class", "add-rel-btn")
        .attr("r", 8)
        .attr("cx", d => (d.radius || 20) - 5)
        .attr("cy", d => -(d.radius || 20) + 5)
        .attr("fill", "#10B981")
        .attr("stroke", "#065F46")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .style("opacity", 0)
        .style("transition", "opacity 0.2s")
        .on("click", function(event, d) {
          event.stopPropagation();
          event.preventDefault();
          if (typeof onAddRelationship === 'function') {
            onAddRelationship(d);
          }
        })
        .on("mouseover", function() {
          d3.select(this).attr("fill", "#34D399").attr("r", 9);
        })
        .on("mouseout", function() {
          d3.select(this).attr("fill", "#10B981").attr("r", 8);
        });

      // Plus icon on the button
      node.append("path")
        .attr("class", "add-rel-btn")
        .attr("d", "M-3 0 H3 M0 -3 V3")
        .attr("transform", d => `translate(${(d.radius || 20) - 5}, ${-(d.radius || 20) + 5})`)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .style("opacity", 0)
        .style("transition", "opacity 0.2s")
        .style("pointer-events", "none")
        .on("mouseover", function() {
          d3.select(this).attr("stroke", "#ffffff");
        });
    }

    // Dynamic icons based on label
    node.append("text")
      .text(d => {
        const label = d.labels[0]?.toLowerCase() || '';
        if (label.includes('person') || label.includes('user')) return '👤';
        if (label.includes('movie') || label.includes('film')) return '🎬';
        if (label.includes('product')) return '📦';
        if (label.includes('order')) return '📋';
        if (label.includes('category')) return '📁';
        if (label.includes('company') || label.includes('organization')) return '🏢';
        if (label.includes('location') || label.includes('city')) return '📍';
        if (label.includes('time') || label.includes('date')) return '📅';
        return '⬢';
      })
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .style("pointer-events", "none");

    // Labels below nodes
    const nodeTextColor = getNodeTextColor();
    node.append("text")
      .text(d => {
        const nameProp = Object.keys(d.properties).find(k =>
          k.toLowerCase().includes('name') ||
          k.toLowerCase().includes('title') ||
          k.toLowerCase().includes('email')
        );
        return nameProp ? String(d.properties[nameProp]).slice(0, 15) : d.labels[0] || d.id;
      })
      .attr("x", 0)
      .attr("y", d => (d.radius || 20) + 15)
      .attr("text-anchor", "middle")
      .attr("fill", nodeTextColor)
      .attr("font-size", "10px")
      .attr("class", "node-label")
      .style("pointer-events", "none");

    // Flowing current animation function
    const animatePulse = () => {
      pulseEffects
        .attr("cx", d => {
          const source = d.source as Neo4jNode;
          const target = d.target as Neo4jNode;
          const t = (Date.now() % 3000) / 3000;
          return source.x! + (target.x! - source.x!) * t;
        })
        .attr("cy", d => {
          const source = d.source as Neo4jNode;
          const target = d.target as Neo4jNode;
          const t = (Date.now() % 3000) / 3000;
          return source.y! + (target.y! - source.y!) * t;
        })
        .style("opacity", d => {
          const t = (Date.now() % 3000) / 3000;
          if (t < 0.15) return t / 0.15;
          if (t > 0.85) return (1 - t) / 0.15;
          return 1;
        });
      animationFrameId = requestAnimationFrame(animatePulse);
    };

    let animationFrameId = requestAnimationFrame(animatePulse);

    function dragstarted(event: any, d: Neo4jNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: Neo4jNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: Neo4jNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [data, width, height, onNodeClick, onRelationshipClick, onAddRelationship, theme]);

  return (
    <div className="relative w-full h-full bg-neo-bg overflow-hidden rounded-xl border border-neo-border shadow-inner">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
           style={{
             backgroundImage: 'radial-gradient(circle, var(--neo-border) 1px, transparent 1px)',
             backgroundSize: '20px 20px'
           }}>
      </div>
       {isLoading && (
         <div className="absolute inset-0 bg-neo-bg/80 flex items-center justify-center z-10">
           <div className="flex flex-col items-center gap-3">
             <div className="w-12 h-12 border-4 border-neo-primary border-t-transparent rounded-full animate-spin"></div>
             <span className="text-neo-primary text-sm font-medium">执行 Cypher 查询中...</span>
           </div>
         </div>
       )}
       {!isLoading && data.nodes.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center z-10">
           <div className="flex flex-col items-center gap-3 text-neo-dim">
             <div className="w-16 h-16 rounded-full bg-neo-panel flex items-center justify-center border border-neo-border">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
               </svg>
             </div>
             <span className="text-sm">未返回任何节点。请尝试其他查询。</span>
           </div>
         </div>
       )}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-full"
      />
       <div className="absolute bottom-4 right-4 bg-neo-panel px-3 py-1 rounded-full text-xs text-neo-dim border border-neo-border">
         缩放：{Math.round(zoomLevel * 100)}%
       </div>
    </div>
  );
};

export default GraphCanvas;