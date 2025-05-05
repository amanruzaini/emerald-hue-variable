// Value Comparison Utilities
// This file contains functions for comparing values, including colors and numbers,
// for both exact matches and proximity comparisons

import { PublishedVariable } from './variables-utils';

// Constants
export const COLOR_PROXIMITY_THRESHOLD = 20; // Delta E threshold for colors
export const NUMBER_PROXIMITY_THRESHOLD = 1.0; // Threshold for number matching

// Type for a color in RGB space (0-255 range)
export interface RGB {
  r: number;
  g: number;
  b: number;
}

// Type for a Figma color (0-1 range)
export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

// Type for a color in CIELAB space
interface LAB {
  l: number;
  a: number;
  b: number;
}

// Type for a color in XYZ space
interface XYZ {
  x: number;
  y: number;
  z: number;
}

/**
 * Convert a Figma color (0-1 range) to RGB (0-255 range)
 */
export function figmaColorToRgb255(figmaColor: FigmaColor | null | undefined): RGB {
  if (!figmaColor || typeof figmaColor.r !== 'number' || 
      typeof figmaColor.g !== 'number' || typeof figmaColor.b !== 'number') {
    return { r: 0, g: 0, b: 0 }; // Return black for invalid inputs
  }
  
  return {
    r: Math.round(figmaColor.r * 255),
    g: Math.round(figmaColor.g * 255),
    b: Math.round(figmaColor.b * 255)
  };
}

/**
 * Convert RGB (0-255) to Figma color (0-1)
 */
export function rgb255ToFigmaColor(rgb: RGB): FigmaColor {
  return {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255
  };
}

/**
 * Compare two Figma colors for exact match (accounting for floating point inaccuracies)
 */
export function compareColors(color1: FigmaColor | null | undefined, color2: FigmaColor | null | undefined): boolean {
  if (!color1 || !color2) return false;
  
  // Compare with a small epsilon for floating point comparison
  const epsilon = 0.001;
  return (
    Math.abs(color1.r - color2.r) < epsilon &&
    Math.abs(color1.g - color2.g) < epsilon &&
    Math.abs(color1.b - color2.b) < epsilon &&
    // If alpha is defined in both, compare it; otherwise ignore
    (color1.a === undefined || color2.a === undefined || Math.abs(color1.a - color2.a) < epsilon)
  );
}

/**
 * Compare two numbers for exact match (accounting for floating point inaccuracies)
 */
export function compareNumbers(num1: number, num2: number): boolean {
  const epsilon = 0.001;
  return Math.abs(num1 - num2) < epsilon;
}

// --- Color Proximity Functions ---

/**
 * Convert RGB color to XYZ color space
 * Assumes sRGB color space
 */
export function rgbToXyz(r: number, g: number, b: number): XYZ {
  // Normalize RGB values to 0-1 range
  let rLinear = r / 255;
  let gLinear = g / 255;
  let bLinear = b / 255;
  
  // Apply sRGB gamma correction
  rLinear = rLinear > 0.04045 ? Math.pow((rLinear + 0.055) / 1.055, 2.4) : rLinear / 12.92;
  gLinear = gLinear > 0.04045 ? Math.pow((gLinear + 0.055) / 1.055, 2.4) : gLinear / 12.92;
  bLinear = bLinear > 0.04045 ? Math.pow((bLinear + 0.055) / 1.055, 2.4) : bLinear / 12.92;
  
  // Scale for D65 conversion
  rLinear *= 100;
  gLinear *= 100;
  bLinear *= 100;
  
  // Convert to XYZ (Observer = 2°, Illuminant = D65)
  const x = rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805;
  const y = rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722;
  const z = rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505;
  
  return { x, y, z };
}

/**
 * Convert XYZ color to LAB color space
 * Uses D65 reference white
 */
export function xyzToLab(x: number, y: number, z: number): LAB {
  // D65 reference white
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;
  
  // Normalize XYZ values
  let normX = x / refX;
  let normY = y / refY;
  let normZ = z / refZ;
  
  // Apply transformation
  normX = normX > 0.008856 ? Math.pow(normX, 1/3) : (7.787 * normX) + (16 / 116);
  normY = normY > 0.008856 ? Math.pow(normY, 1/3) : (7.787 * normY) + (16 / 116);
  normZ = normZ > 0.008856 ? Math.pow(normZ, 1/3) : (7.787 * normZ) + (16 / 116);
  
  // Calculate LAB components
  const l = (116 * normY) - 16;
  const a = 500 * (normX - normY);
  const b = 200 * (normY - normZ);
  
  return { l, a, b };
}

/**
 * Calculate the Delta E 2000 color difference between two LAB colors
 * This is a perceptual color difference metric
 */
