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

type VariableUsageResult = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  missingVariables: {
    type: VariableType;
    property: string;
    value?: string;
  }[];
  hasVariables: {
    type: VariableType;
    property: string;
    variableName: string;
    value?: string;
  }[];
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
    
    // Send results back to UI
    figma.ui.postMessage({
      type: 'scan-results',
      results: results
    });
  } else if (msg.type === 'close') {
  figma.closePlugin();
  }
};

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
  variable: Variable | VariableAlias | null,
  collections: VariableCollection[]
): Promise<string> {
  if (!variable) {
    console.log('Variable is null');
    return 'Unknown';
  }
  
  try {
    console.log('Formatting variable:', {
      variable,
      type: typeof variable,
      hasType: 'type' in variable,
      hasId: 'id' in variable,
      hasName: 'name' in variable
    });

    // If it's an alias, get both ID and name if possible
    if ('type' in variable && variable.type === 'VARIABLE_ALIAS' && 'id' in variable) {
      const fullId = variable.id;
      console.log('Processing variable alias with full ID:', fullId);

      // Try different ID formats
      const possibleIds = [
        fullId,                                          // Full ID as is
        fullId.split('/')[0],                           // ID without the suffix
        fullId.replace('VariableID:', ''),              // ID without prefix
        fullId.split('/')[0].replace('VariableID:', '') // Clean ID
      ];

      console.log('Trying possible IDs:', possibleIds);

      // Try each possible ID format
      for (const id of possibleIds) {
        const mapVar = variableMap[id];
        if (mapVar?.variable) {
          const varData = mapVar.variable;
          console.log('Found in variable map with ID:', id, varData);
          return `${varData.name} (${varData.collectionName}) [${id}]`;
        }
      }

      // If not found in map, return the cleanest ID we have
      const cleanId = fullId.split('/')[0].replace('VariableID:', '');
      return `Variable [${cleanId}]`;
    }

    // For direct variables with variableId
    if ('variableId' in variable) {
      const variableId = String(variable.variableId);
      console.log('Processing direct variable with variableId:', variableId);
      
      const mapVar = variableMap[variableId] || variableMap[`VariableID:${variableId}`];
      if (mapVar?.variable) {
        const varData = mapVar.variable;
        return `${varData.name} (${varData.collectionName}) [${variableId}]`;
      }
      return `Variable [${variableId}]`;
    }

    // For variables with id
    if ('id' in variable && variable.id) {
      const id = String(variable.id);
      console.log('Processing variable with id:', id);
      
      const possibleIds = [
        id,
        id.split('/')[0],
        id.replace('VariableID:', ''),
        id.split('/')[0].replace('VariableID:', '')
      ];

      for (const possibleId of possibleIds) {
        const mapVar = variableMap[possibleId];
        if (mapVar?.variable) {
          const varData = mapVar.variable;
          return `${varData.name} (${varData.collectionName}) [${possibleId}]`;
        }
      }
      
      const cleanId = id.split('/')[0].replace('VariableID:', '');
      return `Variable [${cleanId}]`;
    }

    console.log('Could not find variable ID. Final variable state:', variable);
    return 'Unknown';
  } catch (error) {
    console.error('Error getting variable ID:', error);
    console.log('Variable that caused error:', variable);
    return 'Unknown';
  }
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
  if (options.scanColors && 'fills' in node) {
    await checkForColorVariables(node, nodeResult, allVariableCollections);
  }

  // Check for text variables
  if (options.scanText && node.type === 'TEXT') {
    await checkForTextVariables(node as TextNode, nodeResult, allVariableCollections);
  }

  // Check for responsive variables
  if (options.scanResponsive && 'width' in node && 'height' in node) {
    await checkForResponsiveVariables(
      node as SceneNode & { width: number | VariableAlias, height: number | VariableAlias }, 
      nodeResult, 
      allVariableCollections
    );
  }

  // Add to results if we found missing or used variables
  if (nodeResult.missingVariables.length > 0 || nodeResult.hasVariables.length > 0) {
    results.push(nodeResult);
  }

  // Recursively scan children if node is a parent
  if ('children' in node && node.children) {
    for (const child of node.children) {
      await scanNode(child, allVariableCollections, options, results);
    }
  }
}

// Function to check for color variables
async function checkForColorVariables(
  node: SceneNode & { fills?: readonly Paint[] | PluginAPI['mixed'] }, 
  result: VariableUsageResult,
  allVariableCollections: VariableCollection[]
): Promise<void> {
  if (!node.fills || node.fills === figma.mixed) return;

  console.log('Checking color variables for node:', node.name);
  console.log('Node fills:', node.fills);

  // Check fill properties
  for (const fill of node.fills as Paint[]) {
    if (fill.type === 'SOLID') {
      console.log('Checking solid fill:', fill);
      
      // Check if color is bound to a variable
      const boundVariable = await getBoundVariable(node, 'fills');
      console.log('Found bound variable for fills:', boundVariable);
      
      if (boundVariable) {
        const variableName = await formatVariableName(boundVariable, allVariableCollections);
        console.log('Formatted variable name:', variableName);
        
        result.hasVariables.push({
          type: 'COLOR',
          property: 'fill',
          variableName: variableName,
          value: fill.color ? 
            `RGB(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)})` : 
            'Unknown'
        });
      } else {
        result.missingVariables.push({
          type: 'COLOR',
          property: 'fill',
          value: fill.color ? 
            `RGB(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)})` : 
            'Unknown'
        });
      }
    }
  }
  
  // Check stroke properties if they exist
  if ('strokes' in node && node.strokes && Array.isArray(node.strokes)) {
    console.log('Checking strokes for node:', node.name);
    console.log('Node strokes:', node.strokes);
    
    for (const stroke of node.strokes as Paint[]) {
      if (stroke.type === 'SOLID') {
        console.log('Checking solid stroke:', stroke);
        
        const boundVariable = await getBoundVariable(node, 'strokes');
        console.log('Found bound variable for strokes:', boundVariable);
        
        if (boundVariable) {
          const variableName = await formatVariableName(boundVariable, allVariableCollections);
          console.log('Formatted variable name:', variableName);
          
          result.hasVariables.push({
            type: 'COLOR',
            property: 'stroke',
            variableName: variableName,
            value: stroke.color ? 
              `RGB(${Math.round(stroke.color.r * 255)}, ${Math.round(stroke.color.g * 255)}, ${Math.round(stroke.color.b * 255)})` : 
              'Unknown'
          });
        } else {
          result.missingVariables.push({
            type: 'COLOR',
            property: 'stroke',
            value: stroke.color ? 
              `RGB(${Math.round(stroke.color.r * 255)}, ${Math.round(stroke.color.g * 255)}, ${Math.round(stroke.color.b * 255)})` : 
              'Unknown'
          });
        }
      }
    }
  }
}

