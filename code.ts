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

// declare const __html__: string;

// Type declarations for Figma node types
// type SceneNode = {
//   id: string;
//   name: string;
//   type: string;
//   visible?: boolean;
//   children?: SceneNode[];
//   boundVariables?: { [key: string]: Variable | VariableAlias };
//   [key: string]: any;
// };

// type TextNode = SceneNode & {
//   type: 'TEXT';
//   fontSize: number | VariableAlias;
//   lineHeight: any;
// };

// type Paint = {
//   type: string;
//   color?: { r: number; g: number; b: number };
// };

// type Variable = any;
// type VariableAlias = any;
// type VariableCollection = any;
// type PluginAPI = {
//   mixed: any;
// };

// Types for REST API responses
type FigmaVariable = {
  id: string;
  name: string;
  key: string;
  variableCollectionId: string;
  resolvedType: string;
  valuesByMode: { [key: string]: any };
  remote: boolean;
  description: string;
  hiddenFromPublishing: boolean;
  scopes: string[];
};

type FigmaVariableCollection = {
  id: string;
  name: string;
  key: string;
  modes: { modeId: string; name: string }[];
  defaultModeId: string;
  remote: boolean;
  hiddenFromPublishing: boolean;
};

type FigmaPublishedVariablesResponse = {
  status: number;
  error?: boolean;
  message?: string;
  meta: {
    variables: FigmaVariable[];
    variableCollections: FigmaVariableCollection[];
  };
};

// Types for our messages and scan results
type VariableType = 'COLOR' | 'TEXT' | 'RESPONSIVE';
type ScanOptions = {
  scanColors: boolean;
  scanText: boolean;
  scanResponsive: boolean;
};

// Helper type for variable usage
type VariableUsage = {
  type: VariableType;
  property: string;
  variableName: string; // Always include this property
  value?: string;
};

// Update the VariableUsageResult type
type VariableUsageResult = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  missingVariables: {
    type: VariableType;
    property: string;
    value?: string;
  }[];
  hasVariables: VariableUsage[];
};

// Types for variable handling
interface VariableAliasValue {
  type: 'VARIABLE_ALIAS';
  id: string;
}

