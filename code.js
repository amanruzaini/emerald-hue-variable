'use strict';
// @ts-nocheck
// This file contains a Figma plugin to scan selected frames for design system variable usage
// Minimal type definitions for Figma API
// declare const figma: {
//   showUI: (html: string, options?: { width?: number; height?: number }) => void;
//   ui: {
//     onmessage: ((callback: any) => void);
//     postMessage: (msg: any) => void;
//   };
//   currentPage: {
//     selection: any[];
//   };
//   fileKey: string;
//   variables: {
//     getLocalVariableCollectionsAsync: () => Promise<any[]>;
//     getBoundVariablesAsync: (variableIds: string[]) => Promise<any[]>;
//     getVariableByIdAsync: (variableId: string) => Promise<any>;
//     getLocalVariablesAsync: () => Promise<any[]>;
//     getPublishedCollectionsAsync: () => Promise<any[]>;
//     importVariableByKeyAsync: (key: string) => Promise<any>;
//   };
//   closePlugin: () => void;
//   mixed: any;
// };
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
// Global storage
let variableMap = {};
let collectionModes = new Map(); // collectionId -> modeId
let storedVariables = new Map();
// Show the UI
figma.showUI(__html__, { width: 450, height: 550 });
// Initialize plugin
function initialize() {
  return __awaiter(this, void 0, void 0, function* () {
    var _a;
    try {
      // Get all collections
      const localCollections =
        yield figma.variables.getLocalVariableCollectionsAsync();
      const libraryCollections =
        yield figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      // Store mode IDs for each collection
      for (const collection of localCollections) {
        if (
          (_a = collection.modes) === null || _a === void 0 ? void 0 : _a[0]
        ) {
          collectionModes.set(collection.id, collection.modes[0].modeId);
        }
      }
      // Process local variables
      yield processLocalVariables(localCollections);
      // Process library variables
      yield processLibraryVariables(libraryCollections);
      console.log('Initialized variable map:', variableMap);
    } catch (error) {
      console.error('Error during initialization:', error);
      figma.notify('Error loading variables');
    }
  });
}
// Process local variables
function processLocalVariables(collections) {
  return __awaiter(this, void 0, void 0, function* () {
    for (const collection of collections) {
      if (!collection.variableIds) continue;
      const modeId = collectionModes.get(collection.id);
      if (!modeId) continue;
      for (const variableId of collection.variableIds) {
        try {
          const variable = yield figma.variables.getVariableByIdAsync(
            variableId
          );
          if (!variable) continue;
          const value = variable.valuesByMode[modeId];
          const isAlias = isVariableAlias(value);
          // Create the variable data
          const variableData = {
            id: variableId,
            name: variable.name,
            collectionName: collection.name,
            collectionId: collection.id,
            resolvedType: variable.resolvedType,
            value: isAlias
              ? value
              : typeof value === 'object' && 'r' in value
              ? value
              : value,
            isAlias,
          };
          // If it's an alias, add the parent ID
          if (isAlias && isVariableAliasValue(value)) {
            variableData.parentId = value.id;
          }
          // Store the variable
          variableMap[variableId] = {
            variable: variableData,
            aliases: [],
          };
          // If it's an alias, update the parent's aliases list
          if (isAlias && isVariableAliasValue(value)) {
            const parentId = value.id;
            // Create parent entry if it doesn't exist
            if (!variableMap[parentId]) {
              variableMap[parentId] = {
                variable: null,
                aliases: [],
              };
            }
            // Add this variable as an alias of the parent
            variableMap[parentId].aliases.push(variableId);
          }
        } catch (error) {
          console.error(`Error processing variable ${variableId}:`, error);
        }
      }
    }
  });
}
// Process library variables
function processLibraryVariables(collections) {
  return __awaiter(this, void 0, void 0, function* () {
    for (const collection of collections) {
      if (!collection.key || !collection.name) continue;
      try {
        const variables =
          yield figma.teamLibrary.getVariablesInLibraryCollectionAsync(
            collection.key
          );
        console.log(
          'Processing library collection:',
          collection.name,
          'with variables:',
          variables
        );
        for (const variable of variables) {
          if (!variable.key || !variable.name) continue;
          console.log('Processing library variable:', {
            name: variable.name,
            key: variable.key,
            resolvedType: variable.resolvedType,
          });
          // Store the library variable
          const variableId = variable.key;
          variableMap[variableId] = {
            variable: {
              id: variableId,
              name: variable.name,
              collectionName: collection.name,
              collectionId: collection.key,
              resolvedType: variable.resolvedType,
              value: {}, // Library variables don't expose values directly
              isAlias: false,
            },
            aliases: [],
          };
          // Also store it with the VariableID: prefix since that's how it might be referenced
          const prefixedId = `VariableID:${variableId}`;
          variableMap[prefixedId] = variableMap[variableId];
          console.log('Stored library variable:', {
            original: variableMap[variableId],
            prefixed: variableMap[prefixedId],
          });
        }
      } catch (error) {
        console.error(
          `Error processing library collection ${collection.key}:`,
          error
        );
      }
    }
  });
}
// Helper function to check if a value is a variable alias
function isVariableAlias(value) {
  return (
    value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'VARIABLE_ALIAS'
  );
}
// Helper function to type check variable value
function isVariableAliasValue(value) {
  return (
    value &&
    typeof value === 'object' &&
    'type' in value &&
    'id' in value &&
    value.type === 'VARIABLE_ALIAS'
  );
}
// Helper function to get variable name
function getVariableName(variableId) {
  const varData = variableMap[variableId];
  if (!(varData === null || varData === void 0 ? void 0 : varData.variable))
    return 'Unknown';
  // return `${varData.variable.name}`;
  return `${varData.variable.collectionName}/${varData.variable.name}`;
}
// Helper function to get resolved variable value
function getVariableValue(variableId) {
  const varData = variableMap[variableId];
  if (!(varData === null || varData === void 0 ? void 0 : varData.variable))
    return null;
  // If it's an alias, get the parent's value
  if (varData.variable.isAlias && varData.variable.parentId) {
    return getVariableValue(varData.variable.parentId);
  }
  return varData.variable.value;
}
// Call initialize when plugin starts
initialize();
// Handle messages from the UI
figma.ui.onmessage = (msg) =>
  __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'scan-variables') {
      const options = msg.options || {
        scanColors: true,
        scanText: true,
        scanResponsive: true,
      };
      // Check if user has selected any frames
      if (figma.currentPage.selection.length === 0) {
        figma.ui.postMessage({
          type: 'error',
          message: 'Please select at least one frame to scan',
        });
        return;
      }
      // Get all variables from the document
      const allVariableCollections =
        yield figma.variables.getLocalVariableCollectionsAsync();
      // Scan selected nodes
      const results = [];
      for (const node of figma.currentPage.selection) {
        yield scanNode(node, allVariableCollections, options, results);
      }
      // Debug logging for the results being sent to UI
      console.log('=== DEBUG: SCAN RESULTS BEING SENT TO UI ===');
      console.log('Total results:', results.length);
      // Log details of variables found (up to 5 for readability)
      const debugSample = results.slice(0, 5);
      for (const result of debugSample) {
        console.log('Node:', result.nodeName, '(type:', result.nodeType, ')');
        // Show used variables
        if (result.hasVariables.length > 0) {
          console.log('  HAS VARIABLES:', result.hasVariables.length);
          for (const v of result.hasVariables) {
            console.log(
              `    ${v.type} - ${v.property}: "${v.variableName}" (${
                v.value || 'no value'
              })`
            );
          }
        }
        // Show missing variables
        if (result.missingVariables.length > 0) {
          console.log('  MISSING VARIABLES:', result.missingVariables.length);
          for (const v of result.missingVariables) {
            console.log(
              `    ${v.type} - ${v.property}: ${v.value || 'no value'}`
            );
          }
        }
      }
      // Send results back to UI
      figma.ui.postMessage({
        type: 'scan-results',
        results: results,
      });
    } else if (msg.type === 'select-node') {
      // Handle node selection when a node is clicked in the UI
      try {
        // Get the node by ID
        const nodeId = msg.nodeId;
        const node = figma.currentPage.findOne((n) => n.id === nodeId);

        if (node) {
          // Clear current selection and select the node
          figma.currentPage.selection = [node];

          // Scroll to the node in the viewport
          figma.viewport.scrollAndZoomIntoView([node]);

          // Notify UI that selection was successful
          figma.ui.postMessage({
            type: 'node-selected',
            success: true,
            nodeId: nodeId,
          });
        } else {
          console.error(`Node with ID ${nodeId} not found`);
          figma.ui.postMessage({
            type: 'node-selected',
            success: false,
            message: 'Node not found',
          });
        }
      } catch (error) {
        console.error('Error selecting node:', error);
        figma.ui.postMessage({
          type: 'node-selected',
          success: false,
          message: 'Failed to select node',
        });
      }
    } else if (msg.type === 'close') {
      figma.closePlugin();
    }
  });
