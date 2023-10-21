// Note: these regexes should NOT be global. Otherwise there will be lastIndex issues

// Is this string made up of only numbers?
export const integerRegex = /^\d+$/;

// Is this field name path with an array index?
export const integerIndexRegex = /(\.\d+(\.|$))/;

// Is this a field name path with a hash standing in for an array index?
export const hashIndexRegex = /\.#(\.|$)/;