interface ColorValue {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface CustomVariableValue {
  type?: 'VARIABLE_ALIAS';
  id?: string;
  value?: string | number | boolean;
  // For color values
  r?: number;
  g?: number;
  b?: number;
  a?: number;
}

// Variable types and values
type VariableResolvedType = 'COLOR' | 'TEXT' | 'FLOAT' | 'BOOLEAN' | 'STRING';

// Common variable fields
type CommonVariableFields = {
  id: string;
  name: string;
  collectionName: string;
  isAlias: boolean;
  parentId?: string;
};

// Interface for organized variables
type OrganizedVariable = CommonVariableFields & {
  type: VariableResolvedType;
  value: any;
};

// Interface for stored variables
type StoredVariable = CommonVariableFields & {
  variableName: string;
  fullId: string;
  resolvedType: VariableResolvedType;
};

// Interface for variable data with values
type VariableDataWithValues = CommonVariableFields & {
  collectionId: string;
  value: CustomVariableValue | string | number | boolean | ColorValue | VariableAliasValue;
  resolvedType: VariableResolvedType;
};

interface VariableMapEntry {
  variable: VariableDataWithValues | null;
  aliases: string[];  // IDs of variables that reference this one
}

interface VariableMap {
  [key: string]: VariableMapEntry;
}

interface OrganizedVariables {
  colors: Map<string, OrganizedVariable>;
  text: Map<string, OrganizedVariable>;
  responsive: Map<string, OrganizedVariable>;
}

// Global storage
let variableMap: VariableMap = {};
let collectionModes: Map<string, string> = new Map(); // collectionId -> modeId
let storedVariables: Map<string, StoredVariable> = new Map();

// Show the UI
figma.showUI(__html__, { width: 450, height: 550 });

// Initialize plugin
async function initialize() {
  try {
    // Get all collections
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    
    // Store mode IDs for each collection
    for (const collection of localCollections) {
      if (collection.modes?.[0]) {
        collectionModes.set(collection.id, collection.modes[0].modeId);
      }
    }

    // Process local variables
    await processLocalVariables(localCollections);
    
    // Process library variables
    await processLibraryVariables(libraryCollections);

    console.log('Initialized variable map:', variableMap);
  } catch (error) {
    console.error('Error during initialization:', error);
    figma.notify('Error loading variables');
  }
}

// Process local variables
async function processLocalVariables(collections: VariableCollection[]) {
  for (const collection of collections) {
    if (!collection.variableIds) continue;

    const modeId = collectionModes.get(collection.id);
    if (!modeId) continue;

    for (const variableId of collection.variableIds) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) continue;

        const value = variable.valuesByMode[modeId];
        const isAlias = isVariableAlias(value);
        
        // Create the variable data
        const variableData: VariableDataWithValues = {
          id: variableId,
          name: variable.name,
          collectionName: collection.name,
          collectionId: collection.id,
          resolvedType: variable.resolvedType,
          value: isAlias 
            ? value as VariableAliasValue 
            : (typeof value === 'object' && 'r' in value) 
              ? value as ColorValue
              : value,
          isAlias
        };

        // If it's an alias, add the parent ID
        if (isAlias && isVariableAliasValue(value)) {
          variableData.parentId = value.id;
        }

        // Store the variable
        variableMap[variableId] = {
          variable: variableData,
          aliases: []
        };

        // If it's an alias, update the parent's aliases list
        if (isAlias && isVariableAliasValue(value)) {
          const parentId = value.id;
          
          // Create parent entry if it doesn't exist
          if (!variableMap[parentId]) {
            variableMap[parentId] = {
              variable: null,
              aliases: []
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
}

// Process library variables
async function processLibraryVariables(collections: LibraryVariableCollection[]) {
  for (const collection of collections) {
    if (!collection.key || !collection.name) continue;

    try {
      const variables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);
      console.log('Processing library collection:', collection.name, 'with variables:', variables);
      
      for (const variable of variables) {
        if (!variable.key || !variable.name) continue;

        console.log('Processing library variable:', {
          name: variable.name,
          key: variable.key,
          resolvedType: variable.resolvedType
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
            value: {},  // Library variables don't expose values directly
            isAlias: false
          },
          aliases: []
        };

        // Also store it with the VariableID: prefix since that's how it might be referenced
        const prefixedId = `VariableID:${variableId}`;
        variableMap[prefixedId] = variableMap[variableId];

        console.log('Stored library variable:', {
          original: variableMap[variableId],
          prefixed: variableMap[prefixedId]
        });
      }
    } catch (error) {
      console.error(`Error processing library collection ${collection.key}:`, error);
    }
  }
}

// Helper function to check if a value is a variable alias
function isVariableAlias(value: any): boolean {
  return value && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS';
}

// Helper function to type check variable value
function isVariableAliasValue(value: any): value is VariableAliasValue {
  return value && typeof value === 'object' && 'type' in value && 'id' in value && value.type === 'VARIABLE_ALIAS';
}

// Helper function to get variable name
function getVariableName(variableId: string): string {
  const varData = variableMap[variableId];
  if (!varData?.variable) return 'Unknown';
  // return `${varData.variable.name}`;
  return `${varData.variable.collectionName}/${varData.variable.name}`;
}

// Helper function to get resolved variable value
function getVariableValue(variableId: string): any {
  const varData = variableMap[variableId];
  if (!varData?.variable) return null;

  // If it's an alias, get the parent's value
  if (varData.variable.isAlias && varData.variable.parentId) {
    return getVariableValue(varData.variable.parentId);
  }

  return varData.variable.value;
}

// Call initialize when plugin starts
initialize();

// Handle messages from the UI
figma.ui.onmessage = async (msg: { type: string; options?: ScanOptions }) => {
  if (msg.type === 'scan-variables') {
    const options = msg.options || { scanColors: true, scanText: true, scanResponsive: true };
    
    // Check if user has selected any frames
    if (figma.currentPage.selection.length === 0) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Please select at least one frame to scan'
      });
      return;
    }

    // Get all variables from the document
    const allVariableCollections = await figma.variables.getLocalVariableCollectionsAsync();
    
    // Scan selected nodes
    const results: VariableUsageResult[] = [];
    
    for (const node of figma.currentPage.selection) {
      await scanNode(node, allVariableCollections, options, results);
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
          console.log(`    ${v.type} - ${v.property}: "${v.variableName}" (${v.value || 'no value'})`);
        }
      }
      