// Helper function to get bound variable from a node
function getBoundVariable(node, property) {
  return __awaiter(this, void 0, void 0, function* () {
    if (!node.boundVariables) return null;
    // First try exact property match
    const boundVariable = node.boundVariables[property];
    if (boundVariable) {
      console.log('Found exact property match:', boundVariable);
      return boundVariable;
    }
    // Then try pattern matching
    for (const key of Object.keys(node.boundVariables)) {
      if (key.startsWith(property)) {
        console.log(
          'Found property pattern match:',
          key,
          node.boundVariables[key]
        );
        return node.boundVariables[key];
      }
    }
    return null;
  });
}
// Helper function to format variable name to string, using stored variables
function formatVariableName(variable) {
  return __awaiter(this, void 0, void 0, function* () {
    if (!variable) {
      console.log('formatVariableName: Received null variable.');
      return 'Unknown (null)';
    }
    console.log(
      'formatVariableName: Processing variable object:',
      JSON.stringify(variable, null, 2)
    );
    // Handle array case - if variable is an array, use the first item
    if (Array.isArray(variable)) {
      if (variable.length === 0) {
        console.log('formatVariableName: Received empty array.');
        return 'Unknown (empty array)';
      }
      console.log('formatVariableName: Received array, using first item.');
      variable = variable[0];
    }
    // Extract the variable ID
    let variableId = null;
    // Case 1: Variable Alias (object with type: 'VARIABLE_ALIAS' and id)
    if (
      typeof variable === 'object' &&
      'type' in variable &&
      variable.type === 'VARIABLE_ALIAS' &&
      'id' in variable
    ) {
      variableId = variable.id;
      console.log(
        `formatVariableName: Identified as Alias. Target ID: ${variableId}`
      );
    }
    // Case 2: Direct Variable Reference (object with variableId)
    else if (typeof variable === 'object' && 'variableId' in variable) {
      variableId = String(variable.variableId);
      console.log(
        `formatVariableName: Identified as Direct Reference (variableId). Target ID: ${variableId}`
      );
    }
    // Case 3: Direct Variable Object (object with id, but not an alias)
    else if (
      typeof variable === 'object' &&
      'id' in variable &&
      (!('type' in variable) || variable.type !== 'VARIABLE_ALIAS')
    ) {
      variableId = String(variable.id);
      console.log(
        `formatVariableName: Identified as Direct Variable Object (id). Target ID: ${variableId}`
      );
    }
    // Case 4: Simple string ID
    else if (typeof variable === 'string') {
      variableId = variable;
      console.log(
        `formatVariableName: Received raw string ID. Target ID: ${variableId}`
      );
    }
    if (!variableId) {
      console.log(
        'formatVariableName: Could not extract a usable ID from variable object:',
        JSON.stringify(variable, null, 2)
      );
      return 'Unknown (ID extraction failed)';
    }
    try {
      // Clean the variable ID - remove mode ID part after the slash if present
      let cleanId = variableId;
      // Remove VariableID: prefix
      if (cleanId.startsWith('VariableID:')) {
        cleanId = cleanId.replace('VariableID:', '');
      }
      // Remove mode ID part (after the slash) if present
      if (cleanId.includes('/')) {
        cleanId = cleanId.split('/')[0];
      }
      console.log(`formatVariableName: Cleaned variable ID: ${cleanId}`);
      // Try to get the variable directly from Figma API
      const variableObj = yield figma.variables.getVariableByIdAsync(cleanId);
      if (variableObj) {
        // Return just the variable name without the collection name
        console.log(
          `formatVariableName: Successfully retrieved variable: ${variableObj.name}`
        );
        return variableObj.name;
      } else {
        // If the variable isn't found, try the map as fallback
        const mapEntry = variableMap[cleanId];
        if (
          mapEntry === null || mapEntry === void 0 ? void 0 : mapEntry.variable
        ) {
          const varData = mapEntry.variable;
          // Return just the variable name
          console.log(
            `formatVariableName: Found match in variableMap fallback with ID '${cleanId}'. Resolved name: ${varData.name}`
          );
          return varData.name;
        }
        // Try with the original ID as fallback
        const mapEntryOriginal = variableMap[variableId];
        if (
          mapEntryOriginal === null || mapEntryOriginal === void 0
            ? void 0
            : mapEntryOriginal.variable
        ) {
          const varData = mapEntryOriginal.variable;
          // Return just the variable name
          console.log(
            `formatVariableName: Found match in variableMap fallback with original ID. Resolved name: ${varData.name}`
          );
          return varData.name;
        }
      }
      // If all else fails, return the ID
      console.log(
        `formatVariableName: Could not find variable. Returning ID: ${cleanId}`
      );
      return `Unknown (ID: ${cleanId.substring(0, 8)}...)`;
    } catch (error) {
      console.error('Error retrieving variable:', error);
      return `Error (ID: ${variableId.substring(0, 8)}...)`;
    }
  });
}
// Recursive function to scan nodes for variable usage
function scanNode(node, allVariableCollections, options, results) {
  return __awaiter(this, void 0, void 0, function* () {
    // Skip hidden nodes
    if ('visible' in node && !node.visible) return;
    const nodeResult = {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      missingVariables: [],
      hasVariables: [],
    };
    // Check for color variables
    if (options.scanColors && ('fills' in node || 'strokes' in node)) {
      yield checkForColorVariables(node, nodeResult);
    }
    // Check for text variables
    if (options.scanText && node.type === 'TEXT') {
      yield checkForTextVariables(
        node,
        nodeResult /*, allVariableCollections*/
      );
    }
    // Check for responsive variables (width, height, padding)
    if (options.scanResponsive) {
      // Check properties that might have responsive variables
      const responsiveProps = [
        'width',
        'height',
        'paddingLeft',
        'paddingRight',
        'paddingTop',
        'paddingBottom',
        'itemSpacing',
        'horizontalPadding',
        'verticalPadding',
      ];
      let hasResponsiveProps = false;
      for (const prop of responsiveProps) {
        if (prop in node) {
          hasResponsiveProps = true;
          break;
        }
      }
      if (hasResponsiveProps) {
        yield checkForResponsiveVariables(
          node, // Cast as base SceneNode, specific checks happen inside
          nodeResult
          // allVariableCollections // Pass if needed by called function
        );
      }
    }
    // Add to results if we found missing or used variables
    if (
      nodeResult.missingVariables.length > 0 ||
      nodeResult.hasVariables.length > 0
    ) {
      results.push(nodeResult);
    }
    // Recursively scan children if node is a parent
    if ('children' in node && node.children) {
      for (const child of node.children) {
        yield scanNode(child, allVariableCollections, options, results); // Pass collections down
      }
    }
  });
}
// Function to check for color variables
function checkForColorVariables(node, result) {
  return __awaiter(this, void 0, void 0, function* () {
    // Check fill properties
    if (node.fills && node.fills !== figma.mixed && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'SOLID') {
          const boundVariable = yield getBoundVariable(
            node,
            `fills[${node.fills.indexOf(fill)}]`
          ); // Try specific index binding
          if (boundVariable) {
            const variableName = yield formatVariableName(boundVariable);
            result.hasVariables.push({
              type: 'COLOR',
              property: 'fill',
              variableName: variableName,
              value: fill.color
                ? `RGB(${Math.round(fill.color.r * 255)}, ${Math.round(
                    fill.color.g * 255
                  )}, ${Math.round(fill.color.b * 255)})`
                : 'Unknown',
            });
          } else {
            const generalFillBoundVar = yield getBoundVariable(node, 'fills'); // Check general fills binding
            if (!generalFillBoundVar) {
              // Only add missing if no general or specific binding found
              const missingColorRgb = figmaColorToRgb255(fill.color);
              const suggestion = findClosestColorVariable(missingColorRgb);
              result.missingVariables.push({
                type: 'COLOR',
                property: 'fill',
                value: fill.color
                  ? `RGB(${missingColorRgb.r}, ${missingColorRgb.g}, ${missingColorRgb.b})`
                  : 'Unknown',
                suggestions: suggestion ? [suggestion] : [], // Add suggestion here
              });
            } else {
              // Show actual color value for general binding
              const variableName = yield formatVariableName(
                generalFillBoundVar
              );
              // Avoid duplicates if multiple fills use the same general binding
              if (
                !result.hasVariables.some(
                  (v) =>
                    v.property === 'fill' && v.variableName === variableName
                )
              ) {
                // Extract the fill's actual color value
                const colorValue = fill.color
                  ? `RGB(${Math.round(fill.color.r * 255)}, ${Math.round(
                      fill.color.g * 255
                    )}, ${Math.round(fill.color.b * 255)})`
                  : 'Unknown';
                result.hasVariables.push({
                  type: 'COLOR',
                  property: 'fill',
                  variableName: variableName,
                  value: colorValue, // Show actual color value instead of "Bound (General)"
                });
              }
            }
          }
        }
      }
    }
    // Check stroke properties
    if (
      node.strokes &&
      node.strokes !== figma.mixed &&
      Array.isArray(node.strokes)
    ) {
      for (const stroke of node.strokes) {
        if (stroke.type === 'SOLID') {
          const boundVariable = yield getBoundVariable(
            node,
            `strokes[${node.strokes.indexOf(stroke)}]`
          ); // Try specific index
          if (boundVariable) {
            const variableName = yield formatVariableName(boundVariable);
            result.hasVariables.push({
              type: 'COLOR',
              property: 'stroke',
              variableName: variableName,
              value: stroke.color
                ? `RGB(${Math.round(stroke.color.r * 255)}, ${Math.round(
                    stroke.color.g * 255
                  )}, ${Math.round(stroke.color.b * 255)})`
                : 'Unknown',
            });
          } else {
            const generalStrokeBoundVar = yield getBoundVariable(
              node,
              'strokes'
            ); // Check general strokes binding
            if (!generalStrokeBoundVar) {
              // Only add missing if no general or specific binding found
              const missingColorRgb = figmaColorToRgb255(stroke.color);
              const suggestion = findClosestColorVariable(missingColorRgb);
              result.missingVariables.push({
                type: 'COLOR',
                property: 'stroke',
                value: stroke.color
                  ? `RGB(${missingColorRgb.r}, ${missingColorRgb.g}, ${missingColorRgb.b})`
                  : 'Unknown',
                suggestions: suggestion ? [suggestion] : [], // Add suggestion here
              });
            } else {
              const variableName = yield formatVariableName(
                generalStrokeBoundVar
              );
              if (
                !result.hasVariables.some(
                  (v) =>
                    v.property === 'stroke' && v.variableName === variableName
                )
              ) {
                // Extract the stroke's actual color value
                const colorValue = stroke.color
                  ? `RGB(${Math.round(stroke.color.r * 255)}, ${Math.round(
                      stroke.color.g * 255
                    )}, ${Math.round(stroke.color.b * 255)})`
                  : 'Unknown';
                result.hasVariables.push({
                  type: 'COLOR',
                  property: 'stroke',
                  variableName: variableName,
                  value: colorValue, // Show actual color value instead of "Bound (General)"
                });
              }
            }
          }
        }
      }
    }
  });
}
// Function to check for text variables
function checkForTextVariables(
  node,
  result
  // allVariableCollections: VariableCollection[] // Removed
) {
  return __awaiter(this, void 0, void 0, function* () {
    // Check font size
    const fontSizeVariable = yield getBoundVariable(node, 'fontSize');
    if (fontSizeVariable) {
      result.hasVariables.push({
        type: 'TEXT',
        property: 'fontSize',
        variableName: yield formatVariableName(fontSizeVariable),
        value:
          typeof node.fontSize === 'number'
            ? `${node.fontSize}px`
            : 'Mixed/Unknown',
      });
    } else if (node.fontSize !== figma.mixed) {
      // Only report missing if not mixed
      result.missingVariables.push({
        type: 'TEXT',
        property: 'fontSize',
        value:
          typeof node.fontSize === 'number'
            ? `${node.fontSize}px`
            : 'Mixed/Unknown',
      });
    }
    // Check line height
    const lineHeightVariable = yield getBoundVariable(node, 'lineHeight');
    let lineHeightValue = 'Auto'; // Default for Figma
    if (node.lineHeight !== figma.mixed) {
      if (typeof node.lineHeight === 'object') {
        if ('value' in node.lineHeight) {
          const lh = node.lineHeight;
          lineHeightValue =
            lh.unit === 'PIXELS' ? `${lh.value}px` : `${lh.value}%`;
        }
        // Could be other object types like 'AUTO' symbol, handle if necessary
      }
    } else {
      lineHeightValue = 'Mixed';
    }
    if (lineHeightVariable) {
      result.hasVariables.push({
        type: 'TEXT',
        property: 'lineHeight',
        variableName: yield formatVariableName(lineHeightVariable),
        value: lineHeightValue,
      });
    } else if (node.lineHeight !== figma.mixed) {
      // Only report missing if not mixed
      result.missingVariables.push({
        type: 'TEXT',
        property: 'lineHeight',
        value: lineHeightValue,
      });
    }
    // Add checks for other text properties if needed (e.g., letterSpacing, paragraphSpacing)
    // Example for letterSpacing:
    const letterSpacingVariable = yield getBoundVariable(node, 'letterSpacing');
    let letterSpacingValue = '0'; // Default assumption
    if (
      node.letterSpacing !== figma.mixed &&
      typeof node.letterSpacing === 'object' &&
      'value' in node.letterSpacing
    ) {
      const ls = node.letterSpacing;
      letterSpacingValue =
        ls.unit === 'PIXELS' ? `${ls.value}px` : `${ls.value}%`;
    } else if (node.letterSpacing === figma.mixed) {
      letterSpacingValue = 'Mixed';
    }
    if (letterSpacingVariable) {
      result.hasVariables.push({
        type: 'TEXT',
        property: 'letterSpacing',
        variableName: yield formatVariableName(letterSpacingVariable),
        value: letterSpacingValue,
      });
    } else if (node.letterSpacing !== figma.mixed) {
      result.missingVariables.push({
        type: 'TEXT',
        property: 'letterSpacing',
        value: letterSpacingValue,
      });
    }
  });
}
// Function to check for responsive variables
function checkForResponsiveVariables(node, result) {
  return __awaiter(this, void 0, void 0, function* () {
    // Use string array for property names without specifying they're keyof SceneNode
    const responsiveProps = [
      'width',
      'height',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
      'paddingBottom',
      'horizontalPadding',
      'verticalPadding',
      'itemSpacing',
    ];
    // Check each property that might be bound to a variable
    for (const propName of responsiveProps) {
      // @ts-ignore - Property access is validated at runtime
      if (propName in node) {
        // @ts-ignore - Using any to bypass type checking
        const value = node[propName];
        if (value === figma.mixed) continue; // Skip mixed values
        const boundVariable = yield getBoundVariable(node, propName);
        let displayValue = 'Unknown';
        if (typeof value === 'number') {
          displayValue = `${Math.round(value)}px`;
        } else if (
          typeof value === 'object' &&
          value !== null &&
          'value' in value &&
          'unit' in value
        ) {
          // Handle complex values like padding with units if necessary
          displayValue = `${value.value}${
            value.unit === 'PERCENT' ? '%' : 'px'
          }`;
        } else if (typeof value === 'string') {
          // Handle string values if applicable
          displayValue = value;
        }
        if (boundVariable) {
          const variableName = yield formatVariableName(boundVariable);
          result.hasVariables.push({
            type: 'RESPONSIVE',
            property: propName,
            variableName: variableName,
            value: displayValue,
          });
        } else {
          result.missingVariables.push({
            type: 'RESPONSIVE',
            property: propName,
            value: displayValue,
          });
        }
      }
    }
  });
}

