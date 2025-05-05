// Suggestion Integration
// This file links our new variable suggestion system with the existing code
import { VariablesStore } from './variables-utils';
import { generateVariableSuggestions } from './variable-suggestions';
// Converts a VariableSuggestion to the format expected by the existing UI/display logic
function convertToExistingSuggestionFormat(suggestion) {
    return {
        variableId: suggestion.suggestedVariable.id,
        variableName: `${suggestion.suggestedVariable.collectionName}/${suggestion.suggestedVariable.name}`,
        distance: suggestion.confidence === 1.0 ? 0 : Math.max(1, (1 - suggestion.confidence) * 20), // Convert confidence to "distance"
        value: suggestion.suggestedVariable.value
    };
}
/**
 * Converts the external variable map to our internal format
 */
function adaptVariableMap(externalMap) {
    const adaptedMap = {};
    for (const [id, entry] of Object.entries(externalMap)) {
        if (!entry.variable)
            continue;
        // Convert the external variable to our internal format
        adaptedMap[id] = {
            id: entry.variable.id,
            name: entry.variable.name,
            collectionName: entry.variable.collectionName,
            collectionId: entry.variable.collectionId,
            fullName: `${entry.variable.collectionName}/${entry.variable.name}`,
            resolvedType: mapResolvedType(entry.variable.resolvedType),
            value: entry.variable.value,
            isAlias: entry.variable.isAlias,
            parentId: entry.variable.parentId
        };
    }
    return adaptedMap;
}
/**
 * Maps the external resolvedType string to our internal VariableType enum
 */
function mapResolvedType(resolvedType) {
    switch (resolvedType) {
        case 'COLOR':
            return 'COLOR';
        case 'NUMBER':
        case 'FLOAT':
        case 'INTEGER':
            return 'NUMBER';
        case 'BOOLEAN':
            return 'BOOLEAN';
        case 'STRING':
        default:
            return 'STRING';
    }
}
/**
 * Initialize the variable store from the existing variableMap
 * Call this during plugin initialization
 */
export function initializeVariableStore(variableMap) {
    // Convert the external variable map to our internal format
    const adaptedMap = adaptVariableMap(variableMap);
    // Create a new store with our adapted data
    const store = new VariablesStore();
    // Populate the store manually
    for (const variable of Object.values(adaptedMap)) {
        store.addVariable(variable);
    }
    console.log(`Initialized variable store with ${store.size} variables`);
}
/**
 * Enhanced function to replace the existing findClosestColorVariable implementation
 * This uses both direct matching and proximity approaches
 */
export function findBestVariableSuggestion(propertyName, value) {
    // Generate suggestions using our new system
    const suggestions = generateVariableSuggestions(propertyName, value);
    if (suggestions.length === 0) {
        return null;
    }
    // Sort by confidence (highest first)
    suggestions.sort((a, b) => b.confidence - a.confidence);
    // Return the best suggestion in the format expected by the existing code
    return convertToExistingSuggestionFormat(suggestions[0]);
}
/**
 * Similar function specifically for colors, to match the existing API
 */
export function findClosestColorVariableCompat(targetRgb, threshold = 20) {
    // Convert RGB (0-255) to Figma color (0-1)
    const figmaColor = {
        r: targetRgb.r / 255,
        g: targetRgb.g / 255,
        b: targetRgb.b / 255
    };
    // Generate suggestions using our property-agnostic approach
    // We use 'fills' as the property name since it's a known color property
    const suggestions = generateVariableSuggestions('fills', figmaColor);
    if (suggestions.length === 0) {
        return null;
    }
    // Sort by confidence (highest first)
    suggestions.sort((a, b) => b.confidence - a.confidence);
    // Only return suggestions that meet the threshold criteria
    const bestSuggestion = suggestions[0];
    // We need to convert the confidence back to a distance metric for compatibility
    const distance = bestSuggestion.confidence === 1.0 ? 0 : Math.max(1, (1 - bestSuggestion.confidence) * 20);
    if (distance > threshold) {
        return null;
    }
    return convertToExistingSuggestionFormat(bestSuggestion);
}