      // Show missing variables
      if (result.missingVariables.length > 0) {
        console.log('  MISSING VARIABLES:', result.missingVariables.length);
        for (const v of result.missingVariables) {
          console.log(`    ${v.type} - ${v.property}: ${v.value || 'no value'}`);
        }
      }
    }
    
    // Send results back to UI
    figma.ui.postMessage({
      type: 'scan-results',
      results: results,
      hasSuggestions: results.some(r => r.hasOwnProperty('suggestions'))
    });
  } else if (msg.type === 'apply-variable-suggestion') {
    try {
      // Get the node by ID
      const node = figma.getNodeById(msg.nodeId);
      if (!node) {
        figma.ui.postMessage({
          type: 'variable-applied',
          success: false,
          error: 'Node not found'
        });
        return;
      }

      // Get the variable by ID
      const variable = await figma.variables.getVariableByIdAsync(msg.variableId);
      if (!variable) {
        figma.ui.postMessage({
          type: 'variable-applied',
          success: false,
          error: 'Variable not found'
        });
        return;
      }

      // Apply the variable to the property
      try {
        // Different property paths require different binding approaches
        if (msg.property.includes('fill') || msg.property === 'fills') {
          // For fill properties
          await applyFillVariable(node, variable);
        } else if (msg.property.includes('stroke') || msg.property === 'strokes') {
          // For stroke properties
          await applyStrokeVariable(node, variable);
        } else if (msg.property === 'fontSize' || msg.property === 'fontWeight') {
          // For text properties
          await applyTextVariable(node, variable, msg.property);
        } else if (msg.property.includes('padding') || msg.property.includes('spacing') || 
                  msg.property === 'width' || msg.property === 'height') {
          // For size/spacing properties
          await applySpacingVariable(node, variable, msg.property);
        } else {
          // Generic property binding attempt
          await applyGenericVariable(node, variable, msg.property);
        }

        // Send success message
        figma.ui.postMessage({
          type: 'variable-applied',
          success: true,
          variableName: variable.name
        });

        // Add the variable to the "used" list for this node
        const result = results.find(r => r.nodeId === msg.nodeId);
        if (result) {
          const variableName = await formatVariableName(variable);
          result.hasVariables.push({
            type: variable.resolvedType as VariableType,
            property: msg.property,
            variableName: variableName
          });

          // Remove from missing variables if it exists
          result.missingVariables = result.missingVariables.filter(mv => 
            mv.property !== msg.property
          );

          // Update the UI with the modified results
          figma.ui.postMessage({
            type: 'scan-results',
            results: results,
            hasSuggestions: results.some(r => r.hasOwnProperty('suggestions'))
          });
        }
      } catch (error) {
        console.error('Error applying variable:', error);
        figma.ui.postMessage({
          type: 'variable-applied',
          success: false,
          error: 'Failed to apply variable: ' + error.message
        });
      }
    } catch (error) {
      console.error('Error in apply-variable-suggestion:', error);
      figma.ui.postMessage({
        type: 'variable-applied',
        success: false,
        error: 'An unexpected error occurred'
      });
    }
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};

// Helper functions for applying variables to different properties

async function applyFillVariable(node: SceneNode, variable: Variable): Promise<void> {
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    // Get the first fill
    const fills = [...node.fills];
    const firstFill = {...fills[0]};
    
    if (firstFill.type === 'SOLID') {
      // Bind the variable to the fill color
      node.setBoundVariable('fills', variable.id, ['0', 'color']);
    }
  }
}

async function applyStrokeVariable(node: SceneNode, variable: Variable): Promise<void> {
  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
    // Get the first stroke
    const strokes = [...node.strokes];
    const firstStroke = {...strokes[0]};
    
    if (firstStroke.type === 'SOLID') {
      // Bind the variable to the stroke color
      node.setBoundVariable('strokes', variable.id, ['0', 'color']);
    }
  }
}

async function applyTextVariable(node: SceneNode, variable: Variable, property: string): Promise<void> {
  if (node.type === 'TEXT') {
    if (property === 'fontSize') {
      node.setBoundVariable('fontSize', variable.id);
    } else if (property === 'fontWeight') {
      // Assuming fontWeight is supported for binding
      node.setBoundVariable('fontWeight', variable.id);
    }
  }
}

async function applySpacingVariable(node: SceneNode, variable: Variable, property: string): Promise<void> {
  if (property === 'width' && 'width' in node) {
    node.setBoundVariable('width', variable.id);
  } else if (property === 'height' && 'height' in node) {
    node.setBoundVariable('height', variable.id);
  } else if (property.includes('padding') && 'paddingLeft' in node) {
    // For auto layout frames with padding
    if (property === 'paddingLeft' || property === 'padding') {
      node.setBoundVariable('paddingLeft', variable.id);
    }
    if (property === 'paddingRight' || property === 'padding') {
      node.setBoundVariable('paddingRight', variable.id);
    }
    if (property === 'paddingTop' || property === 'padding') {
      node.setBoundVariable('paddingTop', variable.id);
    }
    if (property === 'paddingBottom' || property === 'padding') {
      node.setBoundVariable('paddingBottom', variable.id);
    }
  } else if (property.includes('spacing') && 'itemSpacing' in node) {
    node.setBoundVariable('itemSpacing', variable.id);
  }
}