// --- START: Color Comparison Utilities ---

/**
 * Converts RGB color values to XYZ color space.
 * Assumes sRGB color space.
 * @param {number} r Red value (0-255)
 * @param {number} g Green value (0-255)
 * @param {number} b Blue value (0-255)
 * @returns {{x: number, y: number, z: number}}
 */
function rgbToXyz(r, g, b) {
  let rLinear = r / 255;
  let gLinear = g / 255;
  let bLinear = b / 255;

  rLinear =
    rLinear > 0.04045
      ? Math.pow((rLinear + 0.055) / 1.055, 2.4)
      : rLinear / 12.92;
  gLinear =
    gLinear > 0.04045
      ? Math.pow((gLinear + 0.055) / 1.055, 2.4)
      : gLinear / 12.92;
  bLinear =
    bLinear > 0.04045
      ? Math.pow((bLinear + 0.055) / 1.055, 2.4)
      : bLinear / 12.92;

  rLinear *= 100;
  gLinear *= 100;
  bLinear *= 100;

  // Observer. = 2°, Illuminant = D65
  const x = rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805;
  const y = rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722;
  const z = rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505;

  return { x, y, z };
}

/**
 * Converts XYZ color values to CIELAB color space.
 * Uses D65 reference white.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {{l: number, a: number, b: number}}
 */
