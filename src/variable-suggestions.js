// Variable Suggestions
// This file provides functionality for suggesting published variables to replace literal values
import { variablesStore } from './variables-utils';
import { getPropertyExpectedVariableType } from './property-mapping';
import { figmaColorToRgb255, getColorDifference, getNumberDifference, calculateColorConfidence, calculateNumberConfidence, COLOR_PROXIMITY_THRESHOLD, NUMBER_PROXIMITY_THRESHOLD, compareColors, compareNumbers } from './value-comparison';
/**
 * Generates suggestions for a property based on its current value
 * @param propertyName The Figma property name (e.g. 'fills', 'fontSize')
 * @param currentValue The current value of the property
 * @returns Array of variable suggestions, sorted by confidence
 */
export function generateVariableSuggestions(propertyName, currentValue) {
    const suggestions = [];
    // Get the expected variable type for this property
    const expectedType = getPropertyExpectedVariableType(propertyName);
    if (!expectedType) {
        console.log(`No variable type mapping for property: ${propertyName}`);
        return [];
    }
    // Get all published variables of this type
    const relevantVariables = variablesStore.getVariablesByType(expectedType);
    if (relevantVariables.length === 0) {
        console.log(`No ${expectedType} variables available for suggestions`);
        return [];
    }
    // Step 1: Try to find an exact match
    const exactMatch = findExactMatch(expectedType, currentValue, relevantVariables);
    if (exactMatch) {
        suggestions.push({
            type: 'PUBLISHED_DIRECT',
            propertyName,
            suggestedVariable: exactMatch,
            confidence: 1.0
        });
    }
    // Step 2: If no exact match, try proximity match for supported types
    if (!exactMatch && (expectedType === 'COLOR' || expectedType === 'NUMBER')) {
        const closestMatch = findClosestMatch(expectedType, currentValue, relevantVariables);
        if (closestMatch) {
            suggestions.push(closestMatch);
        }
    }
    return suggestions;
}
/**
 * Find a variable that exactly matches the given value
 */
function findExactMatch(type, value, variables) {
    if (type === 'COLOR') {
        // For colors, we need to use special comparison
        if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
            for (const variable of variables) {
                const varValue = variable.value;
                if (compareColors(value, varValue)) {
                    return variable;
                }
            }
        }
    }
    else if (type === 'NUMBER') {
        // For numbers, use numeric comparison
        if (typeof value === 'number') {
            for (const variable of variables) {
                const varValue = variable.value;
                if (typeof varValue === 'number' && compareNumbers(value, varValue)) {
                    return variable;
                }
            }
        }
    }
    else {
        // For strings and booleans, just use strict equality
        for (const variable of variables) {
            if (variable.value === value) {
                return variable;
            }
        }
    }
    return null;
}
/**
 * Find the closest variable by proximity for the given value
 * Only applicable for COLOR and NUMBER types
 */
function findClosestMatch(type, value, variables) {
    if (type === 'COLOR') {
        return findClosestColorVariable(value, variables);
    }
    else if (type === 'NUMBER') {
        return findClosestNumberVariable(value, variables);
    }
    return null;
}
/**
 * Find the closest color variable to the given color
 */
function findClosestColorVariable(color, colorVariables) {
    if (!color || typeof color.r !== 'number' ||
        typeof color.g !== 'number' || typeof color.b !== 'number') {
        return null;
    }
    let bestSuggestion = null;
    let minDistance = COLOR_PROXIMITY_THRESHOLD;
    // Convert target color to RGB (0-255)
    const targetRgb = figmaColorToRgb255(color);
    for (const variable of colorVariables) {
        // Skip variables with invalid values
        const varValue = variable.value;
        if (!varValue || typeof varValue.r !== 'number' ||
            typeof varValue.g !== 'number' || typeof varValue.b !== 'number') {
            continue;
        }
        // Calculate color difference
        const varRgb = figmaColorToRgb255(varValue);
        const distance = getColorDifference(targetRgb, varRgb);
        // If this is closer than our current best match and within threshold
        if (distance < minDistance) {
            minDistance = distance;
            bestSuggestion = {
                type: 'PUBLISHED_PROXIMITY',
                propertyName: 'color', // Will be overridden by caller
                suggestedVariable: variable,
                confidence: calculateColorConfidence(distance)
            };
        }
    }
    return bestSuggestion;
}
/**
 * Find the closest number variable to the given number
 */
function findClosestNumberVariable(number, numberVariables) {
    if (typeof number !== 'number') {
        return null;
    }
    let bestSuggestion = null;
    let minRelativeDifference = NUMBER_PROXIMITY_THRESHOLD;
    for (const variable of numberVariables) {
        // Skip variables with invalid values
        const varValue = variable.value;
        if (typeof varValue !== 'number') {
            continue;
        }
        // Calculate absolute difference
        const difference = getNumberDifference(number, varValue);
        // Calculate relative difference (as a percentage of the base value)
        // This ensures smaller numbers have tighter tolerances
        const relativeScale = Math.max(Math.abs(number), 1.0);
        const relativeDifference = difference / relativeScale;
        // If this is closer than our current best match and within threshold
        if (relativeDifference < minRelativeDifference) {
            minRelativeDifference = relativeDifference;
            bestSuggestion = {
                type: 'PUBLISHED_PROXIMITY',
                propertyName: 'number', // Will be overridden by caller
                suggestedVariable: variable,
                confidence: calculateNumberConfidence(difference, number)
            };
        }
    }
    return bestSuggestion;
}
