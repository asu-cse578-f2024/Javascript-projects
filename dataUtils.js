export const dataUtils = {
    processHappinessData(data) {
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
};