function xyzToLab(x, y, z) {
  const refX = 95.047; // Observer= 2°, Illuminant= D65
  const refY = 100.0;
  const refZ = 108.883;

  x /= refX;
  y /= refY;
  z /= refZ;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  const l = 116 * y - 16;
  const a = 500 * (x - y);
  const bValue = 200 * (y - z);

  return { l, a, b: bValue };
}

/**
 * Calculates the perceptual color difference between two colors in CIELAB space using the Delta E 2000 formula.
 * @param {{l: number, a: number, b: number}} lab1
 * @param {{l: number, a: number, b: number}} lab2
 * @returns {number} The Delta E 2000 difference.
 */
function deltaE2000(lab1, lab2) {
  const kL = 1,
    kC = 1,
    kH = 1;

  const L1 = lab1.l,
    a1 = lab1.a,
    b1 = lab1.b;
  const L2 = lab2.l,
    a2 = lab2.a,
    b2 = lab2.b;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const G =
    0.5 *
    (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));

  const a1Prime = a1 * (1 + G);
  const a2Prime = a2 * (1 + G);

  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
  const avgCPrime = (C1Prime + C2Prime) / 2;

  let h1Prime = Math.atan2(b1, a1Prime);
  if (h1Prime < 0) h1Prime += 2 * Math.PI;
  let h2Prime = Math.atan2(b2, a2Prime);
  if (h2Prime < 0) h2Prime += 2 * Math.PI;

  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;

  let deltahPrime;
  const C1C2Prime = C1Prime * C2Prime;
  if (C1C2Prime === 0) {
    deltahPrime = 0;
  } else {
    deltahPrime = h2Prime - h1Prime;
    if (deltahPrime > Math.PI) deltahPrime -= 2 * Math.PI;
    if (deltahPrime < -Math.PI) deltahPrime += 2 * Math.PI;
  }

  const deltaHPrime = 2 * Math.sqrt(C1C2Prime) * Math.sin(deltahPrime / 2);

  const avgL = (L1 + L2) / 2;
  const avgHPrime =
    C1C2Prime === 0
      ? h1Prime + h2Prime
      : Math.abs(h1Prime - h2Prime) > Math.PI
      ? (h1Prime + h2Prime + 2 * Math.PI) / 2
      : (h1Prime + h2Prime) / 2;

  const T =
    1 -
    0.17 * Math.cos(avgHPrime - Math.PI / 6) +
    0.24 * Math.cos(2 * avgHPrime) +
    0.32 * Math.cos(3 * avgHPrime + Math.PI / 30) -
    0.2 * Math.cos(4 * avgHPrime - (63 * Math.PI) / 180);

  const SL =
    1 +
    (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const SC = 1 + 0.045 * avgCPrime;
  const SH = 1 + 0.015 * avgCPrime * T;

  const deltaTheta =
    ((30 * Math.PI) / 180) *
    Math.exp(-Math.pow(((avgHPrime * 180) / Math.PI - 275) / 25, 2));
  const RC =
    2 *
    Math.sqrt(
      Math.pow(avgCPrime, 7) / (Math.pow(avgCPrime, 7) + Math.pow(25, 7))
    );
  const RT = -RC * Math.sin(2 * deltaTheta);

  const LTerm = deltaLPrime / (kL * SL);
  const CTerm = deltaCPrime / (kC * SC);
  const HTerm = deltaHPrime / (kH * SH);

  return Math.sqrt(
    Math.pow(LTerm, 2) +
      Math.pow(CTerm, 2) +
      Math.pow(HTerm, 2) +
      RT * CTerm * HTerm
  );
}