async function applyGenericVariable(node: SceneNode, variable: Variable, property: string): Promise<void> {
  // Try a generic approach to bind the variable
  // This might fail for properties that don't support variable binding
  try {
    // @ts-ignore - We're trying a generic approach
    node.setBoundVariable(property, variable.id);
  } catch (error) {
    throw new Error(`Cannot bind variable to property "${property}"`);
  }
}

// Helper function to get bound variable from a node
async function getBoundVariable(node: SceneNode, property: string): Promise<Variable | VariableAlias | null> {
  if (!node.boundVariables) return null;
  
  // First try exact property match
  const boundVariable = (node.boundVariables as any)[property];
  if (boundVariable) {
    console.log('Found exact property match:', boundVariable);
    return boundVariable;
  }

  // Then try pattern matching
  for (const key of Object.keys(node.boundVariables)) {
    if (key.startsWith(property)) {
      console.log('Found property pattern match:', key, (node.boundVariables as any)[key]);
      return (node.boundVariables as any)[key];
    }
  }
  
  return null;
}

// Helper function to format variable name to string, using stored variables
async function formatVariableName(
  variable: Variable | VariableAlias | null | Array<any>
): Promise<string> {
  if (!variable) {
    console.log('formatVariableName: Received null variable.');
    return 'Unknown (null)';
  }
  
  console.log('formatVariableName: Processing variable object:', JSON.stringify(variable, null, 2));

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
  let variableId: string | null = null;
  
  // Case 1: Variable Alias (object with type: 'VARIABLE_ALIAS' and id)
  if (typeof variable === 'object' && 'type' in variable && variable.type === 'VARIABLE_ALIAS' && 'id' in variable) {
    variableId = variable.id;
    console.log(`formatVariableName: Identified as Alias. Target ID: ${variableId}`);
  } 
  // Case 2: Direct Variable Reference (object with variableId)
  else if (typeof variable === 'object' && 'variableId' in variable) {
    variableId = String(variable.variableId);
    console.log(`formatVariableName: Identified as Direct Reference (variableId). Target ID: ${variableId}`);
  }
  // Case 3: Direct Variable Object (object with id, but not an alias)
  else if (typeof variable === 'object' && 'id' in variable && (!('type' in variable) || variable.type !== 'VARIABLE_ALIAS')) {
    variableId = String(variable.id);
    console.log(`formatVariableName: Identified as Direct Variable Object (id). Target ID: ${variableId}`);
  }
  // Case 4: Simple string ID
  else if (typeof variable === 'string') {
    variableId = variable;
    console.log(`formatVariableName: Received raw string ID. Target ID: ${variableId}`);
  }

  if (!variableId) {
    console.log('formatVariableName: Could not extract a usable ID from variable object:', JSON.stringify(variable, null, 2));
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
    const variableObj = await figma.variables.getVariableByIdAsync(cleanId);
    
    if (variableObj) {
      // Return just the variable name without the collection name
      console.log(`formatVariableName: Successfully retrieved variable: ${variableObj.name}`);
      return variableObj.name;
    } else {
      // If the variable isn't found, try the map as fallback
      const mapEntry = variableMap[cleanId];
      if (mapEntry?.variable) {
        const varData = mapEntry.variable;
        // Return just the variable name
        console.log(`formatVariableName: Found match in variableMap fallback with ID '${cleanId}'. Resolved name: ${varData.name}`);
        return varData.name;
      }
      
      // Try with the original ID as fallback
      const mapEntryOriginal = variableMap[variableId];
      if (mapEntryOriginal?.variable) {
        const varData = mapEntryOriginal.variable;
        // Return just the variable name
        console.log(`formatVariableName: Found match in variableMap fallback with original ID. Resolved name: ${varData.name}`);
        return varData.name;
      }
    }
    
    // If all else fails, return the ID
    console.log(`formatVariableName: Could not find variable. Returning ID: ${cleanId}`);
    return `Unknown (ID: ${cleanId.substring(0, 8)}...)`;
  } catch (error) {
    console.error('Error retrieving variable:', error);
    return `Error (ID: ${variableId.substring(0, 8)}...)`;
  }
}

