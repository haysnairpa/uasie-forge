import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function DependencyGraph({ projects, dependencies }) {
  const svgRef = useRef();

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const width = 600; // Area SVG width
    const height = 400; // Area SVG height

    // Clear previous graph
    svg.selectAll("*").remove();

    const simulation = d3.forceSimulation(projects)
      .force("link", d3.forceLink(dependencies)
        .id(d => d.id)
        .distance(150))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50));

    const links = svg.append("g")
      .selectAll("line")
      .data(dependencies)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-width", 2);

    const nodes = svg.append("g")
      .selectAll("circle")
      .data(projects)
      .enter().append("circle")
      .attr("r", 10)
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
      .attr("font-size", "12px")
      .attr("dx", 15)
      .attr("dy", 4);

    // Ensure nodes stay within the SVG bounds
    simulation.on("tick", () => {
      links
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      nodes
        .attr("cx", d => d.x = Math.max(10, Math.min(width - 10, d.x)))
        .attr("cy", d => d.y = Math.max(10, Math.min(height - 10, d.y)));

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
  }, [projects, dependencies]);

  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="text-lg font-medium mb-4">Project Dependencies</h3>
      <svg ref={svgRef} width="800" height="600" />
    </div>
  );
}
