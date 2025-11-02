export class HappinessVisManager {
    constructor() {
        this.state = {
            currentYear: 2015,
            selectedCountries: new Set(),
            transitionStates: new Map(),
            data: null,
            filteredData: null,
            colorScale: d3.scaleSequential(d3.interpolateBlues).domain([2, 8]),
            sortConfig: {
                column: 'happiness_score',
                direction: 'desc'
            }
        };

        this.dispatch = d3.dispatch(
            "yearChange",
            "countrySelect",
            "dataUpdate",
            "sortChange",
            "filterChange",
            "viewSync",
            "transitionStart",
            "transitionEnd",
            "selectionComplete",
            "selectionClear" 
        );

        this.transitions = {
            map: 750,
            projection: 500,
            comparison: 400,
            table: 300
        };

        this.views = {};
        this.updateQueue = [];
        this.isUpdating = false;
    }

    async initialize(views) {
        this.views = views;
        await this.loadData();
        this.setupEventListeners();
        this.initializeViews();
    }

    async loadData(selectedValue = null) {
        try {
            if (!selectedValue) {
                this.state.data = [];
                this.state.filteredData = [];
                this.clearAttributeTable();
                console.warn("No dataset selected. Initialize with an empty state.");
                return;
            }

            const response = await d3.csv(selectedValue);
            if (!response || !response.length) {
                throw new Error('No data loaded');
            }
    
            this.state.data = this.processData(response);
            this.filterDataByYear();
    
            if (this.state.filteredData?.length) {
                this.buildAttributeTable();
                this.dispatch.call("dataUpdate", this, this.state.filteredData);
            }
        } catch (error) {
            console.error("Error loading data:", error);
            throw error;
        }
    }

    buildAttributeTable() {
        const attributeTable = d3.select('#attribute-table');
        
        attributeTable.selectAll('*').remove();
        
        const header = attributeTable
            .append('thead')
            .append('tr');
            
        header.selectAll('th')
            .data(['Attribute Name', 'Attribute Type'])
            .enter()
            .append('th')
            .text(d => d);

        const tbody = attributeTable.append('tbody');
        const rows = tbody.selectAll('tr')
            .data(Object.keys(this.state.filteredData[0])?.filter(attr => attr !== 'year'))
            .enter()
            .append('tr');

        rows.selectAll('td')
            .data(attribute => [
                attribute,
                this.isNumericAttribute(attribute) ? 
                    `num: ${this.getMinMax(attribute)}` : 
                    'nominal'
            ])
            .enter()
            .append('td')
            .text(d => d);
    }


    isNumericAttribute(attribute) {
        return typeof this.state.filteredData[0][attribute] === 'number';
    }

    getMinMax(attribute) {
        const values = this.state.filteredData.map(d => d[attribute]);
        const min = d3.min(values);
        const max = d3.max(values);
        return `${min?.toFixed(2) ?? 'N/A'} ~ ${max?.toFixed(2) ?? 'N/A'}`;
    }


    processData(data) {
        return data.map(d => ({
            country: d.country,
            happiness_score: +d.happiness_score || 0,
            gdp_per_capita: +d.gdp_per_capita || 0,
            social_support: +d.social_support || 0,
            healthy_life_expectancy: +d.healthy_life_expectancy || 0,
            freedom_to_make_life_choices: +d.freedom_to_make_life_choices || 0,
            generosity: +d.generosity || 0,
            perceptions_of_corruption: +d.perceptions_of_corruption || 0,
            year: +d.year
        }));
    }

    filterDataByYear() {
        this.state.filteredData = this.state.data.filter(
            d => d.year === this.state.currentYear
        );
    }

    initializeViews() {
        const viewOrder = ['map', 'projection', 'comparison', 'tabular'];
        let delay = 0;

        viewOrder.forEach(viewName => {
            if (this.views[viewName]) {
                setTimeout(() => {
                    this.updateView(viewName);
                }, delay);
                delay += this.transitions.stagger;
            }
        });
    }

    updateView(viewName, data = this.state.filteredData) {
        const view = this.views[viewName];
        if (!view || !data) return;

        this.state.transitionStates.set(viewName, true);
        this.dispatch.call("transitionStart", this, viewName);

        try {
            view.update(data);
        } catch (error) {
            console.error(`Error updating ${viewName}:`, error);
            this.state.transitionStates.set(viewName, false);
        }

        setTimeout(() => {
            this.state.transitionStates.set(viewName, false);
            this.dispatch.call("transitionEnd", this, viewName);
            this.checkAllTransitionsComplete();
        }, this.transitions[viewName] || 500);
    }

    checkAllTransitionsComplete() {
        const allComplete = Array.from(this.state.transitionStates.values())
            .every(state => !state);

        if (allComplete) {
            this.dispatch.call("selectionComplete", this);
            this.processUpdateQueue();
        }
    }

    queueUpdate(update) {
        this.updateQueue.push(update);
        if (!this.isUpdating) {
            this.processUpdateQueue();
        }
    }

    async processUpdateQueue() {
        if (this.isUpdating || this.updateQueue.length === 0) return;

        this.isUpdating = true;
        const update = this.updateQueue.shift();

        try {
            await this.performUpdate(update);
        } catch (error) {
            console.error("Error processing update:", error);
        }

        this.isUpdating = false;
        if (this.updateQueue.length > 0) {
            this.processUpdateQueue();
        }
    }

    async performUpdate(update) {
        switch (update.type) {
            case 'year':
                await this.handleYearChange(update.value);
                break;
            case 'selection':
                await this.handleCountrySelection(update.value);
                break;
            case 'dataset':
                await this.handleDatasetChange(update.value);
                break;
            default:
                console.warn('Unknown update type:', update.type);
        }
    }

    clearAllSelections() {
        this.state.selectedCountries.clear();
        this.dispatch.call("selectionClear", this);
        
        Object.values(this.views).forEach(view => {
            if (view.clearSelection) {
                view.clearSelection();
            }
        });
    }

    clearAllSelections() {
        this.state.selectedCountries.clear();
        this.dispatch.call("selectionClear", this);

        Object.values(this.views).forEach(view => {
            if (view.clearSelection) {
                view.clearSelection();
            }
        });
    }

    handleCountrySelection(country) {
        const wasSelected = this.state.selectedCountries.has(country);
        
        if (wasSelected) {
            this.state.selectedCountries.delete(country);
        } else {
            if (this.state.selectedCountries.size >= 4) {
                this.clearAllSelections();
            }
            this.state.selectedCountries.add(country);
        }

        const selectedCountries = Array.from(this.state.selectedCountries);

        if (selectedCountries.length === 0) {
            if (this.views.comparison) {
                this.views.comparison.update({ filtered: [], dominatedScores: [] });
            }
        }

        Object.entries(this.views).forEach(([viewName, view]) => {
            if (typeof view.handleSync === 'function') {
                view.handleSync(selectedCountries);
            }
        });

        if (selectedCountries.length > 0 && this.views.comparison) {
            const selectedData = this.state.filteredData.filter(d => 
                selectedCountries.includes(d.country)
            );
            
            const dominatedScores = selectedData.map(d1 => 
                this.state.filteredData.filter(d2 => 
                    d1 !== d2 && this.views.projection.dominates(d1, d2)
                ).length
            );

            this.views.comparison.update({
                filtered: selectedData,
                dominatedScores: dominatedScores
            });
        }
    }

    handleYearChange(year) {
        this.state.currentYear = year;
        this.clearAllSelections(); 
        this.filterDataByYear();
        this.buildAttributeTable();  
        this.updateAllViews();
        
        d3.select('#year-label').text(year);
    }

    updateAllViews() {
        if (!this.state.filteredData) return;

        
        if (this.views.map) {
            this.views.map.update(this.state.filteredData);
        }
        if (this.views.projection) {
            this.views.projection.update(this.state.filteredData);
        }
        
        
        if (this.views.tabular) {
            this.views.tabular.update(this.state.filteredData);
        }

        
        if (this.views.comparison && this.state.selectedCountries.size > 0) {
            const selectedData = this.state.filteredData.filter(d => 
                this.state.selectedCountries.has(d.country)
            );
            
            const dominatedScores = selectedData.map(d1 => 
                this.state.filteredData.filter(d2 => 
                    d1 !== d2 && this.views.projection.dominates(d1, d2)
                ).length
            );

            this.views.comparison.update({
                filtered: selectedData,
                dominatedScores: dominatedScores
            });
        }
    }

    handleCountrySelection(country) {
        if (!country) return;

        const wasSelected = this.state.selectedCountries.has(country);
        
        if (wasSelected) {
            this.state.selectedCountries.delete(country);
        } else if (this.state.selectedCountries.size < 4) {
            this.state.selectedCountries.add(country);
        } else {
            console.warn('Maximum selection limit (4) reached');
            return;
        }

        const selectedCountries = Array.from(this.state.selectedCountries);
        
        
        this.dispatch.call("countrySelect", this, selectedCountries);
        this.dispatch.call("viewSync", this, selectedCountries);

        
        Object.entries(this.views).forEach(([name, view]) => {
            if (typeof view.handleSync === 'function') {
                view.handleSync(selectedCountries);
            }
        });
    }

    async handleDatasetChange(datasetUrl) {
        try {
            const response = await d3.csv(datasetUrl);
            this.state.data = this.processData(response);
            this.filterDataByYear();
            
            
            this.buildAttributeTable();
            
            
            let delay = 0;
            ['map', 'projection', 'comparison', 'tabular'].forEach(viewName => {
                setTimeout(() => {
                    this.updateView(viewName);
                }, delay);
                delay += this.transitions.stagger;
            });

            this.dispatch.call("dataUpdate", this, this.state.filteredData);
        } catch (error) {
            console.error("Error loading dataset:", error);
            throw error;
        }
    }


    setupEventListeners() {
        
        this.dispatch.on("countrySelect.limit", (countries) => {
            if (countries.length >= 4) {
                d3.select('body')
                    .append('div')
                    .attr('class', 'selection-limit-warning')
                    .text('Maximum selection limit (4) reached')
                    .style('opacity', 0)
                    .transition()
                    .duration(300)
                    .style('opacity', 1)
                    .transition()
                    .delay(2000)
                    .duration(300)
                    .style('opacity', 0)
                    .remove();
            }
        });
        
        window.addEventListener('resize', this.debounce(() => {
            Object.values(this.views).forEach(view => {
                if (typeof view.resize === 'function') {
                    view.resize();
                }
            });
        }, 250));
        
        d3.select('#year-slider').on('input', (event) => {
            this.queueUpdate({
                type: 'year',
                value: +event.target.value
            });
        });
        
        this.dispatch.on("sortChange", (column) => {
            this.state.sortConfig.column = column;
            this.state.sortConfig.direction = 
                this.state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
            this.views.tabular?.update(this.state.filteredData);
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    clearAttributeTable() {
        const attributeTable = d3.select('#attribute-table');
        attributeTable.selectAll('*').remove();
        attributeTable
            .append('thead')
            .append('tr')
            .selectAll('th')
            .data(['Attribute Name', 'Attribute Type'])
            .enter()
            .append('th')
            .text(d => d);
    }
    
}