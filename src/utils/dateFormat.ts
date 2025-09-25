import { format, parseISO, isValid } from 'date-fns';

/**
 * Date formatting utilities for WxCC API integration
 * 
 * WxCC API expects date format: yyyy-MM-dd'T'HH:mm (no seconds or milliseconds)
 * This utility ensures all dates sent to WxCC API conform to this format
 */

/**
 * Convert ISO string or Date to WxCC format: yyyy-MM-dd'T'HH:mm
 * @param dateInput - ISO string, Date object, or date-like string
 * @returns Formatted date string for WxCC API
 */
export const toWxccFormat = (dateInput: string | Date): string => {
  let date: Date;
  
  if (typeof dateInput === 'string') {
    // Handle ISO strings and other string formats
    date = parseISO(dateInput);
    
    // If parseISO fails, try new Date()
    if (!isValid(date)) {
      date = new Date(dateInput);
    }
  } else {
    date = dateInput;
  }
  
  if (!isValid(date)) {
    throw new Error(`Invalid date input: ${dateInput}`);
  }
  
  // Format to WxCC expected format: yyyy-MM-dd'T'HH:mm
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

/**
 * Convert ISO string to WxCC format safely with error handling
 * @param isoString - ISO date string
 * @param fallback - Optional fallback value if conversion fails
 * @returns WxCC formatted date or fallback
 */
export const safeToWxccFormat = (isoString: string, fallback?: string): string => {
  try {
    return toWxccFormat(isoString);
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
};

/**
 * Batch convert an object's date fields to WxCC format
 * @param obj - Object containing date fields
 * @param dateFields - Array of field names that contain dates
 * @returns New object with date fields converted to WxCC format
 */
export const convertObjectDatesToWxcc = <T extends Record<string, any>>(
  obj: T, 
  dateFields: (keyof T)[]
): T => {
  const converted = { ...obj };
  
  dateFields.forEach(field => {
    if (converted[field]) {
      converted[field] = toWxccFormat(converted[field] as string) as T[keyof T];
    }
  });
  
  return converted;
};

/**
 * Validate if a date string is in WxCC format
 * @param dateString - Date string to validate
 * @returns True if format matches WxCC requirements
 */
export const isWxccFormat = (dateString: string): boolean => {
  // WxCC format regex: yyyy-MM-dd'T'HH:mm
  const wxccFormatRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  return wxccFormatRegex.test(dateString);
};