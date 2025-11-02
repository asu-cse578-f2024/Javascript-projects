export class MapView {
    constructor(selector, manager) {
        this.container = d3.select(selector).style('position', 'relative');
        this.manager = manager;
        this.width = this.container.node().getBoundingClientRect().width;
        this.height = this.container.node().getBoundingClientRect().height;
        this.setupView();
    }

    async setupView() {
        
        this.svg = this.container
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);
    
        
        this.mapGroup = this.svg.append('g')
            .attr('class', 'map-group');
    
        
        this.projection = d3.geoMercator()
            .scale(this.width / 2 / Math.PI)
            .translate([this.width / 2, this.height / 1.5]);
    
        this.geoPath = d3.geoPath().projection(this.projection);
    
        
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                this.mapGroup.attr('transform', event.transform);
            });
    
        this.svg.call(zoom);
    
        
        const zoomControls = this.container
            .append('div')
            .attr('class', 'zoom-controls')
            .style('position', 'absolute')
            .style('top', '10px')
            .style('right', '10px')
            .style('z-index', '1000')
            .style('display', 'flex')
            .style('flex-direction', 'column');
    
        
        zoomControls.append('button')
            .attr('class', 'zoom-in')
            .html('&plus;')
            .style('width', '30px')
            .style('height', '30px')
            .on('click', () => {
                this.svg.transition()
                    .duration(750)
                    .call(zoom.scaleBy, 1.5);
            });
    
        zoomControls.append('button')
            .attr('class', 'zoom-out')
            .html('&minus;')
            .style('width', '30px')
            .style('height', '30px')
            .on('click', () => {
                this.svg.transition()
                    .duration(750)
                    .call(zoom.scaleBy, 0.75);
            });
    
        zoomControls.append('button')
            .attr('class', 'zoom-reset')
            .html('↺')
            .style('width', '30px')
            .style('height', '30px')
            .on('click', () => {
                this.svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity);
            });
    
        
        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'map-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('background', 'white')
            .style('padding', '10px')
            .style('border', '1px solid #ccc')
            .style('border-radius', '5px');
    
        
        await this.loadWorldMap();
        
        
        this.createLegend();
        
        
        this.setupEventListeners();
    }

    async loadWorldMap() {
        try {
            const worldData = await d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
            
            this.mapGroup.selectAll('path')
                .data(worldData.features)
                .join('path')
                .attr('d', this.geoPath)
                .attr('class', 'country')
                .attr('fill', '#eee')
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5)
                .style('pointer-events', 'auto');
                
        } catch (error) {
            console.error('Error loading world map:', error);
        }
    }

    setupEventListeners() {
        this.mapGroup.selectAll('.country')
            .on('mouseover', (event, d) => this.handleMouseOver(event, d))
            .on('mouseout', () => this.handleMouseOut())
            .on('click', (event, d) => this.handleClick(event, d));
    }

    handleMouseOver(event, d) {
        const countryData = this.currentData?.find(h => 
            h.country === d.properties.name
        );

        if (countryData) {
            this.tooltip
                .transition()
                .duration(200)
                .style('opacity', 0.9);

            this.tooltip.html(`
                <strong>${d.properties.name}</strong><br/>
                Happiness Score: ${countryData.happiness_score.toFixed(2)}<br/>
                GDP per capita: ${countryData.gdp_per_capita.toFixed(2)}<br/>
                Social support: ${countryData.social_support.toFixed(2)}
            `)
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY - 28}px`);

            d3.select(event.currentTarget)
                .transition()
                .duration(200)
                .attr('stroke-width', '2px')
                .attr('stroke', '#000');
        }
    }

    handleMouseOut() {
        this.tooltip
            .transition()
            .duration(500)
            .style('opacity', 0);

        this.mapGroup.selectAll('.country')
            .transition()
            .duration(200)
            .attr('stroke-width', '0.5px')
            .attr('stroke', '#fff');
    }

    handleClick(event, d) {
        const countryName = d.properties.name;
        const countryData = this.currentData.find(h => h.country === countryName);
        
        if (countryData) {
            const isSelected = this.manager.state.selectedCountries.has(countryName);
            
            if (isSelected) {
                this.manager.state.selectedCountries.delete(countryName);
            } else {
                if (this.manager.state.selectedCountries.size < 4) {
                    this.manager.state.selectedCountries.add(countryName);
                }
            }
    
            
            const selectedCountriesData = Array.from(this.manager.state.selectedCountries)
                .map(name => this.currentData.find(d => d.country === name))
                .filter(d => d);
    
            
            if (selectedCountriesData.length > 0) {
                this.manager.views.comparison.update({
                    filtered: selectedCountriesData,
                    dominatedScores: selectedCountriesData.map(d => 
                        this.currentData.filter(d2 => 
                            d !== d2 && this.manager.views.projection.dominates(d, d2)
                        ).length
                    )
                });
            } else {
                
                this.manager.views.comparison.update({
                    filtered: [],
                    dominatedScores: []
                });
            }
    
            
            const selectedCountries = Array.from(this.manager.state.selectedCountries);
            this.manager.dispatch.call("viewSync", this, selectedCountries);
        }
    }
    update(data) {
        this.currentData = data;
        
        if (data && data.length > 0) {
            
            const scores = data.map(d => d.happiness_score).filter(score => !isNaN(score));
            const minScore = d3.min(scores);
            const maxScore = d3.max(scores);
            
            
            this.manager.state.colorScale = d3.scaleSequential(d3.interpolateBlues)
                .domain([minScore * 0.9, maxScore * 1.1]); 
        }
        
        
        this.mapGroup.selectAll('.country')
            .transition()
            .duration(this.manager.transitions.map)
            .attr('fill', d => {
                const countryData = data.find(h => h.country === d.properties.name);
                return countryData ? this.manager.state.colorScale(countryData.happiness_score) : '#eee';
            });
    
        
        this.mapGroup.selectAll('.country')
            .classed('selected', d => 
                this.manager.state.selectedCountries.has(d.properties.name)
            );
    }

    handleSync(selection) {
        if (!selection) return;
        
        
        this.mapGroup.selectAll('.country')
            .classed('selected', false)
            .style('stroke-width', '0.5px')
            .style('stroke', '#fff')
            .style('fill-opacity', 1);
    
        
        this.mapGroup.selectAll('.country')
            .filter(d => selection.includes(d.properties.name))
            .classed('selected', true)
            .style('stroke-width', '3px')
            .style('stroke', '#000')
            .style('fill-opacity', 0.8)
            .raise(); 
    }

    resize() {
        
        this.width = this.container.node().getBoundingClientRect().width;
        this.height = this.container.node().getBoundingClientRect().height;

        
        this.svg
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

        
        this.projection
            .scale(this.width / 2 / Math.PI)
            .translate([this.width / 2, this.height / 1.5]);

        
        this.mapGroup.selectAll('.country')
            .transition()
            .duration(this.manager.transitions.map)
            .attr('d', this.geoPath);

        
        this.svg.select('.legend')
            .transition()
            .duration(this.manager.transitions.map)
            .attr('transform', `translate(20, ${this.height - 40})`);
    }

    updateColors(data) {
        
        const colorScale = d3.scaleSequential(d3.interpolateBlues)
            .domain([2, 8]); 

        
        this.mapGroup.selectAll('.country')
            .transition()
            .duration(750)
            .attr('fill', d => {
                const countryData = data.find(h => h.country === d.properties.name);
                return countryData ? colorScale(countryData.happiness_score) : '#eee';
            });
    }

    createLegend() {
        const legendWidth = 200;
        const legendHeight = 10;
        
        const defs = this.svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'happiness-gradient')
            .attr('x1', '0%')
            .attr('x2', '100%');
            
        gradient.selectAll('stop')
            .data(d3.range(0, 1.1, 0.1))
            .enter()
            .append('stop')
            .attr('offset', d => `${d * 100}%`)
            .attr('stop-color', d => d3.interpolateBlues(d));
            
        const legend = this.svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(20,${this.height - 40})`);
            
        legend.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#happiness-gradient)');
            
        legend.append('text')
            .attr('x', 0)
            .attr('y', 25)
            .text('Less Happy');
            
        legend.append('text')
            .attr('x', legendWidth)
            .attr('y', 25)
            .attr('text-anchor', 'end')
            .text('More Happy');
    }
}