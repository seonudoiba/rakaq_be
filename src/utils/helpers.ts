import { ParsedQs } from 'qs';

/**
 * Safely get a string from a parameter that could be string | string[] | ParsedQs
 */
export const getStringParam = (
  param: string | string[] | ParsedQs | (string | ParsedQs)[] | undefined
): string => {
  // Handle undefined or null
  if (param === undefined || param === null) {
    return '';
  }

  // Handle array
  if (Array.isArray(param)) {
    if (param.length === 0) return '';
    const first = param[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null) {
      const values = Object.values(first);
      if (values.length > 0 && typeof values[0] === 'string') {
        return values[0];
      }
    }
    return '';
  }

  // Handle string
  if (typeof param === 'string') {
    return param;
  }

  // Handle ParsedQs object
  if (typeof param === 'object' && param !== null) {
    const values = Object.values(param);
    if (values.length > 0 && typeof values[0] === 'string') {
      return values[0];
    }
    if (values.length > 0 && Array.isArray(values[0]) && typeof values[0][0] === 'string') {
      return values[0][0];
    }
    return '';
  }

  return '';
};

/**
 * Safely get a string from a parameter with a default value
 */
export const getStringParamOrDefault = (
  param: string | string[] | ParsedQs | (string | ParsedQs)[] | undefined,
  defaultValue: string = ''
): string => {
  const value = getStringParam(param);
  return value || defaultValue;
};

/**
 * Safely get a number from a parameter
 */
export const getNumberParam = (
  param: string | string[] | ParsedQs | (string | ParsedQs)[] | undefined,
  defaultValue: number = 0
): number => {
  const value = getStringParam(param);
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};



export const getBooleanParam = (param: any): boolean => {
  const value = getStringParam(param);
  return value === 'true' || value === '1' || value === 'yes';
};