export function deltaE2000(lab1: LAB, lab2: LAB): number {
  // Weighting factors
  const kL = 1, kC = 1, kH = 1;
  
  // Extract LAB components
  const L1 = lab1.l, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.l, a2 = lab2.a, b2 = lab2.b;
  
  // Calculate delta L prime (just the difference)
  const deltaL = L2 - L1;
  
  // Calculate C1, C2, C bar
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  
  // Calculate a prime values
  const C7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + Math.pow(25, 7))));
  const a1Prime = a1 * (1 + G);
  const a2Prime = a2 * (1 + G);
  
  // Calculate C prime values
  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
  const CbarPrime = (C1Prime + C2Prime) / 2;
  
  // Calculate h prime values (atan2 returns radians)
  let h1Prime = (Math.atan2(b1, a1Prime) * 180) / Math.PI;
  if (h1Prime < 0) h1Prime += 360;
  
  let h2Prime = (Math.atan2(b2, a2Prime) * 180) / Math.PI;
  if (h2Prime < 0) h2Prime += 360;
  
  // Calculate delta h prime
  let deltahPrime;
  const abs_h1h2 = Math.abs(h1Prime - h2Prime);
  
  if (C1Prime * C2Prime === 0) {
    deltahPrime = 0;
  } else if (abs_h1h2 <= 180) {
    deltahPrime = h2Prime - h1Prime;
  } else if (h2Prime <= h1Prime) {
    deltahPrime = h2Prime - h1Prime + 360;
  } else {
    deltahPrime = h2Prime - h1Prime - 360;
  }
  
  // Calculate delta H prime
  const deltaHPrime = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin((deltahPrime * Math.PI) / 360);
  
  // Calculate delta C prime
  const deltaCPrime = C2Prime - C1Prime;
  
  // Calculate CIEDE2000 components
  const Lbar = (L1 + L2) / 2;
  const Lbar50squared = Math.pow(Lbar - 50, 2);
  const SL = 1 + (0.015 * Lbar50squared) / Math.sqrt(20 + Lbar50squared);
  const SC = 1 + 0.045 * CbarPrime;
  
  let hbarPrime;
  if (C1Prime * C2Prime === 0) {
    hbarPrime = h1Prime + h2Prime;
  } else if (abs_h1h2 <= 180) {
    hbarPrime = (h1Prime + h2Prime) / 2;
  } else if (h1Prime + h2Prime < 360) {
    hbarPrime = (h1Prime + h2Prime + 360) / 2;
  } else {
    hbarPrime = (h1Prime + h2Prime - 360) / 2;
  }
  
  const T = 1 
    - 0.17 * Math.cos((hbarPrime - 30) * Math.PI / 180)
    + 0.24 * Math.cos((2 * hbarPrime) * Math.PI / 180)
    + 0.32 * Math.cos((3 * hbarPrime + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * hbarPrime - 63) * Math.PI / 180);
  
  const SH = 1 + 0.015 * CbarPrime * T;
  
  const deltaThetaRad = ((30 * Math.exp(-Math.pow((hbarPrime - 275) / 25, 2))) * Math.PI) / 180;
  const RC = 2 * Math.sqrt(Math.pow(CbarPrime, 7) / (Math.pow(CbarPrime, 7) + Math.pow(25, 7)));
  const RT = -1 * RC * Math.sin(2 * deltaThetaRad);
  
  // Calculate the final color difference
  const deltaE = Math.sqrt(
    Math.pow(deltaL / (kL * SL), 2) +
    Math.pow(deltaCPrime / (kC * SC), 2) +
    Math.pow(deltaHPrime / (kH * SH), 2) +
    RT * (deltaCPrime / (kC * SC)) * (deltaHPrime / (kH * SH))
  );
  
  return deltaE;
}

/**
 * Calculate the color difference between two RGB colors
 */
export function getColorDifference(rgb1: RGB, rgb2: RGB): number {
  // Convert to LAB color space
  const xyz1 = rgbToXyz(rgb1.r, rgb1.g, rgb1.b);
  const xyz2 = rgbToXyz(rgb2.r, rgb2.g, rgb2.b);
  
  const lab1 = xyzToLab(xyz1.x, xyz1.y, xyz1.z);
  const lab2 = xyzToLab(xyz2.x, xyz2.y, xyz2.z);
  
  // Calculate Delta E 2000
  return deltaE2000(lab1, lab2);
}

/**
 * Calculate the difference between two numbers
 */
export function getNumberDifference(num1: number, num2: number): number {
  return Math.abs(num1 - num2);
}

/**
 * Calculate a confidence score (0-1) based on the color difference
 * Lower difference = higher confidence
 */
export function calculateColorConfidence(difference: number): number {
  // 0 difference = 1.0 confidence
  // Threshold difference = 0.5 confidence
  // Beyond threshold = rapidly decreasing confidence
  if (difference <= 0) return 1.0;
  if (difference >= COLOR_PROXIMITY_THRESHOLD) return 0.0;
  
  // Linear drop from 1.0 to 0.5 for values in range [0, threshold]
  return 1.0 - (difference / COLOR_PROXIMITY_THRESHOLD) * 0.5;
}

/**
 * Calculate a confidence score (0-1) based on the number difference
 */
export function calculateNumberConfidence(difference: number, baseValue: number): number {
  // For numbers, we consider the difference relative to the value itself
  // Small numbers should have tighter tolerance
  
  // Use either the base value or 1.0 as the relative scale (avoid division by zero)
  const relativeScale = Math.max(Math.abs(baseValue), 1.0);
  
  // Calculate relative difference
  const relativeDifference = difference / relativeScale;
  
  // 0 difference = 1.0 confidence
  // 10% difference = 0.5 confidence
  // 20% difference or more = 0.0 confidence
  if (relativeDifference <= 0) return 1.0;
  if (relativeDifference >= 0.2) return 0.0;
  
  return 1.0 - relativeDifference * 5.0;
} 