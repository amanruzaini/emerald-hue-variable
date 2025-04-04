"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// This plugin will scan selected frames and show which variables are used and which are missing
figma.showUI(__html__, { width: 400, height: 600 });
// Function to get collection name for a variable
function getCollectionName(variable) {
    const collection = variable.variableCollectionId;
    if (!collection)
        return undefined;
    const collectionObj = figma.variables.getVariableCollectionById(collection);
    return collectionObj === null || collectionObj === void 0 ? void 0 : collectionObj.name;
}
// Function to format variable name
function formatVariableName(variable) {
    if (!variable)
        return "Unknown Variable";
    // If it's a VARIABLE_ALIAS type, get the actual variable
    if ('type' in variable && variable.type === 'VARIABLE_ALIAS') {
        const varId = variable.id;
        console.log('Found VARIABLE_ALIAS with ID:', varId);
        try {
            // Try to get the actual variable
            const actualVar = figma.variables.getVariableById(varId);
            if (actualVar) {
                console.log('Found actual variable:', actualVar.name);
                return actualVar.name;
            }
        }
        catch (error) {
            console.error('Error getting variable:', error);
        }
        // If we couldn't get the actual variable, return the ID
        return varId;
    }
    // If it's a regular variable, return its name
    if ('name' in variable) {
        return variable.name;
    }
    // If it has an id property, return that
    if ('id' in variable) {
        return variable.id;
    }
    // Last resort: convert to string or return unknown
    return String(variable) || "Unknown Variable";
}
// Function to scan a node for variables
function scanNode(node) {
    const results = [];
    // Check fills
    if ('fills' in node) {
        const fills = node.fills;
        for (let i = 0; i < fills.length; i++) {
            const fill = fills[i];
            if (fill.type === 'SOLID' && 'boundVariables' in fill) {
                const boundVars = fill.boundVariables;
                if (boundVars && 'color' in boundVars) {
                    const colorVar = boundVars.color;
                    if (colorVar) {
                        const variable = figma.variables.getVariableById(colorVar.id);
                        if (variable) {
                            results.push({
                                name: formatVariableName(variable),
                                collection: getCollectionName(variable),
                                type: 'Color',
                                usageCount: 1,
                                nodes: [`${node.name} (Fill ${i + 1})`]
                            });
                        }
                    }
                }
            }
        }
    }
    // Check strokes
    if ('strokes' in node) {
        const strokes = node.strokes;
        for (let i = 0; i < strokes.length; i++) {
            const stroke = strokes[i];
            if (stroke.type === 'SOLID' && 'boundVariables' in stroke) {
                const boundVars = stroke.boundVariables;
                if (boundVars && 'color' in boundVars) {
                    const colorVar = boundVars.color;
                    if (colorVar) {
                        const variable = figma.variables.getVariableById(colorVar.id);
                        if (variable) {
                            results.push({
                                name: formatVariableName(variable),
                                collection: getCollectionName(variable),
                                type: 'Color',
                                usageCount: 1,
                                nodes: [`${node.name} (Stroke ${i + 1})`]
                            });
                        }
                    }
                }
            }
        }
    }
    // Check effects
    if ('effects' in node) {
        const effects = node.effects;
        for (let i = 0; i < effects.length; i++) {
            const effect = effects[i];
            if ('boundVariables' in effect) {
                const boundVars = effect.boundVariables;
                if (boundVars && 'color' in boundVars) {
                    const colorVar = boundVars.color;
                    if (colorVar) {
                        const variable = figma.variables.getVariableById(colorVar.id);
                        if (variable) {
                            results.push({
                                name: formatVariableName(variable),
                                collection: getCollectionName(variable),
                                type: 'Effect',
                                usageCount: 1,
                                nodes: [`${node.name} (Effect ${i + 1})`]
                            });
                        }
                    }
                }
            }
        }
    }
    return results;
}
// Function to scan all selected frames
function scanSelectedFrames() {
    return __awaiter(this, void 0, void 0, function* () {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            figma.ui.postMessage({
                type: 'scan-error',
                error: 'Please select at least one frame to scan'
            });
            return;
        }
        const results = [];
        const variableMap = new Map();
        // Scan each selected node
        for (const node of selection) {
            if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
                const nodeResults = scanNode(node);
                // Merge results with existing ones
                nodeResults.forEach(result => {
                    const existing = variableMap.get(result.name);
                    if (existing) {
                        existing.usageCount++;
                        existing.nodes.push(...result.nodes);
                    }
                    else {
                        variableMap.set(result.name, result);
                    }
                });
            }
        }
        // Convert map to array and sort by usage count
        const sortedResults = Array.from(variableMap.values())
            .sort((a, b) => b.usageCount - a.usageCount);
        figma.ui.postMessage({
            type: 'scan-results',
            results: sortedResults
        });
    });
}
// Listen for messages from the UI
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'scan-variables') {
        yield scanSelectedFrames();
    }
});
