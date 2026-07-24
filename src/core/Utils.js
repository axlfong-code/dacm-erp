/** Shared, side-effect free helpers. */
const Utils = Object.freeze({
  now: function() { return new Date(); },
  parseDate: function(value) {
    if (!value) return new Date();
    if (Object.prototype.toString.call(value) === '[object Date]') return value;
    var parts = String(value).trim().split('-');
    var date = parts.length === 3
      ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      : new Date(value);
    if (isNaN(date.getTime())) throw new Error('Format tanggal tidak valid.');
    return date;
  },
  formatDate: function(value, pattern) {
    if (!value) return '';
    return Utilities.formatDate(new Date(value), DATABASE.TIME_ZONE, pattern || APP.DATETIME_FORMAT);
  },
  isBlank: function(value) { return value === null || value === undefined || String(value).trim() === ''; },
  require: function(value, message) {
    if (this.isBlank(value)) throw new Error(message || 'Nilai wajib diisi.');
    return value;
  },
  pick: function(source, keys) {
    return keys.reduce(function(result, key) {
      if (Object.prototype.hasOwnProperty.call(source || {}, key)) result[key] = source[key];
      return result;
    }, {});
  },
  clone: function(value) { return JSON.parse(JSON.stringify(value)); },
  sanitizeForSheet: function(value) {
    if (value === null || value === undefined) return '';
    return value instanceof Date ? value : value;
  }
});