// Interface to represent a variable suggestion
interface VariableSuggestion {
  property: string;
  value: string;
  suggestedVariables: {
    name: string;
    id: string;
    confidence: number; // 0-100 score indicating confidence level
  }[];
}

// Function to get variable suggestions for missing variables
async function getSuggestionForMissingVariables(missingVariables: {
  type: VariableType;
  property: string;
  value?: string;
}[]): Promise<VariableSuggestion[]> {
  const suggestions: VariableSuggestion[] = [];

  for (const missingVar of missingVariables) {
    if (!missingVar.value) continue;

    const suggestion: VariableSuggestion = {
      property: missingVar.property,
      value: missingVar.value,
      suggestedVariables: []
    };

    // Handle color suggestions
    if (missingVar.type === 'COLOR' && missingVar.value) {
      suggestion.suggestedVariables = await findSimilarColorVariables(missingVar.value);
    } 
    // Handle text suggestions
    else if (missingVar.type === 'TEXT' && missingVar.value) {
      suggestion.suggestedVariables = findSimilarTextVariables(missingVar.value);
    }
    // Handle responsive suggestions
    else if (missingVar.type === 'RESPONSIVE' && missingVar.value) {
      suggestion.suggestedVariables = findSimilarResponsiveVariables(missingVar.value);
    }

    if (suggestion.suggestedVariables.length > 0) {
      suggestions.push(suggestion);
    }
  }

  return suggestions;
}

