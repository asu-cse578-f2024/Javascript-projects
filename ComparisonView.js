export class ComparisonView {
    constructor(selector, manager) {
        this.container = d3.select(selector);
        this.manager = manager;
        this.currentData = null;
        this.svg = null;
        this.setupSvg();
    }

    setupSvg() {
        const margin = {
            top: 0,
            right: 10,
            bottom: 40,
            left: 10
        };
        const width = 600 - margin.left - margin.right;
        const height = 350 - margin.top - margin.bottom;

        this.svg = this.container
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    }

    clearSelection() {
        
        this.svg.selectAll('*').remove();
        this.currentData = null;
    }

    update(data) {
        if (!data.filtered || !data.dominatedScores) return;
        
        
        this.currentData = data.filtered;
        
        if (data.filtered.length === 0) {
            
            this.svg.selectAll('.radar-chart')
                .transition()
                .duration(this.manager.transitions.comparison)
                .style('opacity', 0)
                .remove();
            
            this.svg.selectAll('.connection-group')
                .transition()
                .duration(this.manager.transitions.comparison)
                .style('opacity', 0)
                .remove();
                
            return;
        }

        this.updateRadarCharts(data.filtered, data.dominatedScores);
    }

    dominates(point1, point2) {
        const metrics = Object.keys(point1)
            .filter(key => !['country', 'year', 'x', 'y'].includes(key))
            .filter(key => !isNaN(parseFloat(point1[key])));
    
        const allBetterOrEqual = metrics.every(
            metric => parseFloat(point1[metric]) >= parseFloat(point2[metric])
        );
    
        const strictlyBetter = metrics.some(
            metric => parseFloat(point1[metric]) > parseFloat(point2[metric])
        );
    
        return allBetterOrEqual && strictlyBetter;
    }

    updateRadarCharts(filtered, dominatedScores) {
        const width = this.svg.node().parentNode.width.baseVal.value;
        const height = this.svg.node().parentNode.height.baseVal.value;
        const positions = this.calculatePositions(width, height, filtered.length);
        
        
        this.svg.selectAll('.connection-group').remove();
        
        
        if (filtered.length > 1) {
            
            const connectionGroup = this.svg.append('g')
                .attr('class', 'connection-group')
                .style('opacity', 0);
                
            this.drawConnectionsAndCircles(connectionGroup, positions, dominatedScores, filtered);
            
            
            connectionGroup.transition()
                .duration(this.manager.transitions.comparison)
                .style('opacity', 1);
        }
        
        
        const charts = this.svg.selectAll('.radar-chart')
            .data(filtered, d => d.country);
        
        
        charts.exit()
            .transition()
            .duration(this.manager.transitions.comparison)
            .style('opacity', 0)
            .remove();
        
        
        const chartsEnter = charts.enter()
            .append('g')
            .attr('class', 'radar-chart')
            .attr('id', d => `radar-chart-${d.country}`)
            .style('opacity', 0)
            .attr('transform', (d, i) => `translate(${positions[i].x},${positions[i].y})`)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                const index = filtered.findIndex(f => f.country === d.country);
                this.showPopupRadarChart(filtered, d.country, index, dominatedScores, 'individual');
            });
        
        
        this.setupRadarChart(chartsEnter);
        
        
        const allCharts = charts.merge(chartsEnter);
        
        
        allCharts
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                const index = filtered.findIndex(f => f.country === d.country);
                this.showPopupRadarChart(filtered, d.country, index, dominatedScores, 'individual');
            });
        
        
        allCharts.transition()
            .duration(this.manager.transitions.comparison)
            .style('opacity', 1)
            .attr('transform', (d, i) => `translate(${positions[i].x},${positions[i].y})`);
        
        
        allCharts.each((d, i, nodes) => {
            this.updateRadarChartContents(
                d3.select(nodes[i]), 
                d, 
                i, 
                filtered, 
                dominatedScores[i]
            );
        });
    }

    drawConnectionsAndCircles(svg, positions, dominatedScores, filtered) {
        const calculateMidpoint = (p1, p2, ratio = 0.5) => ({
            x: p1.x + (p2.x - p1.x) * ratio,
            y: p1.y + (p2.y - p1.y) * ratio
        });

        const calculateTriangleCentroid = (p1, p2, p3) => ({
            x: (p1.x + p2.x + p3.x) / 3,
            y: (p1.y + p2.y + p3.y) / 3
        });

        let centerPoint;
        let connectionPoints;

        
        switch(filtered.length) {
            case 4:
                centerPoint = calculateMidpoint(
                    calculateMidpoint(positions[0], positions[2]),
                    calculateMidpoint(positions[1], positions[3]),
                    0.5
                );
                connectionPoints = this.getFourPointConnections(positions, centerPoint);
                break;
            case 3:
                centerPoint = calculateTriangleCentroid(positions[0], positions[1], positions[2]);
                connectionPoints = this.getThreePointConnections(positions);
                break;
            case 2:
                centerPoint = calculateMidpoint(positions[0], positions[1]);
                connectionPoints = [{
                    nodes: [0, 1],
                    ratio: 0.5,
                    center: true
                }];
                break;
        }

        
        connectionPoints.forEach(({nodes, ratio, from, to, center}) => {
            const midpoint = center ? centerPoint :
                           from && to ? calculateMidpoint(from, to, ratio) :
                           calculateMidpoint(positions[nodes[0]], positions[nodes[1]], ratio);

            
            const pieData = nodes.map(node => ({
                value: dominatedScores[node],
                color: d3.schemeCategory10[node % 10]
            }));

            
            nodes.forEach(node => {
                svg.append("line")
                    .attr("class", "connection-line")
                    .attr("x1", positions[node].x)
                    .attr("y1", positions[node].y)
                    .attr("x2", positions[node].x)
                    .attr("y2", positions[node].y)
                    .attr("stroke", d3.schemeCategory10[node % 10])
                    .attr("stroke-width", 1)
                    .attr("stroke-dasharray", "4,4")
                    .style("opacity", 0)
                    .transition()
                    .duration(this.manager.transitions.comparison)
                    .style("opacity", 1)
                    .attr("x2", midpoint.x)
                    .attr("y2", midpoint.y);
            });

            
            const pieGroup = svg.append("g")
                .attr("class", "pie-chart")
                .attr("transform", `translate(${midpoint.x}, ${midpoint.y})`)
                .style("opacity", 0)
                .style("cursor", "pointer")
                .on("click", () => {
                    this.showPopupRadarChart(filtered, nodes.map(i => filtered[i].country), nodes, dominatedScores, 'combined');
                });

            
            const pie = d3.pie().value(d => d.value);
            const arc = d3.arc().innerRadius(0).outerRadius(12.5);

            pieGroup.selectAll("path")
                .data(pie(pieData))
                .enter()
                .append("path")
                .attr("d", arc)
                .attr("fill", d => d.data.color)
                .style("opacity", 0)
                .transition()
                .duration(this.manager.transitions.comparison)
                .style("opacity", 1);

            pieGroup.transition()
                .delay(this.manager.transitions.comparison / 2)
                .duration(this.manager.transitions.comparison / 2)
                .style("opacity", 1);
        });
    }

    getFourPointConnections(positions, centerPoint) {
        return [
            { nodes: [0, 1, 2, 3], ratio: 0.25, center: true },
            { nodes: [0, 1, 2], ratio: 0.66, from: centerPoint, to: positions[1] },
            { nodes: [1, 2, 3], ratio: 0.4, from: centerPoint, to: positions[2] },
            { nodes: [0, 2, 3], ratio: 0.66, from: centerPoint, to: positions[3] },
            { nodes: [0, 1, 3], ratio: 0.4, from: centerPoint, to: positions[0] },
            { nodes: [0, 1], ratio: 0.5 },
            { nodes: [1, 2], ratio: 0.5 },
            { nodes: [2, 3], ratio: 0.5 },
            { nodes: [0, 3], ratio: 0.5 },
            { nodes: [0, 2], ratio: 0.5, from: centerPoint, to: positions[1] },
            { nodes: [1, 3], ratio: 0.5, from: centerPoint, to: positions[3] }
        ];
    }

    getThreePointConnections(positions) {
        return [
            { nodes: [0, 1, 2], ratio: 0.33, center: true },
            { nodes: [0, 1], ratio: 0.5 },
            { nodes: [1, 2], ratio: 0.5 },
            { nodes: [0, 2], ratio: 0.5 }
        ];
    }
    
    radarchart(filtered, dominatedscore) {
        const width = this.svg.node().parentNode.width.baseVal.value;
        const height = this.svg.node().parentNode.height.baseVal.value;
        const radius = 40;
        
        const metrics = Object.keys(filtered[0])
            .filter(key => !['country', 'year', 'x', 'y'].includes(key))
            .filter(key => !isNaN(parseFloat(filtered[0][key])));
    
        const maxValues = {};
        metrics.forEach(metric => {
            maxValues[metric] = d3.max(filtered, d => d[metric]);
        });
    
        const positions = this.calculatePositions(width, height, filtered.length);
        
        
        this.svg.selectAll('.connection-group').remove();
        
        
        filtered.forEach((data, index) => {
            const chartId = `radar-chart-${data.country}`;
            const existingChart = this.svg.select(`#${chartId}`);
            
            if (existingChart.empty()) {
                this.createRadarChart(data, positions[index], index, metrics, maxValues, dominatedscore, filtered);
            } else {
                this.updateRadarChart(existingChart, data, positions[index], index, metrics, maxValues, dominatedscore);
            }
        });
    
        
        const currentCountries = new Set(filtered.map(d => d.country));
        this.svg.selectAll('.radar-chart')
            .filter(d => d && !currentCountries.has(d.country))
            .transition()
            .duration(750)
            .style('opacity', 0)
            .remove();
    
        
        if (filtered.length > 1) {
            
            const connectionGroup = this.svg.append('g')
                .attr('class', 'connection-group')
                .style('opacity', 0);
                
            this.drawConnectionsAndCircles(connectionGroup, positions, dominatedscore, filtered);
            
            
            connectionGroup.transition()
                .duration(750)
                .style('opacity', 1);
        }
    }

    updateConnections(positions, filtered) {
        const connections = this.generateConnectionData(positions, filtered.length);
        
        
        const connectionGroup = this.svg.selectAll('.connection-group')
            .data([connections]);
            
        const connectionGroupEnter = connectionGroup.enter()
            .append('g')
            .attr('class', 'connection-group')
            .style('opacity', 0);
            
        
        connectionGroup.exit()
            .transition()
            .duration(this.manager.transitions.comparison)
            .style('opacity', 0)
            .remove();
            
        
        const allConnectionGroups = connectionGroup.merge(connectionGroupEnter);
        
        
        allConnectionGroups.transition()
            .duration(this.manager.transitions.comparison)
            .style('opacity', 1);
            
        
        const lines = allConnectionGroups.selectAll('.connection-line')
            .data(connections);
            
        
        const linesEnter = lines.enter()
            .append('line')
            .attr('class', 'connection-line')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.source.x)
            .attr('y2', d => d.source.y)
            .style('opacity', 0);
            
        
        lines.exit()
            .transition()
            .duration(this.manager.transitions.comparison / 2)
            .style('opacity', 0)
            .remove();
            
        
        const allLines = lines.merge(linesEnter);
        
        
        allLines.transition()
            .duration(this.manager.transitions.comparison)
            .style('opacity', 1)
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
    }


    calculatePositions(width, height, count) {
        const margin = { top: 40, right: 40, bottom: 40, left: 40 };
        return {
            1: [{ x: width / 2, y: height / 2 }],
            2: [
                { x: width / 3, y: height / 2 },
                { x: 2 * width / 3, y: height / 2 }
            ],
            3: [
                { x: width / 2, y: margin.top + 60 },
                { x: margin.left + 60, y: height - margin.bottom - 60 },
                { x: width - margin.right - 60, y: height - margin.bottom - 60 }
            ],
            4: [
                { x: width / 2, y: margin.top + 60 },
                { x: width - margin.right - 60, y: height / 2 },
                { x: width / 2, y: height - margin.bottom - 60 },
                { x: margin.left + 60, y: height / 2 }
            ]
        }[count];
    }

    createRadarChart(data, position, index, metrics, maxValues, dominatedscore, filtered) {
        const radius = 35;
        const color = d3.schemeCategory10[index];
        const angleSlice = Math.PI * 2 / metrics.length;
    
        const chartGroup = this.svg.append("g")
            .attr("class", "radar-chart")
            .attr("id", `radar-chart-${data.country}`)
            .attr("transform", `translate(${position.x},${position.y})`)
            .style("opacity", 0);
    
        
        const points = this.calculateRadarPoints(data, metrics, maxValues, radius, angleSlice);
    
        
        chartGroup.append("polygon")
            .attr("points", "0,0 0,0 0,0")
            .attr("fill", color)
            .attr("fill-opacity", 0.1)
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .transition()
            .duration(750)
            .attr("points", points.map(point => point.join(",")).join(" "));
    
        
        metrics.forEach((metric, i) => {
            const angle = i * angleSlice - Math.PI / 2;
            
            chartGroup.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", radius * Math.cos(angle))
                .attr("y2", radius * Math.sin(angle))
                .attr("stroke", "black")
                .attr("stroke-width", 0.1)
                .style("opacity", 0)
                .transition()
                .duration(750)
                .style("opacity", 1);
    
            
            chartGroup.append("text")
                .attr("x", (radius + 10) * Math.cos(angle))
                .attr("y", (radius + 10) * Math.sin(angle))
                .attr("text-anchor", "middle")
                .attr("font-size", "9px")
                .text(this.formatMetricLabel(metric))
                .style("opacity", 0)
                .transition()
                .duration(750)
                .style("opacity", 1);
        });
    
        
        points.forEach((point, i) => {
            chartGroup.append("circle")
                .attr("cx", point[0])
                .attr("cy", point[1])
                .attr("r", 0)
                .attr("fill", color)
                .transition()
                .duration(750)
                .attr("r", 2);
        });
    
        
        chartGroup.append("text")
            .attr("x", 0)
            .attr("y", radius + 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", color)
            .text(data.country)
            .style("opacity", 0)
            .transition()
            .duration(750)
            .style("opacity", 1);
    
        
        chartGroup.style("cursor", "pointer")
            .on("click", () => {
                this.showPopupRadarChart(filtered, data.country, index, dominatedscore, 'individual');
            });
    
        
        chartGroup.transition()
            .duration(750)
            .style("opacity", 1);
    
        return chartGroup;
    }

    setupRadarChart(chartGroup) {
        const radius = 35;
        
        
        chartGroup.append('polygon')
            .attr('class', 'radar-area')
            .attr('points', '0,0')
            .style('fill-opacity', 0.1)
            .style('stroke-width', 2);
            
        chartGroup.append('g')
            .attr('class', 'radar-axes');
            
        chartGroup.append('g')
            .attr('class', 'radar-points');
            
        chartGroup.append('text')
            .attr('class', 'country-label')
            .attr('y', radius + 20)
            .attr('text-anchor', 'middle');
    }

    
    updateRadarChartContents(chartGroup, data, index, filtered, dominatedScore) {
        const radius = 35;
        const color = d3.schemeCategory10[index % 10]; 
        const metrics = this.getMetrics(data);
        const angleSlice = Math.PI * 2 / metrics.length;

        
        const points = this.calculateRadarPoints(data, metrics, filtered, radius, angleSlice);

        
        const closedPoints = [...points, points[0]];
        
        
        chartGroup.select('.radar-area')
            .transition()
            .duration(this.manager.transitions.comparison)
            .attr('points', closedPoints.map(point => point.join(",")).join(" "))
            .style('fill', color)
            .style('stroke', color);
            
        
        const axes = chartGroup.select('.radar-axes')
            .selectAll('.radar-axis')
            .data(metrics);
            
        const axesEnter = axes.enter()
            .append('g')
            .attr('class', 'radar-axis');
            
        axesEnter.append('line')
            .attr('class', 'radar-axis-line')
            .attr('x1', 0)
            .attr('y1', 0)
            .style('stroke', '#999')
            .style('stroke-width', '0.5px');
            
        axesEnter.append('text')
            .attr('class', 'radar-axis-label')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '9px');
            
        
        const allAxes = axes.merge(axesEnter);
        
        allAxes.select('.radar-axis-line')
            .transition()
            .duration(this.manager.transitions.comparison)
            .attr('x2', (_, i) => radius * Math.cos(i * angleSlice - Math.PI / 2))
            .attr('y2', (_, i) => radius * Math.sin(i * angleSlice - Math.PI / 2));
            
        allAxes.select('.radar-axis-label')
            .transition()
            .duration(this.manager.transitions.comparison)
            .attr('x', (_, i) => (radius + 10) * Math.cos(i * angleSlice - Math.PI / 2))
            .attr('y', (_, i) => (radius + 10) * Math.sin(i * angleSlice - Math.PI / 2))
            .text(d => this.formatMetricLabel(d));
            
        
        const dataPoints = chartGroup.select('.radar-points')
            .selectAll('.radar-point')
            .data(points);
            
        const pointsEnter = dataPoints.enter()
            .append('circle')
            .attr('class', 'radar-point')
            .attr('r', 0);
            
        const allPoints = dataPoints.merge(pointsEnter);
        
        allPoints.transition()
            .duration(this.manager.transitions.comparison)
            .attr('cx', d => d[0])
            .attr('cy', d => d[1])
            .attr('r', 2)
            .style('fill', color);
            
        dataPoints.exit()
            .transition()
            .duration(this.manager.transitions.comparison / 2)
            .attr('r', 0)
            .remove();
            
        
        chartGroup.select('.country-label')
            .transition()
            .duration(this.manager.transitions.comparison)
            .text(data.country)
            .style('fill', color);
    }

    getMetrics(data) {
        const metrics = [
            'happiness_score',
            'gdp_per_capita',
            'social_support',
            'healthy_life_expectancy',
            'freedom_to_make_life_choices',
            'generosity',
            'perceptions_of_corruption'
        ];
        
        return metrics.filter(metric => 
            metric in data && 
            !isNaN(+data[metric]) && 
            data[metric] !== null
        );
    }
    
    calculateRadarPoints(data, metrics, allData, radius, angleSlice) {
        
        const maxValues = {};
        metrics.forEach(metric => {
            maxValues[metric] = d3.max(allData, d => +d[metric]) || 1; 
        });

        
        return metrics.map((metric, i) => {
            const value = +data[metric] || 0; 
            const normalizedValue = value / maxValues[metric];
            const angle = i * angleSlice - Math.PI / 2;
            
            return [
                radius * normalizedValue * Math.cos(angle),
                radius * normalizedValue * Math.sin(angle)
            ];
        });
    }
    
    generateConnectionData(positions, count) {
        const connections = [];
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                connections.push({
                    source: positions[i],
                    target: positions[j]
                });
            }
        }
        return connections;
    }

    generateRadarChart(data, position, index, metrics, maxValues, dominatedscore, filtered) {
        const radius = 35; 
        const centerX = position.x;
        const centerY = position.y;
        const color = d3.schemeCategory10[index];
        const angleSlice = Math.PI * 2 / metrics.length;
    
        const chartContainer = this.svg.append("g")
            .attr("class", `radar-chart-${index}`)
            .style("opacity", 0)
            .attr("transform", `translate(${centerX},${centerY})`);
    
        
        const radiusScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);
    
        const points = metrics.map((metric, i) => {
            const normalizedValue = data[metric] / maxValues[metric];
            const angle = i * angleSlice - Math.PI / 2;
            const r = radiusScale(normalizedValue);
            return [r * Math.cos(angle), r * Math.sin(angle)];
        });
    
        
        chartContainer.append("polygon")
            .attr("points", "0,0 0,0 0,0")
            .attr("fill", color)
            .attr("fill-opacity", 0.1)
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .transition()
            .duration(750)
            .attr("points", points.map(point => point.join(",")).join(" "));
    
        
        metrics.forEach((metric, i) => {
            const angle = i * angleSlice - Math.PI / 2;
            chartContainer.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 0)
                .attr("y2", 0)
                .attr("stroke", "black")
                .attr("stroke-width", 0.1)
                .transition()
                .duration(750)
                .attr("x2", radius * Math.cos(angle))
                .attr("y2", radius * Math.sin(angle));
    
            chartContainer.append("text")
                .attr("x", (radius + 10) * Math.cos(angle))
                .attr("y", (radius + 10) * Math.sin(angle))
                .attr("text-anchor", "middle")
                .attr("font-size", "9px")
                .style("opacity", 0)
                .text(this.formatMetricLabel(metric))
                .transition()
                .duration(750)
                .style("opacity", 1);
        });
    
        
        points.forEach((point, i) => {
            chartContainer.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 0)
                .attr("fill", color)
                .attr("stroke", "black")
                .attr("stroke-width", 1)
                .transition()
                .duration(750)
                .attr("cx", point[0])
                .attr("cy", point[1])
                .attr("r", 2);
        });
    
        
        chartContainer.append("text")
            .attr("x", 0)
            .attr("y", radius + 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", color)
            .style("opacity", 0)
            .text(filtered[index].country)
            .transition()
            .duration(750)
            .style("opacity", 1);
    
        
        const domScale = d3.scaleLinear().domain([0, radius]).range([0, 1]);
        const dominatedRadius = domScale(dominatedscore[index]);
        chartContainer.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 0)
            .attr("stroke", "purple")
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .transition()
            .duration(750)
            .attr("r", dominatedRadius * radius);
    
        
        chartContainer.transition()
            .duration(750)
            .style("opacity", 1);
    
        
        chartContainer
            .style("cursor", "pointer")
            .on("click", () => {
                this.showPopupRadarChart(filtered, filtered[index].country, index, dominatedscore, 'individual');
            });
    }


    showPopupRadarChart(filtered, countryName, index, dominatedscore, source) {

        d3.select("body").selectAll(".popup").remove();

        const popup = d3.select("body")
            .append("div")
            .attr("class", "popup")
            .style("position", "fixed")
            .style("top", "50%")
            .style("left", "50%")
            .style("transform", "translate(-50%, -50%)")
            .style("background", "white")
            .style("padding", "20px")
            .style("border", "1px solid #ccc")
            .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)")
            .style("z-index", "1000");

        setTimeout(() => popup.classed("show", true), 10);

        let scores;
        if (Array.isArray(index)) {
            scores = index.map(i => dominatedscore[i].toFixed(0)).join(", ");
        } else {
            scores = dominatedscore[index];
        }

        popup.html(`
            <div style="position: relative;">
                <button class="close-popup" style="position: absolute; top: 0; right: 0;">×</button>
                <h3>Country: ${Array.isArray(countryName) ? countryName.join(", ") : countryName}</h3>
                <h4>Domination Scores: ${scores}</h4>
                <div id="popup-chart"></div>
            </div>
        `);

        popup.select(".close-popup").on("click", () => {
            popup.classed("show", false); 
            setTimeout(() => popup.remove(), 300);
        });
        

        
        if (source === 'combined') {
            this.plotCombined(filtered, index, dominatedscore);
        } else {
            this.plotIndividual(filtered, index, dominatedscore);
        }
    }

    plotIndividual(filtered, index, dominatedscore) {
        const width = 800;
        const height = 600;
        const margin = 50;
        const radius = Math.min(width, height) / 2 - margin - 75;
    
        const svg = d3.select("#popup-chart")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);
    
        const metrics = Object.keys(filtered[0])
            .filter(key => !['country', 'year', 'x', 'y'].includes(key))
            .filter(key => !isNaN(parseFloat(filtered[0][key])));
    
        const maxValues = {};
        metrics.forEach(metric => {
            maxValues[metric] = d3.max(filtered, d => parseFloat(d[metric]));
        });
    
        const angleSlice = (Math.PI * 2) / metrics.length;
    
        
        metrics.forEach((metric, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            svg.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 0)
                .attr("y2", 0)
                .style("stroke", "lightgray")
                .style("stroke-width", "1px")
                .transition()
                .duration(500)
                .attr("x2", radius * Math.cos(angle))
                .attr("y2", radius * Math.sin(angle));
    
            
            svg.append("text")
                .attr("x", (radius + 70) * Math.cos(angle))
                .attr("y", (radius + 70) * Math.sin(angle))
                .style("text-anchor", "middle")
                .style("opacity", 0)
                .text(metric)
                .transition()
                .delay(500)
                .duration(500)
                .style("opacity", 1);
        });
    
        
        [0.2, 0.4, 0.6, 0.8, 1].forEach(level => {
            svg.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 0)
                .style("fill", "none")
                .style("stroke", "lightgray")
                .style("stroke-dasharray", "2,2")
                .transition()
                .duration(500)
                .attr("r", radius * level);
        });
    
        
        const radarLine = d3.lineRadial()
            .radius(d => d * radius)
            .angle((d, i) => angleSlice * i);
    
        const countryData = filtered[index];
        const dataPoints = metrics.map(metric => {
            return countryData[metric] / maxValues[metric];
        });
        const color = d3.schemeCategory10[index];
    
        const closedDataPoints = [...dataPoints, dataPoints[0]];
        const radarPath = svg.append("path")
            .datum(closedDataPoints)
            .attr("d", radarLine)
            .style("fill", color)
            .style("fill-opacity", 0.1)
            .style("stroke", color)
            .style("stroke-width", 2)
            .style("stroke-dasharray", function() {
                return this.getTotalLength();
            })
            .style("stroke-dashoffset", function() {
                return this.getTotalLength();
            })
            .transition()
            .duration(1000)
            .style("stroke-dashoffset", 0);
    
        
        metrics.forEach((metric, i) => {
            const value = countryData[metric] / maxValues[metric];
            const angle = angleSlice * i - Math.PI / 2;
            const x = value * radius * Math.cos(angle);
            const y = value * radius * Math.sin(angle);
    
            svg.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 0)
                .style("fill", color)
                .style("stroke", "white")
                .style("stroke-width", 1)
                .transition()
                .delay(1000)
                .duration(500)
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 4);
    
            
            svg.append("text")
                .attr("x", 0)
                .attr("y", 0)
                .style("opacity", 0)
                .style("text-anchor", "middle")
                .text(countryData[metric].toFixed(2))
                .transition()
                .delay(1500)
                .duration(500)
                .attr("x", x * 1.1)
                .attr("y", y * 1.1)
                .style("opacity", 1);
        });
    
        const domScale = d3.scaleLinear()
            .domain([0, radius])
            .range([0, 200]);
    
        const dominatedRadius = domScale(dominatedscore[index]);
        svg.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 0)
            .style("fill", "none")
            .style("stroke", color)
            .style("stroke-width", 2)
            .style("stroke-dasharray", "5,5")
            .transition()
            .delay(2000)
            .duration(1000)
            .attr("r", dominatedRadius);
    }
    

    plotCombined(filtered, indices, dominatedscore) {
        const width = 800;
        const height = 600;
        const margin = 50;
        const radius = Math.min(width, height) / 2 - margin - 75;
    
        const svg = d3.select("#popup-chart")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);
    
        const metrics = Object.keys(filtered[0])
            .filter(key => !['country', 'year', 'x', 'y'].includes(key))
            .filter(key => !isNaN(parseFloat(filtered[0][key])));
    
        const maxValues = {};
        metrics.forEach(metric => {
            maxValues[metric] = d3.max(filtered, d => parseFloat(d[metric]));
        });
    
        const angleSlice = (Math.PI * 2) / metrics.length;
    
        
        metrics.forEach((metric, i) => {
            const angle = angleSlice * i - Math.PI / 2;
    
            svg.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 0)
                .attr("y2", 0)
                .style("stroke", "lightgray")
                .style("stroke-width", "1px")
                .transition()
                .duration(500)
                .attr("x2", radius * Math.cos(angle))
                .attr("y2", radius * Math.sin(angle));
    
            svg.append("text")
                .attr("x", (radius + 70) * Math.cos(angle))
                .attr("y", (radius + 70) * Math.sin(angle))
                .style("text-anchor", "middle")
                .style("opacity", 0)
                .text(metric)
                .transition()
                .delay(500)
                .duration(500)
                .style("opacity", 1);
        });
    
        
        [0.2, 0.4, 0.6, 0.8, 1].forEach(level => {
            svg.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 0)
                .style("fill", "none")
                .style("stroke", "lightgray")
                .style("stroke-dasharray", "2,2")
                .transition()
                .duration(500)
                .attr("r", radius * level);
        });
    
        const radarLine = d3.lineRadial()
            .radius(d => d * radius)
            .angle((d, i) => angleSlice * i);
    
        
        indices.forEach((index, i) => {
            const countryData = filtered[index];
            const dataPoints = metrics.map(metric => countryData[metric] / maxValues[metric]);
            const color = d3.schemeCategory10[index];
            const closedDataPoints = [...dataPoints, dataPoints[0]];
    
            const path = svg.append("path")
                .datum(closedDataPoints)
                .attr("d", radarLine)
                .style("fill", color)
                .style("fill-opacity", 0.1)
                .style("stroke", color)
                .style("stroke-width", 2)
                .style("stroke-dasharray", function() {
                    return this.getTotalLength();
                })
                .style("stroke-dashoffset", function() {
                    return this.getTotalLength();
                });
    
            path.transition()
                .delay(i * 500)
                .duration(1000)
                .style("stroke-dashoffset", 0);
    
            
            metrics.forEach((metric, j) => {
                const value = countryData[metric] / maxValues[metric];
                const angle = angleSlice * j - Math.PI / 2;
                const x = value * radius * Math.cos(angle);
                const y = value * radius * Math.sin(angle);
    
                svg.append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", 0)
                    .style("fill", color)
                    .style("stroke", "white")
                    .transition()
                    .delay(i * 500 + 1000)
                    .duration(500)
                    .attr("cx", x)
                    .attr("cy", y)
                    .attr("r", 4);
    
                svg.append("text")
                    .attr("x", 0)
                    .attr("y", 0)
                    .style("opacity", 0)
                    .style("text-anchor", "middle")
                    .text(countryData[metric].toFixed(2))
                    .transition()
                    .delay(i * 500 + 1500)
                    .duration(500)
                    .attr("x", x * 1.1)
                    .attr("y", y * 1.1)
                    .style("opacity", 1);
            });
    
            
            const domScale = d3.scaleLinear()
                .domain([0, radius])
                .range([0, 200]);
    
            const dominatedRadius = domScale(dominatedscore[index]);
            svg.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 0)
                .style("fill", "none")
                .style("stroke", color)
                .style("stroke-width", 2)
                .style("stroke-dasharray", "5,5")
                .transition()
                .delay(i * 500 + 2000)
                .duration(1000)
                .attr("r", dominatedRadius);
        });
    
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${radius + margin},${-radius + margin})`);
    
        indices.forEach((index, i) => {
            const legendRow = legend.append("g")
                .attr("transform", `translate(0, ${i * 20})`)
                .style("opacity", 0);
    
            legendRow.append("rect")
                .attr("width", 15)
                .attr("height", 15)
                .style("fill", d3.schemeCategory10[index]);
    
            legendRow.append("text")
                .attr("x", 20)
                .attr("y", 12)
                .text(filtered[index].country);
    
            legendRow.transition()
                .delay(500 * i)
                .duration(500)
                .style("opacity", 1);
        });
    }
    
    formatMetricLabel(metric) {
        
        const abbreviations = {
            'happiness_score': 'hs',
            'gdp_per_capita': 'gp',
            'social_support': 'ss',
            'healthy_life_expectancy': 'hl',
            'freedom_to_make_life_choices': 'ft',
            'generosity': 'g',
            'perceptions_of_corruption': 'po'
        };
        return abbreviations[metric] || metric.substring(0, 2);
    }

    handleSync(selection) {
        if (!selection || selection.length === 0) {
            this.clearSelection();
        }

        const filtered = this.currentData.filter(d => selection.includes(d.country));
        
        if (filtered.length > 0) {
            
            const dominatedScores = filtered.map((_, i) => {
                
                return this.currentData.filter(d2 => 
                    filtered[i] !== d2 && this.dominates(filtered[i], d2)
                ).length;
            });
            
            this.update({
                filtered: filtered,
                dominatedScores: dominatedScores
            });
        }
    }
}