// Function to check for text variables
async function checkForTextVariables(
  node: TextNode, 
  result: VariableUsageResult,
  allVariableCollections: VariableCollection[]
): Promise<void> {
  // Check font size
  const fontSizeVariable = await getBoundVariable(node, 'fontSize');
  if (fontSizeVariable) {
    result.hasVariables.push({
      type: 'TEXT',
      property: 'fontSize',
      variableName: await formatVariableName(fontSizeVariable, allVariableCollections),
      value: String(node.fontSize) + 'px'
    });
  } else {
    result.missingVariables.push({
      type: 'TEXT',
      property: 'fontSize',
      value: String(node.fontSize) + 'px'
    });
  }
  
  // Check line height
  const lineHeightVariable = await getBoundVariable(node, 'lineHeight');
  if (lineHeightVariable) {
    let lineHeightValue = 'Unknown';
    if (typeof node.lineHeight === 'object' && 'value' in node.lineHeight) {
      const lineHeight = node.lineHeight as { value: number; unit: string };
      lineHeightValue = lineHeight.unit === 'PIXELS' 
        ? `${lineHeight.value}px` 
        : `${lineHeight.value}%`;
    }
    
    result.hasVariables.push({
      type: 'TEXT',
      property: 'lineHeight',
      variableName: await formatVariableName(lineHeightVariable, allVariableCollections),
      value: lineHeightValue
    });
  } else {
    let lineHeightValue = 'Unknown';
    if (typeof node.lineHeight === 'object' && 'value' in node.lineHeight) {
      const lineHeight = node.lineHeight as { value: number; unit: string };
      lineHeightValue = lineHeight.unit === 'PIXELS' 
        ? `${lineHeight.value}px` 
        : `${lineHeight.value}%`;
    }
    
    result.missingVariables.push({
      type: 'TEXT',
      property: 'lineHeight',
      value: lineHeightValue
    });
  }
}

// Function to check for responsive variables
async function checkForResponsiveVariables(
  node: SceneNode & { width: number | VariableAlias, height: number | VariableAlias }, 
  result: VariableUsageResult,
  allVariableCollections: VariableCollection[]
): Promise<void> {
  // Check width
  const widthVariable = await getBoundVariable(node, 'width');
  if (widthVariable) {
    console.log('Found width variable:', widthVariable); // Debug log
    const variableName = await formatVariableName(widthVariable, allVariableCollections);
    console.log('Formatted width variable name:', variableName); // Debug log
    
    result.hasVariables.push({
      type: 'RESPONSIVE',
      property: 'width',
      variableName: variableName,
      value: `${typeof node.width === 'number' ? Math.round(node.width) : 'Variable'}px`
    });
  } else {
    result.missingVariables.push({
      type: 'RESPONSIVE',
      property: 'width',
      value: `${typeof node.width === 'number' ? Math.round(node.width) : 'Variable'}px`
    });
  }
  
  // Check height
  const heightVariable = await getBoundVariable(node, 'height');
  if (heightVariable) {
    console.log('Found height variable:', heightVariable); // Debug log
    const variableName = await formatVariableName(heightVariable, allVariableCollections);
    console.log('Formatted height variable name:', variableName); // Debug log
    
    result.hasVariables.push({
      type: 'RESPONSIVE',
      property: 'height',
      variableName: variableName,
      value: `${typeof node.height === 'number' ? Math.round(node.height) : 'Variable'}px`
    });
  } else {
    result.missingVariables.push({
      type: 'RESPONSIVE',
      property: 'height',
      value: `${typeof node.height === 'number' ? Math.round(node.height) : 'Variable'}px`
    });
  }
  
  // Check for spacing/padding/margin if applicable
  if ('paddingLeft' in node) {
    const paddingVariable = await getBoundVariable(node, 'paddingLeft');
    if (paddingVariable) {
      console.log('Found padding variable:', paddingVariable); // Debug log
      const variableName = await formatVariableName(paddingVariable, allVariableCollections);
      console.log('Formatted padding variable name:', variableName); // Debug log
      
      result.hasVariables.push({
        type: 'RESPONSIVE',
        property: 'padding',
        variableName: variableName,
        value: `${node.paddingLeft}px`
      });
    } else {
      result.missingVariables.push({
        type: 'RESPONSIVE',
        property: 'padding',
        value: `${node.paddingLeft}px`
      });
    }
  }
} 