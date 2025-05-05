// Property to Variable Type Mapping
// This file defines the mapping between Figma node properties and the expected variable types

import { VariableType } from './variables-utils';

// Mapping of property names to their expected variable types
export const propertyToVariableType: Record<string, VariableType> = {
  // Color properties
  'fills': 'COLOR',
  'strokes': 'COLOR',
  'fill': 'COLOR',  
  'stroke': 'COLOR',
  'backgroundColor': 'COLOR',
  'effectsStyle': 'COLOR',
  'fillStyleId': 'COLOR',
  'strokeStyleId': 'COLOR',
  
  // Number properties
  'fontSize': 'NUMBER',
  'lineHeight': 'NUMBER',
  'letterSpacing': 'NUMBER',
  'paragraphSpacing': 'NUMBER',
  'paragraphIndent': 'NUMBER',
  'strokeWeight': 'NUMBER',
  'opacity': 'NUMBER',
  'cornerRadius': 'NUMBER',
  'cornerRadiusTL': 'NUMBER',
  'cornerRadiusTR': 'NUMBER',
  'cornerRadiusBL': 'NUMBER',
  'cornerRadiusBR': 'NUMBER',
  'width': 'NUMBER',
  'height': 'NUMBER',
  'x': 'NUMBER',
  'y': 'NUMBER',
  'rotation': 'NUMBER',
  'paddingLeft': 'NUMBER',
  'paddingRight': 'NUMBER',
  'paddingTop': 'NUMBER',
  'paddingBottom': 'NUMBER',
  'itemSpacing': 'NUMBER',
  'counterAxisSpacing': 'NUMBER',
  'horizontalPadding': 'NUMBER',
  'verticalPadding': 'NUMBER',
  
  // String properties
  'fontName': 'STRING',
  'textCase': 'STRING',
  'textDecoration': 'STRING',
  'textAlignHorizontal': 'STRING',
  'textAlignVertical': 'STRING',
  'textStyleId': 'STRING',
  'fontFamily': 'STRING',
  'fontWeight': 'STRING',
  'hyperlink': 'STRING',
  
  // Boolean properties
  'visible': 'BOOLEAN',
  'locked': 'BOOLEAN',
  'isMask': 'BOOLEAN',
  'constrainProportions': 'BOOLEAN',
  'layoutAlign': 'BOOLEAN',
  'layoutGrow': 'BOOLEAN',
  'clipsContent': 'BOOLEAN',
};

/**
 * Get the expected variable type for a given Figma property
 * @param propertyName The name of the Figma property
 * @returns The expected variable type, or null if unknown
 */
export function getPropertyExpectedVariableType(propertyName: string): VariableType | null {
  // Handle array notation like fills[0] - extract the base property name
  const baseProperty = propertyName.split('[')[0];
  return propertyToVariableType[baseProperty] || null;
}

/**
 * Check if a property typically accepts a color variable
 */
export function isColorProperty(propertyName: string): boolean {
  return getPropertyExpectedVariableType(propertyName) === 'COLOR';
}

/**
 * Check if a property typically accepts a numeric variable
 */
export function isNumberProperty(propertyName: string): boolean {
  return getPropertyExpectedVariableType(propertyName) === 'NUMBER';
}

/**
 * Check if a property typically accepts a string variable
 */
export function isStringProperty(propertyName: string): boolean {
  return getPropertyExpectedVariableType(propertyName) === 'STRING';
}

/**
 * Check if a property typically accepts a boolean variable
 */
export function isBooleanProperty(propertyName: string): boolean {
  return getPropertyExpectedVariableType(propertyName) === 'BOOLEAN';
} 