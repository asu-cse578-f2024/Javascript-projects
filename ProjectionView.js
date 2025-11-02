export class ProjectionView {

    constructor(selector, manager) {
        this.container = d3.select(selector);
        this.manager = manager;
        this.setupView();
    }

    setupView() {
        
        this.svg = this.container;
        this.tooltip = d3.select('#projection-view-tooltip');
        this.dataset = null;
        this.numericAttributes = null;
        this.skylineDataPoints = null;
        this.skylineNumericData = null;
        this.skylineValueRanges = null;
        this.dominationScores = null;
        this.activeSkylineIndices = [];
        this.projectionCoordinates = null;
        this.selectedPointIndex = undefined;
    }

    update(data) {
        this.dataset = data;
        if (data) {
            this.numericAttributes = Object.keys(data[0])
                .filter(attr => attr !== 'year' && attr !== 'country' && !isNaN(+data[0][attr]));
            this.calculateSkylinePoints();
            this.calculateTsneDist();
        }
    }

    async calculateSkylinePoints() {
        
        this.skylineDataPoints = this.dataset.filter(
            candidatePoint => !this.dataset.filter(otherPoint => otherPoint != candidatePoint)
                .some(dominatingPoint => this.dominates(dominatingPoint, candidatePoint))
        );

        let firstColName = Object.keys(this.dataset[0])[0];
        this.PointNameColumnIndex = isNaN(this.dataset[0][firstColName]) ? 0 : 1;

        
        this.skylineNumericData = this.skylineDataPoints.map(data => {
            const numericData = {};
            this.numericAttributes.forEach(attribute => {
                numericData[attribute] = +data[attribute];
            });
            return numericData;
        });

        
        this.skylineValueRanges = {};
        this.numericAttributes.forEach(column => {
            const values = this.skylineDataPoints.map(data => +data[column]);
            const min = Math.min(...values);
            const max = Math.max(...values);
            this.skylineValueRanges[column] = {
                min,
                max,
                percentage: function(value) {
                    return (value - this.min) / (this.max - this.min);
                }
            };
        });

        
        const dominationScores = this.skylineDataPoints.map(data1 => {
            const dominatedPoints = this.dataset.filter(
                data2 => data1 !== data2 && this.dominates(data1, data2)
            );
            return { score: dominatedPoints.length, dominatedPoints };
        });

        this.dominationScores = {
            min: Math.min(...dominationScores.map(d => d.score)),
            max: Math.max(...dominationScores.map(d => d.score)),
            scores: dominationScores.map(d => d.score),
            dominatedPoints: dominationScores.map(d => d.dominatedPoints),
            percentage: function(index) {
                return (this.scores[index] - this.min) / (this.max - this.min);
            }
        };
    }

    calculateTsneDist() {
        const { width, height } = this.svg.node().getBoundingClientRect();
        const margin = {top: 15,right: 15,bottom: 15,left: 15};
        
        var opt = {}
        opt.epsilon = 10; 
        opt.perplexity = 30; 
        opt.dim = 2; 

        const model = new tsnejs.tSNE(opt);

        const dist = this.skylineNumericData.map(data1 =>
            this.skylineNumericData.map(data2 =>
                Math.sqrt(
                    Object.keys(data1).reduce((sum, key) => sum + Math.pow(data1[key] - data2[key], 2), 0)
                )
            )
        );

        model.initDataDist(dist);

        const dataForceSimulation = this.skylineNumericData;
        
        d3.forceSimulation(dataForceSimulation.map(d => ({ 
            x: width / 2, 
            y: height / 2, 
            ...d 
        })))
        .alpha(1)
        .force('tsne', (alpha) => {
            for(var k = 0; k < 5; k++){
                model.step();
            }
            this.projectionCoordinates = model.getSolution().map(pos => {
                
                return pos.map(p => isNaN(p) ? 0 : p);
            });
            const scaleX = d3.scaleLinear()
                .range([margin.left, width - margin.right])
                .domain(d3.extent(this.projectionCoordinates.map(pos => pos[0])));
        
            const scaleY = d3.scaleLinear()
                .range([margin.top, height - margin.bottom])
                .domain(d3.extent(this.projectionCoordinates.map(pos => pos[1])));

            dataForceSimulation.forEach((d, i) => {
                if (this.projectionCoordinates[i]) {  
                    d.x += alpha * (scaleX(this.projectionCoordinates[i][0]) - d.x);
                    d.y += alpha * (scaleY(this.projectionCoordinates[i][1]) - d.y);
                }
            });
        })
        .force('collide', d3.forceCollide().radius(d => d.r))
        .on('tick', () => this.drawProjectionView())
        .on('end', () => this.drawProjectionView(true, true));

        model.step();
        this.projectionCoordinates = model.getSolution();
        this.drawProjectionView(false);
    }

    drawProjectionView(update = true, end = false) {
        if (!this.projectionCoordinates) return;

        const { width, height } = this.svg.node().getBoundingClientRect();
        const margin = {top: 15,right: 15,bottom: 15,left: 15};
        const scaleX = d3.scaleLinear()
            .range([margin.left, width - margin.right])
            .domain(d3.extent(this.projectionCoordinates.map(pos => pos[0])));
        
        const scaleY = d3.scaleLinear()
            .range([margin.top, height - margin.bottom])
            .domain(d3.extent(this.projectionCoordinates.map(pos => pos[1])))

        const colors = {
            dominationScore: d3.interpolateRgb('#fdf7ed', '#91191c'),
            attributeBase: '#9970ab',
            differenceBest: '#2662a2',
            differenceWorst: '#a91f2d',
            differenceMiddle: '#f7f8f8'
        };

        if (!update) {
            this.svg.selectAll('*').remove();

            const groups = this.svg
                .selectAll('g')
                .data(this.skylineDataPoints.map((data, i) => ({
                    ...data,
                    position: this.projectionCoordinates[i]
                })))
                .enter()
                .append('g')
                .attr('data-index', (_, i) => i);

            
            groups
                .append('circle')
                .attr('r', 4)
                .attr('cx', 0)
                .attr('cy', 0)
                .style('fill', (_, i) => 
                    colors.dominationScore(this.dominationScores.percentage(i))
                );

            
            const self = this; 
            groups
                .selectAll('path')
                .data(d3.pie()(this.numericAttributes.map(() => 1)))
                .enter()
                .append('path')
                .style('fill', function(_, i) {
                    const index = +d3.select(this.parentNode).attr('data-index');
                    return self.getGlyphColor(index, i);
                })
                .attr('d', 
                    d3.arc()
                        .padAngle(0.04)
                        .innerRadius(4.5)
                        .outerRadius(function(_, i) {
                            const column = self.numericAttributes[i];
                            const index = +d3.select(this.parentNode).attr('data-index');
                            const value = self.skylineNumericData[index][column];
                            const minMax = self.skylineValueRanges[column];
                            return 4.5 + 12 * minMax.percentage(value);
                        })
                );
        }

        const self = this;
        this.svg.selectAll('g')
            .attr('transform', function() {
                const index = +d3.select(this).attr('data-index');
                if (!self.projectionCoordinates[index]) {
                    console.warn(`No position found for index ${index}`);
                    return 'translate(0,0)';
                }
                const pos = self.projectionCoordinates[index];
                if (!Array.isArray(pos)) {
                    console.warn(`Invalid position for index ${index}:`, pos);
                    return 'translate(0,0)';
                }
                const x = scaleX(pos[0]);
                const y = scaleY(pos[1]);
                return `translate(${x},${y})`;
            });
    
        if (end) {
            this.setupInteractions();
        }
    }

    getGlyphColor(index, i) {
        const colors = {
            base: '#9970ab',
            best: '#2662a2',
            worst: '#a91f2d',
            middle: '#f7f8f8'
        };
    
        if (!this.selectedPointIndex || index === this.selectedPointIndex) {
            return colors.base;
        }
    
        const column = this.numericAttributes[i];
        const value = this.skylineNumericData[index][column];
        const valueSelected = this.skylineNumericData[this.selectedPointIndex][column];
        const { percentage } = this.skylineValueRanges[column];
        const valuePct = percentage(value);
        const selectedPct = percentage(valueSelected);
    
        if (value < valueSelected) {
            const t = valuePct / selectedPct;
            return calculateColor(colors.differenceWorst, colors.differenceMiddle, t);
        } else {
            const t = (valuePct - selectedPct) / (1 - selectedPct);
            return calculateColor(colors.differenceMiddle, colors.differenceBest, t);
        }
    }
    
    setupInteractions() {
        this.svg
            .selectAll('g')
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                const index = +d3.select(event.currentTarget).attr('data-index');
                const x = event.currentTarget.transform.baseVal[0].matrix.e;
                const y = event.currentTarget.transform.baseVal[0].matrix.f;

                d3.select(event.currentTarget)
                    .attr('transform', `translate(${x}, ${y}) scale(4)`);

                this.tooltip
                    .selectAll('*')
                    .remove();

                this.tooltip
                    .append('div')
                    .text(`${Object.keys(d)[this.PointNameColumnIndex]}: ${d[Object.keys(d)[this.PointNameColumnIndex]]}`);

                this.tooltip
                    .append('div')
                    .text(`Domination score: ${this.dominationScores.scores[index]}`);

                this.tooltip
                    .style('display', 'block');

                const tooltipBox = this.tooltip.node().getBoundingClientRect();
                this.tooltip
                    .style('left', `${x - tooltipBox.width / 2}px`)
                    .style('top', `${y - tooltipBox.height - 25}px`);
            })
            .on('mouseout', (event) => {
                const index = +d3.select(event.currentTarget).attr('data-index');
                const x = event.currentTarget.transform.baseVal[0].matrix.e;
                const y = event.currentTarget.transform.baseVal[0].matrix.f;

                d3.select(event.currentTarget)
                    .attr('transform', `translate(${x},${y}) scale(1)`);

                this.tooltip.style('display', 'none');
            })
            .on('click', (event, d) => {
                const index = +d3.select(event.currentTarget).attr('data-index');
                this.selectSkylinePoint(index);
            });
    }

    calculateColor(color1, color2, t) {
        const c1 = d3.color(color1);
        const c2 = d3.color(color2);
    
        return d3.rgb(
            Math.round(c1.r + (c2.r - c1.r) * t),
            Math.round(c1.g + (c2.g - c1.g) * t),
            Math.round(c1.b + (c2.b - c1.b) * t)
        );
    }

    dominates(point1, point2) {
        if (!this.numericAttributes || this.numericAttributes.length === 0) {
            throw new Error("No numeric attributes specified for comparison.");
        }

        const allBetterOrEqual = this.numericAttributes.every(
            column => parseFloat(point1[column]) >= parseFloat(point2[column])
        );

        const strictlyBetter = this.numericAttributes.some(
            column => parseFloat(point1[column]) > parseFloat(point2[column])
        );

        return allBetterOrEqual && strictlyBetter;
    }

    selectSkylinePoint(skylinePointIndex) {
        
        this.activeSkylineIndices = [];
        const currentSelection = Array.from(this.manager.state.selectedCountries);
        currentSelection.forEach(countryName => {
            const index = this.skylineDataPoints.findIndex(d => d.country === countryName);
            if (index !== -1) {
                this.activeSkylineIndices.push(index);
            }
        });
    
        
        const index = this.activeSkylineIndices.indexOf(skylinePointIndex);
        if (index > -1) {
            this.activeSkylineIndices.splice(index, 1);
            const countryToRemove = this.skylineDataPoints[skylinePointIndex].country;
            this.manager.state.selectedCountries.delete(countryToRemove);
        } else {
            if (this.activeSkylineIndices.length >= 4) return;
            this.activeSkylineIndices.push(skylinePointIndex);
            const countryToAdd = this.skylineDataPoints[skylinePointIndex].country;
            this.manager.state.selectedCountries.add(countryToAdd);
        }
    
        
        const selectedCountries = this.activeSkylineIndices.map(i => 
            this.skylineDataPoints[i]
        );
    
        const dominationScores = this.activeSkylineIndices.map(i => 
            this.dominationScores.scores[i]
        );
    
        if (selectedCountries.length > 0) {
            this.manager.views.comparison.update({
                filtered: selectedCountries,
                dominatedScores: dominationScores
            });
        } else {
            
            this.manager.views.comparison.update({
                filtered: [],
                dominatedScores: []
            });
        }
    
        
        const countryNames = Array.from(this.manager.state.selectedCountries);
        this.manager.dispatch.call("viewSync", this, countryNames);
    }

    getNumericalAttributes(data) {
        const attributeNames = Object.keys(data[0]);
        return attributeNames.filter(attribute => {
            const value = data[0][attribute];
            return attribute !== 'year' && 
                attribute !== 'country' && 
                !isNaN(+value);
        });
    }

    handleSync(selection) {
        if (!selection || !this.skylineDataPoints) return;

        this.activeSkylineIndices = [];
        selection.forEach(countryName => {
            const index = this.skylineDataPoints.findIndex(d => d.country === countryName);
            if (index !== -1) {
                this.activeSkylineIndices.push(index);
            }
        });

        this.svg.selectAll('g')
            .each(function(d, i) {
                const isSelected = selection.includes(d.country);
                const element = d3.select(this);

                element.select('circle')
                    .transition()
                    .duration(300)
                    .attr('r', isSelected ? 6 : 4)
                    .style('stroke-width', isSelected ? 2 : 1);
                
                element.selectAll('path')
                    .transition()
                    .duration(300)
                    .style('opacity', isSelected ? 1 : 0.5);
            });
    }
}