// Find similar color variables
async function findSimilarColorVariables(colorValue: string): Promise<{ name: string; id: string; confidence: number }[]> {
  const suggestions: { name: string; id: string; confidence: number }[] = [];
  
  // Convert hex to RGB if needed
  let targetColor = colorValue;
  if (colorValue.startsWith('#')) {
    // Convert hex to RGB
    const r = parseInt(colorValue.slice(1, 3), 16) / 255;
    const g = parseInt(colorValue.slice(3, 5), 16) / 255;
    const b = parseInt(colorValue.slice(5, 7), 16) / 255;
    targetColor = `rgba(${r}, ${g}, ${b}, 1)`;
  }

  // Iterate through all stored color variables
  for (const [varId, varEntry] of Object.entries(variableMap)) {
    const variable = varEntry.variable;
    
    if (!variable || variable.resolvedType !== 'COLOR') continue;
    
    const value = variable.value;
    // Skip if it's an alias
    if (isVariableAlias(value)) continue;

    // Calculate color similarity
    let confidence = 0;
    
    if (typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
      const colorObj = value as ColorValue;
      
      // Simple color distance calculation (Euclidean distance in RGB space)
      let targetR = 0, targetG = 0, targetB = 0;
      
      // Parse the target color
      if (targetColor.startsWith('rgba(')) {
        const parts = targetColor.substring(5, targetColor.length - 1).split(',');
        targetR = parseFloat(parts[0]);
        targetG = parseFloat(parts[1]);
        targetB = parseFloat(parts[2]);
      }
      
      // Calculate distance (0-1 scale for each component)
      const distance = Math.sqrt(
        Math.pow(targetR - colorObj.r, 2) + 
        Math.pow(targetG - colorObj.g, 2) + 
        Math.pow(targetB - colorObj.b, 2)
      );
      
      // Convert distance to confidence (closer = higher confidence)
      // Distance range: 0 (identical) to 1.732 (max distance in RGB space)
      confidence = Math.max(0, 100 - (distance * 100 / 1.732));
      
      // Only include if confidence is above threshold
      if (confidence > 50) {
        suggestions.push({
          name: variable.name,
          id: variable.id,
          confidence: Math.round(confidence)
        });
      }
    }
  }
  
  // Sort by confidence (highest first)
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// Find similar text variables
function findSimilarTextVariables(textValue: string): { name: string; id: string; confidence: number }[] {
  const suggestions: { name: string; id: string; confidence: number }[] = [];
  
  // Iterate through all stored text variables
  for (const [varId, varEntry] of Object.entries(variableMap)) {
    const variable = varEntry.variable;
    
    if (!variable || variable.resolvedType !== 'STRING') continue;
    
    const value = variable.value;
    if (isVariableAlias(value)) continue;
    
    // Calculate text similarity (for now, using a string comparison approach)
    let confidence = 0;
    
    if (typeof value === 'string') {
      // Pattern-based comparison
      // If variable name contains keywords like "heading", "body", "caption", etc.
      // try to match them with the style of the text node
      
      const varName = variable.name.toLowerCase();
      const textLower = textValue.toLowerCase();
      
      // Check for name pattern matches
      if (
        (varName.includes('heading') && textValue.length < 50) ||
        (varName.includes('body') && textValue.length > 20) ||
        (varName.includes('caption') && textValue.length < 100)
      ) {
        confidence = 60; // Base confidence for pattern match
      }
      
      // Check for partial content matches
      if (value.includes(textValue) || textValue.includes(value)) {
        confidence += 20;
      }
      
      // Check for font style keywords
      const fontStyleKeywords = ['bold', 'medium', 'light', 'regular', 'italic'];
      for (const keyword of fontStyleKeywords) {
        if (varName.includes(keyword)) {
          confidence += 10;
          break;
        }
      }
      
      if (confidence > 50) {
        suggestions.push({
          name: variable.name,
          id: variable.id,
          confidence: Math.min(100, Math.round(confidence))
        });
      }
    }
  }
  
  // Sort by confidence (highest first)
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// Find similar responsive variables
function findSimilarResponsiveVariables(value: string): { name: string; id: string; confidence: number }[] {
  const suggestions: { name: string; id: string; confidence: number }[] = [];
  
  // Iterate through all stored responsive variables
  for (const [varId, varEntry] of Object.entries(variableMap)) {
    const variable = varEntry.variable;
    
    if (!variable || variable.resolvedType !== 'FLOAT') continue;
    
    const varValue = variable.value;
    if (isVariableAlias(varValue)) continue;
    
    // Pattern matching for spacing, sizing variables
    let confidence = 0;
    const varName = variable.name.toLowerCase();
    
    // Extract numeric value if possible
    let numericValue = 0;
    if (typeof value === 'string') {
      const match = value.match(/(\d+)/);
      if (match) {
        numericValue = parseInt(match[1]);
      }
    }
    
    // Extract variable numeric value
    let varNumericValue = 0;
    if (typeof varValue === 'number') {
      varNumericValue = varValue;
    }
    
    // Compare values
    if (numericValue > 0 && varNumericValue > 0) {
      // Calculate similarity based on value proximity
      const ratio = numericValue / varNumericValue;
      if (ratio >= 0.8 && ratio <= 1.2) {
        // Values are within 20% of each other
        confidence = 100 - (Math.abs(ratio - 1) * 100);
      }
    }
    
    // Pattern matching based on common naming conventions
    const sizePatterns = [
      { pattern: 'spacing', keywords: ['margin', 'padding', 'gap'] },
      { pattern: 'radius', keywords: ['corner', 'rounded', 'border-radius'] },
      { pattern: 'size', keywords: ['width', 'height', 'size'] }
    ];
    
    for (const {pattern, keywords} of sizePatterns) {
      if (varName.includes(pattern)) {
        for (const keyword of keywords) {
          if (value.toLowerCase().includes(keyword)) {
            confidence += 15;
            break;
          }
        }
      }
    }
    
    if (confidence > 50) {
      suggestions.push({
        name: variable.name,
        id: variable.id,
        confidence: Math.min(100, Math.round(confidence))
      });
    }
  }
  
  // Sort by confidence (highest first)
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// Recursive function to scan nodes for variable usage
async function scanNode(
  node: SceneNode,
  allVariableCollections: VariableCollection[],
  options: ScanOptions,
  results: VariableUsageResult[]
): Promise<void> {
  // Skip hidden nodes
  if ('visible' in node && !node.visible) return;
  
  const nodeResult: VariableUsageResult = {
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    missingVariables: [],
    hasVariables: []
  };

  // Check for color variables
  if (options.scanColors && ('fills' in node || 'strokes' in node)) {
      await checkForColorVariables(
          node as SceneNode & { fills?: readonly Paint[] | PluginAPI['mixed'], strokes?: readonly Paint[] | PluginAPI['mixed'] },
          nodeResult,
          // allVariableCollections // Pass if needed by called function
      );
  }


  // Check for text variables
  if (options.scanText && node.type === 'TEXT') {
    await checkForTextVariables(node as TextNode, nodeResult /*, allVariableCollections*/);
  }

  // Check for responsive variables (width, height, padding)
  if (options.scanResponsive) {
    // Check properties that might have responsive variables
    const responsiveProps: (keyof SceneNode)[] = ['width', 'height', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'itemSpacing', 'horizontalPadding', 'verticalPadding'];
    let hasResponsiveProps = false;
    for (const prop of responsiveProps) {
        if (prop in node) {
            hasResponsiveProps = true;
            break;
        }
    }

    if (hasResponsiveProps) {
        await checkForResponsiveVariables(
            node as SceneNode, // Cast as base SceneNode, specific checks happen inside
            nodeResult
            // allVariableCollections // Pass if needed by called function
        );
    }
  }


  // Add to results if we found missing or used variables
  if (nodeResult.missingVariables.length > 0 || nodeResult.hasVariables.length > 0) {
    results.push(nodeResult);
  }

  // After the existing scan logic completes, add suggestions for missing variables
  const result = results.find(r => r.nodeId === node.id);
  
  if (result && result.missingVariables.length > 0) {
    // Get suggestions for missing variables
    const suggestions = await getSuggestionForMissingVariables(result.missingVariables);
    
    // Add suggestions to the result
    if (suggestions.length > 0) {
      // @ts-ignore - Add suggestions property to the result
      result.suggestions = suggestions;
    }
  }

  // Recursively scan children if node is a parent
  if ('children' in node && node.children) {
    for (const child of node.children) {
      await scanNode(child, allVariableCollections, options, results); // Pass collections down
    }
  }
}

// Function to check for color variables
async function checkForColorVariables(
  node: SceneNode & { fills?: readonly Paint[] | PluginAPI['mixed'], strokes?: readonly Paint[] | PluginAPI['mixed'] },
  result: VariableUsageResult
): Promise<void> {
  
  // Check fill properties
  if (node.fills && node.fills !== figma.mixed && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
          if (fill.type === 'SOLID') {
              const boundVariable = await getBoundVariable(node, `fills[${node.fills.indexOf(fill)}]`); // Try specific index binding
              if (boundVariable) {
                  const variableName = await formatVariableName(boundVariable);
                  result.hasVariables.push({
                      type: 'COLOR',
                      property: 'fill',
                      variableName: variableName,
                      value: fill.color ? `RGB(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)})` : 'Unknown'
                  });
              } else {
                   const generalFillBoundVar = await getBoundVariable(node, 'fills'); // Check general fills binding
                   if (!generalFillBoundVar) { // Only add missing if no general or specific binding found
                       result.missingVariables.push({
                           type: 'COLOR',
                           property: 'fill',
                           value: fill.color ? `RGB(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)})` : 'Unknown'
                       });
                   } else {
                        // Show actual color value for general binding
                        const variableName = await formatVariableName(generalFillBoundVar);
                        // Avoid duplicates if multiple fills use the same general binding
                        if (!result.hasVariables.some(v => v.property === 'fill' && v.variableName === variableName)) {
                            // Extract the fill's actual color value
                            const colorValue = fill.color 
                              ? `RGB(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)})` 
                              : 'Unknown';
                            
                            result.hasVariables.push({
                                type: 'COLOR',
                                property: 'fill',
                                variableName: variableName,
                                value: colorValue // Show actual color value instead of "Bound (General)"
                            });
                        }
                   }
              }
          }
      }
  }

  // Check stroke properties
  if (node.strokes && node.strokes !== figma.mixed && Array.isArray(node.strokes)) {
      for (const stroke of node.strokes) {
          if (stroke.type === 'SOLID') {
              const boundVariable = await getBoundVariable(node, `strokes[${node.strokes.indexOf(stroke)}]`); // Try specific index
              if (boundVariable) {
                  const variableName = await formatVariableName(boundVariable);
                  result.hasVariables.push({
                      type: 'COLOR',
                      property: 'stroke',
                      variableName: variableName,
                      value: stroke.color ? `RGB(${Math.round(stroke.color.r * 255)}, ${Math.round(stroke.color.g * 255)}, ${Math.round(stroke.color.b * 255)})` : 'Unknown'
                  });
              } else {
                  const generalStrokeBoundVar = await getBoundVariable(node, 'strokes'); // Check general strokes binding
                  if (!generalStrokeBoundVar) { // Only add missing if no general or specific binding found
                      result.missingVariables.push({
                          type: 'COLOR',
                          property: 'stroke',
                          value: stroke.color ? `RGB(${Math.round(stroke.color.r * 255)}, ${Math.round(stroke.color.g * 255)}, ${Math.round(stroke.color.b * 255)})` : 'Unknown'
                      });
                  } else {
                        const variableName = await formatVariableName(generalStrokeBoundVar);
                        if (!result.hasVariables.some(v => v.property === 'stroke' && v.variableName === variableName)) {
                            // Extract the stroke's actual color value
                            const colorValue = stroke.color 
                              ? `RGB(${Math.round(stroke.color.r * 255)}, ${Math.round(stroke.color.g * 255)}, ${Math.round(stroke.color.b * 255)})` 
                              : 'Unknown';
                            
                            result.hasVariables.push({
                                type: 'COLOR',
                                property: 'stroke',
                                variableName: variableName,
                                value: colorValue // Show actual color value instead of "Bound (General)"
                            });
                        }
                  }
              }
          }
      }
  }
}

// Function to check for text variables
async function checkForTextVariables(
  node: TextNode, 
  result: VariableUsageResult
  // allVariableCollections: VariableCollection[] // Removed
): Promise<void> {
  // Check font size
  const fontSizeVariable = await getBoundVariable(node, 'fontSize');
  if (fontSizeVariable) {
    result.hasVariables.push({
      type: 'TEXT',
      property: 'fontSize',
      variableName: await formatVariableName(fontSizeVariable),
      value: typeof node.fontSize === 'number' ? `${node.fontSize}px` : 'Mixed/Unknown'
    });
  } else if (node.fontSize !== figma.mixed) { // Only report missing if not mixed
    result.missingVariables.push({
      type: 'TEXT',
      property: 'fontSize',
      value: typeof node.fontSize === 'number' ? `${node.fontSize}px` : 'Mixed/Unknown'
    });
  }
  
  // Check line height
  const lineHeightVariable = await getBoundVariable(node, 'lineHeight');
   let lineHeightValue = 'Auto'; // Default for Figma
    if (node.lineHeight !== figma.mixed) {
        if (typeof node.lineHeight === 'object') {
            if ('value' in node.lineHeight) {
                 const lh = node.lineHeight as { value: number; unit: string };
                 lineHeightValue = lh.unit === 'PIXELS' ? `${lh.value}px` : `${lh.value}%`;
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
      variableName: await formatVariableName(lineHeightVariable),
      value: lineHeightValue
    });
  } else if (node.lineHeight !== figma.mixed) { // Only report missing if not mixed
    result.missingVariables.push({
      type: 'TEXT',
      property: 'lineHeight',
      value: lineHeightValue
    });
  }

  // Add checks for other text properties if needed (e.g., letterSpacing, paragraphSpacing)
  // Example for letterSpacing:
   const letterSpacingVariable = await getBoundVariable(node, 'letterSpacing');
   let letterSpacingValue = '0'; // Default assumption
    if (node.letterSpacing !== figma.mixed && typeof node.letterSpacing === 'object' && 'value' in node.letterSpacing) {
         const ls = node.letterSpacing as { value: number; unit: string };
         letterSpacingValue = ls.unit === 'PIXELS' ? `${ls.value}px` : `${ls.value}%`;
    } else if (node.letterSpacing === figma.mixed) {
         letterSpacingValue = 'Mixed';
    }

   if (letterSpacingVariable) {
       result.hasVariables.push({
           type: 'TEXT',
           property: 'letterSpacing',
           variableName: await formatVariableName(letterSpacingVariable),
           value: letterSpacingValue
       });
   } else if (node.letterSpacing !== figma.mixed) {
        result.missingVariables.push({
           type: 'TEXT',
           property: 'letterSpacing',
           value: letterSpacingValue
       });
   }
}

// Function to check for responsive variables
async function checkForResponsiveVariables(
  node: SceneNode, 
  result: VariableUsageResult
): Promise<void> {
  
  // Use string array for property names without specifying they're keyof SceneNode
  const responsiveProps = [
    'width', 'height', 
    'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 
    'horizontalPadding', 'verticalPadding', 'itemSpacing'
  ];
  
  // Check each property that might be bound to a variable
  for (const propName of responsiveProps) {
    // @ts-ignore - Property access is validated at runtime
    if (propName in node) {
      // @ts-ignore - Using any to bypass type checking
      const value = (node as any)[propName];
      if (value === figma.mixed) continue; // Skip mixed values

      const boundVariable = await getBoundVariable(node, propName);
      let displayValue = 'Unknown';

      if (typeof value === 'number') {
          displayValue = `${Math.round(value)}px`;
      } else if (typeof value === 'object' && value !== null && 'value' in value && 'unit' in value) {
          // Handle complex values like padding with units if necessary
          displayValue = `${value.value}${value.unit === 'PERCENT' ? '%' : 'px'}`;
      } else if (typeof value === 'string') {
          // Handle string values if applicable
          displayValue = value;
      }

      if (boundVariable) {
          const variableName = await formatVariableName(boundVariable);
          result.hasVariables.push({
              type: 'RESPONSIVE',
              property: propName,
              variableName: variableName,
              value: displayValue
          });
      } else {
           result.missingVariables.push({
              type: 'RESPONSIVE',
              property: propName,
              value: displayValue
          });
      }
    }
  }
} 