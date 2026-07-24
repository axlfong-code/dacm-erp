/**
 * Spreadsheet database engine. All public methods receive a SCHEMA key
 * (for example `CUSTOMERS`), never a sheet name.
 */
const Database = (function() {
  function schemaFor(table) {
    var schema = SCHEMA[table];
    if (!schema) throw new Error('Tabel tidak ditemukan dalam SCHEMA: ' + table);
    return schema;
  }

  function spreadsheet() {
    var ss = APP.SPREADSHEET_ID ? SpreadsheetApp.openById(APP.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('Spreadsheet database tidak ditemukan. Isi APP.SPREADSHEET_ID di Config.gs atau buka script dari Google Sheet.');
    return ss;
  }

  function sheetFor(table) {
    var schema = schemaFor(table);
    var sheet = spreadsheet().getSheetByName(schema.sheet);
    if (!sheet) throw new Error('Sheet belum dibuat: ' + schema.sheet + '. Jalankan Database.createDatabase().');
    return sheet;
  }

  function cacheKey(table) { return 'dacm:table:' + table; }
  function clearCache(table) { CacheService.getScriptCache().remove(cacheKey(table)); }

  function rowsToObjects(schema, values) {
    return values.filter(function(row) { return row.some(function(cell) { return cell !== ''; }); })
      .map(function(row) {
        return schema.columns.reduce(function(record, column, index) {
          record[column] = row[index];
          return record;
        }, {});
      });
  }

  function recordToRow(schema, record) {
    return schema.columns.map(function(column) { return Utils.sanitizeForSheet(record[column]); });
  }

  function applyTableStyle(sheet, schema) {
    var header = sheet.getRange(DATABASE.HEADER_ROW, 1, 1, schema.columns.length);
    header.setValues([schema.columns]);
    header.setFontWeight('bold').setFontColor('#ffffff').setBackground('#1a73e8')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.setFrozenRows(DATABASE.HEADER_ROW);
    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), schema.columns.length).createFilter();
    sheet.autoResizeColumns(1, schema.columns.length);
    sheet.setRowHeight(1, 28);
  }

  function validateRecord(table, record, isUpdate) {
    var schema = schemaFor(table);
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Data harus berupa object.');
    var unknown = Object.keys(record).filter(function(key) { return schema.columns.indexOf(key) === -1; });
    if (unknown.length) throw new Error('Kolom tidak dikenal pada ' + table + ': ' + unknown.join(', '));
    if (!isUpdate && schema.primaryKey && Object.prototype.hasOwnProperty.call(record, schema.primaryKey)) {
      throw new Error(schema.primaryKey + ' dibuat otomatis dan tidak boleh dikirim saat insert.');
    }
  }

  function findRowNumber(table, id) {
    var schema = schemaFor(table);
    var sheet = sheetFor(table);
    if (sheet.getLastRow() <= 1) return 0;
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var index = values.findIndex(function(row) { return String(row[0]) === String(id); });
    return index < 0 ? 0 : index + 2;
  }

  function seedData() {
    if (findRowNumber('BRANCH', APP.DEFAULT_BRANCH) === 0) {
      insert('BRANCH', { BranchName: 'Dokter AC Mobil Pusat', Address: '', Phone: '', Status: 'ACTIVE' }, APP.DEFAULT_BRANCH);
    }
    Object.keys(ROLE).forEach(function(key) {
      var roleCode = ROLE[key];
      if (findRowNumber('ROLES', roleCode) === 0) insert('ROLES', { RoleName: roleCode.replace(/_/g, ' '), Description: '', Status: 'ACTIVE' }, roleCode);
    });
    if (!Database.query('USERS', { Username: 'admin' }).length) {
      insert('USERS', {
        Username: 'admin',
        Password: '123456',
        FullName: 'Administrator',
        Role: ROLE.OWNER,
        Branch: APP.DEFAULT_BRANCH,
        Status: 'ACTIVE'
      });
    }
  }

  function createDatabase() {
    var ss = spreadsheet();
    Object.keys(SCHEMA).forEach(function(table) {
      var schema = SCHEMA[table];
      var sheet = ss.getSheetByName(schema.sheet) || ss.insertSheet(schema.sheet);
      applyTableStyle(sheet, schema);
      clearCache(table);
    });
    seedData();
    SpreadsheetApp.flush();
    return { success: true, tables: Object.keys(SCHEMA).length };
  }

  function createTable(table) {
    var schema = schemaFor(table);
    var ss = spreadsheet();
    var sheet = ss.getSheetByName(schema.sheet) || ss.insertSheet(schema.sheet);
    applyTableStyle(sheet, schema);
    clearCache(table);
    return sheet.getName();
  }

  function all(table, options) {
    options = options || {};
    var schema = schemaFor(table);
    var cache = CacheService.getScriptCache();
    var cached = !options.noCache && cache.get(cacheKey(table));
    var records;
    if (cached) {
      records = JSON.parse(cached);
    } else {
      var sheet = sheetFor(table);
      records = sheet.getLastRow() <= 1 ? [] : rowsToObjects(schema, sheet.getRange(2, 1, sheet.getLastRow() - 1, schema.columns.length).getValues());
      if (!options.noCache) {
        var encoded = JSON.stringify(records);
        if (encoded.length < 90000) cache.put(cacheKey(table), encoded, DATABASE.CACHE_SECONDS);
      }
    }
    return records;
  }

  function findById(table, id) {
    var schema = schemaFor(table);
    return all(table).find(function(record) { return String(record[schema.primaryKey]) === String(id); }) || null;
  }

  function query(table, criteria) {
    criteria = criteria || {};
    return all(table).filter(function(record) {
      return Object.keys(criteria).every(function(key) {
        var expected = criteria[key];
        if (typeof expected === 'function') return expected(record[key], record);
        return String(record[key]) === String(expected);
      });
    });
  }

  function nextNumber(table) {
    var schema = schemaFor(table);
    if (!schema.prefix) throw new Error('Tabel ' + table + ' tidak memiliki prefix nomor.');
    var year = Utilities.formatDate(new Date(), DATABASE.TIME_ZONE, 'yyyy');
    var prefix = schema.prefix + '-' + year + '-';
    var max = all(table, { noCache: true }).reduce(function(highest, record) {
      var id = String(record[schema.primaryKey] || '');
      if (id.indexOf(prefix) !== 0) return highest;
      var sequence = Number(id.slice(prefix.length));
      return isNaN(sequence) ? highest : Math.max(highest, sequence);
    }, 0);
    return prefix + String(max + 1).padStart(5, '0');
  }

  function generateNumber(table) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try { return nextNumber(table); }
    finally { lock.releaseLock(); }
  }

  function insert(table, data, forcedId) {
    validateRecord(table, data, false);
    var schema = schemaFor(table);
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var record;
    try {
      record = Utils.pick(data, schema.columns);
      record[schema.primaryKey] = forcedId || (schema.prefix ? nextNumber(table) : Utils.require(data[schema.primaryKey], schema.primaryKey + ' wajib diisi.'));
      if (schema.columns.indexOf('CreatedAt') >= 0) record.CreatedAt = new Date();
      sheetFor(table).appendRow(recordToRow(schema, record));
      clearCache(table);
    } finally {
      lock.releaseLock();
    }
    Logger.log('INSERT', table, record[schema.primaryKey], record);
    return record;
  }

  function update(table, id, changes) {
    validateRecord(table, changes, true);
    var schema = schemaFor(table);
    if (Object.prototype.hasOwnProperty.call(changes, schema.primaryKey)) throw new Error('Primary key tidak dapat diubah.');
    var row = findRowNumber(table, id);
    if (!row) throw new Error('Data ' + table + ' dengan ID ' + id + ' tidak ditemukan.');
    var current = findById(table, id);
    var record = Object.assign({}, current, Utils.pick(changes, schema.columns));
    sheetFor(table).getRange(row, 1, 1, schema.columns.length).setValues([recordToRow(schema, record)]);
    clearCache(table);
    Logger.log('UPDATE', table, id, changes);
    return record;
  }

  function remove(table, id) {
    var row = findRowNumber(table, id);
    if (!row) throw new Error('Data ' + table + ' dengan ID ' + id + ' tidak ditemukan.');
    sheetFor(table).deleteRow(row);
    clearCache(table);
    Logger.log('DELETE', table, id, {});
    return true;
  }

  return Object.freeze({ createDatabase: createDatabase, createTable: createTable, all: all, findById: findById, query: query, generateNumber: generateNumber, insert: insert, update: update, remove: remove, validate: validateRecord });
})();
