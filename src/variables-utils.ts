// Published Variables Utilities
// This file contains utilities for managing published variables data structure

// Type definitions
export type VariableType = 'COLOR' | 'NUMBER' | 'BOOLEAN' | 'STRING';

export interface PublishedVariable {
  id: string;              // The variable's unique ID
  name: string;            // The variable's display name
  collectionName: string;  // The collection this variable belongs to
  collectionId: string;    // The ID of the collection
  fullName: string;        // Full path name: collection/variable
  resolvedType: VariableType;  // The variable's type (COLOR, NUMBER, etc.)
  value: any;              // The variable's value (could be color object, number, etc.)
  isAlias: boolean;        // Whether this variable is an alias to another
  parentId?: string;       // For aliases, the ID of the parent variable
  figmaVariable?: Variable; // The original Figma variable object, if available
}

// Main data storage
export class VariablesStore {
  // Main storage map by variable ID
  private variablesById: Map<string, PublishedVariable> = new Map();
  
  // Secondary indexes for efficient lookup
  private variablesByType: Map<VariableType, PublishedVariable[]> = new Map();
  
  // For colors, a more efficient structure for color-matching
  private colorVariables: PublishedVariable[] = [];
  
  // For numerical values
  private numberVariables: PublishedVariable[] = [];
  
  constructor() {
    // Initialize type maps
    this.variablesByType.set('COLOR', []);
    this.variablesByType.set('NUMBER', []);
    this.variablesByType.set('BOOLEAN', []);
    this.variablesByType.set('STRING', []);
  }
  
  /**
   * Add a variable to the store
   */
  addVariable(variable: PublishedVariable): void {
    // Store by ID (primary index)
    this.variablesById.set(variable.id, variable);
    
    // Add to appropriate type array (secondary index)
    const typeArray = this.variablesByType.get(variable.resolvedType) || [];
    typeArray.push(variable);
    this.variablesByType.set(variable.resolvedType, typeArray);
    
    // Add to specialized collections for faster lookups
    if (variable.resolvedType === 'COLOR') {
      this.colorVariables.push(variable);
    } else if (variable.resolvedType === 'NUMBER') {
      this.numberVariables.push(variable);
    }
  }
  
  /**
   * Get all variables of a specific type
   */
  getVariablesByType(type: VariableType): PublishedVariable[] {
    return this.variablesByType.get(type) || [];
  }
  
  /**
   * Get all color variables for efficient color matching
   */
  getColorVariables(): PublishedVariable[] {
    return this.colorVariables;
  }
  
  /**
   * Get all number variables for efficient number matching
   */
  getNumberVariables(): PublishedVariable[] {
    return this.numberVariables;
  }
  
  /**
   * Get a variable by ID
   */
  getVariableById(id: string): PublishedVariable | undefined {
    return this.variablesById.get(id);
  }
  
  /**
   * Find a variable by exact value match (mainly for colors and numbers)
   */
  findVariableByExactValue(type: VariableType, value: any): PublishedVariable | undefined {
    const typeVariables = this.getVariablesByType(type);
    
    if (type === 'COLOR') {
      // For colors, we need special comparison
      if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
        return typeVariables.find(variable => {
          const varValue = variable.value;
          if (typeof varValue === 'object' && 'r' in varValue && 'g' in varValue && 'b' in varValue) {
            // Compare color values (accounting for small floating point differences)
            const rEqual = Math.abs(varValue.r - value.r) < 0.001;
            const gEqual = Math.abs(varValue.g - value.g) < 0.001;
            const bEqual = Math.abs(varValue.b - value.b) < 0.001;
            return rEqual && gEqual && bEqual;
          }
          return false;
        });
      }
    } else if (type === 'NUMBER') {
      // For numbers, allow a small tolerance
      if (typeof value === 'number') {
        return typeVariables.find(variable => {
          const varValue = variable.value;
          return typeof varValue === 'number' && Math.abs(varValue - value) < 0.001;
        });
      }
    } else {
      // For strings and booleans, exact match
      return typeVariables.find(variable => variable.value === value);
    }
    
    return undefined;
  }
  
  /**
   * Get the total number of variables
   */
  get size(): number {
    return this.variablesById.size;
  }
  
  /**
   * Convert the current Figma plugin's variableMap to our more efficient structure
   */
  static fromVariableMap(variableMap: Record<string, VariableMapEntry>): VariablesStore {
    const store = new VariablesStore();
    
    // Process all variables in the map
    for (const [id, entry] of Object.entries(variableMap)) {
      if (!entry.variable) continue; // Skip empty entries
      
      // Skip entries that are prefixed duplicates (VariableID: prefix)
      if (id.startsWith('VariableID:')) continue;
      
      const variable: PublishedVariable = {
        id: entry.variable.id,
        name: entry.variable.name,
        collectionName: entry.variable.collectionName,
        collectionId: entry.variable.collectionId,
        fullName: `${entry.variable.collectionName}/${entry.variable.name}`,
        resolvedType: entry.variable.resolvedType as VariableType,
        value: entry.variable.value,
        isAlias: entry.variable.isAlias,
        parentId: entry.variable.parentId,
      };
      
      store.addVariable(variable);
    }
    
    console.log(`Consolidated ${store.size} variables into optimized store`);
    return store;
  }
}

// Export a singleton instance
export const variablesStore = new VariablesStore(); 