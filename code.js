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
              result.missingVariables.push({
                type: 'COLOR',
                property: 'fill',
                value: fill.color
                  ? `RGB(${Math.round(fill.color.r * 255)}, ${Math.round(
                      fill.color.g * 255
                    )}, ${Math.round(fill.color.b * 255)})`
                  : 'Unknown',
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
              result.missingVariables.push({
                type: 'COLOR',
                property: 'stroke',
                value: stroke.color
                  ? `RGB(${Math.round(stroke.color.r * 255)}, ${Math.round(
                      stroke.color.g * 255
                    )}, ${Math.round(stroke.color.b * 255)})`
                  : 'Unknown',
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