/**
 * Converts a Figma color object {r, g, b} (0-1 range) to {r, g, b} (0-255 range).
 * @param {{r: number, g: number, b: number}} figmaColor
 * @returns {{r: number, g: number, b: number}}
 */
function figmaColorToRgb255(figmaColor) {
  if (
    !figmaColor ||
    typeof figmaColor.r !== 'number' ||
    typeof figmaColor.g !== 'number' ||
    typeof figmaColor.b !== 'number'
  ) {
    return { r: 0, g: 0, b: 0 }; // Return black or throw error for invalid input
  }
  return {
    r: Math.round(figmaColor.r * 255),
    g: Math.round(figmaColor.g * 255),
    b: Math.round(figmaColor.b * 255),
  };
}

/**
 * Finds the closest color variable suggestion for a given RGB color.
 * @param {{r: number, g: number, b: number}} targetRgb The target color (0-255).
 * @param {number} threshold The maximum Delta E 2000 distance allowed.
 * @returns {{variableId: string, variableName: string, distance: number, value: object} | null} The best suggestion or null.
 */
function findClosestColorVariable(targetRgb, threshold = 20) {
  let bestSuggestion = null;
  let minDistance = threshold;

  const targetLab = xyzToLab(
    ...Object.values(rgbToXyz(targetRgb.r, targetRgb.g, targetRgb.b))
  );

  for (const variableId in variableMap) {
    const entry = variableMap[variableId];
    if (!entry || !entry.variable || entry.variable.resolvedType !== 'COLOR') {
      continue;
    }

    let variableValue = entry.variable.value;
    let variableName = entry.variable.name; // Use the specific alias name if available

    // If it's an alias, get the resolved value from the parent
    if (entry.variable.isAlias && entry.variable.parentId) {
      const parentValue = getVariableValue(entry.variable.parentId);
      if (
        parentValue &&
        typeof parentValue === 'object' &&
        'r' in parentValue
      ) {
        variableValue = parentValue;
        // Keep the alias name for the suggestion, as it's what the user might recognize
      } else {
        continue; // Cannot resolve alias value
      }
    }

    // Check if variableValue is a valid color object {r, g, b} (0-1 range)
    if (
      !variableValue ||
      typeof variableValue.r !== 'number' ||
      typeof variableValue.g !== 'number' ||
      typeof variableValue.b !== 'number'
    ) {
      console.warn(
        `Skipping variable ${variableName} (${variableId}) due to invalid color value:`,
        variableValue
      );
      continue;
    }

    const variableRgb255 = figmaColorToRgb255(variableValue);
    const variableLab = xyzToLab(
      ...Object.values(
        rgbToXyz(variableRgb255.r, variableRgb255.g, variableRgb255.b)
      )
    );

    const distance = deltaE2000(targetLab, variableLab);

    if (distance < minDistance) {
      minDistance = distance;
      bestSuggestion = {
        variableId: variableId,
        variableName: variableName, // Suggest the name of the variable/alias itself
        distance: distance,
        value: variableValue, // Store the actual resolved color value
      };
    }
  }

  return bestSuggestion;
}

// --- END: Color Comparison Utilities ---
