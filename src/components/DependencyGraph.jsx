import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function DependencyGraph({ projects, dependencies }) {
  const svgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        // Set height based on aspect ratio (3:2 for mobile, 4:3 for desktop)
        const height = width < 640 ? (width * 0.67) : (width * 0.75);
        setDimensions({ width, height });
      }
    };

    // Initial update
    updateDimensions();

    // Update dimensions on window resize
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;

    // Clear previous graph
    svg.selectAll("*").remove();

    // Adjust force parameters based on screen size
    const isMobile = width < 640;
    const linkDistance = isMobile ? 80 : 150;
    const chargeStrength = isMobile ? -100 : -200;
    const nodeRadius = isMobile ? 6 : 10;
    const fontSize = isMobile ? "10px" : "12px";

    const simulation = d3.forceSimulation(projects)
      .force("link", d3.forceLink(dependencies)
        .id(d => d.id)
        .distance(linkDistance))
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(nodeRadius * 3));

    const links = svg.append("g")
      .selectAll("line")
      .data(dependencies)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-width", isMobile ? 1 : 2);

    const nodes = svg.append("g")
      .selectAll("circle")
      .data(projects)
      .enter().append("circle")
      .attr("r", nodeRadius)
      .attr("fill", d => d.status === 'completed' ? "#22c55e" : "#eab308")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    const labels = svg.append("g")
      .selectAll("text")
      .data(projects)
      .enter().append("text")
      .text(d => d.name)
      .attr("font-size", fontSize)
      .attr("dx", nodeRadius + 5)
      .attr("dy", 4)
      .style("user-select", "none")
      .each(function(d) {
        // Truncate text if too long on mobile
        if (isMobile) {
          const text = d3.select(this);
          const textLength = text.node().getComputedTextLength();
          const maxLength = width / 4; // Maximum text length on mobile
          
          if (textLength > maxLength) {
            let textContent = text.text();
            while (textLength > maxLength) {
              textContent = textContent.slice(0, -4) + "...";
              text.text(textContent);
              if (text.node().getComputedTextLength() <= maxLength) break;
            }
          }
        }
      });

    // Ensure nodes stay within the SVG bounds
    simulation.on("tick", () => {
      links
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      nodes
        .attr("cx", d => d.x = Math.max(nodeRadius, Math.min(width - nodeRadius, d.x)))
        .attr("cy", d => d.y = Math.max(nodeRadius, Math.min(height - nodeRadius, d.y)));

      labels
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  }, [projects, dependencies, dimensions]);

  return (
    <div ref={containerRef} className="border rounded-lg p-4 bg-white w-full">
      <h3 className="text-lg font-medium mb-4">Project Dependencies</h3>
      <svg 
        ref={svgRef} 
        width={dimensions.width} 
        height={dimensions.height}
        style={{ maxWidth: '100%', height: 'auto' }}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}
