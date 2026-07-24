/** Audit logger. Logging failures never interrupt the business transaction. */
const Logger = Object.freeze({
  log: function(action, entity, entityId, details) {
    try {
      var schema = SCHEMA.LOG;
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(schema.sheet);
      if (!sheet) return;
      sheet.appendRow([
        Database.generateNumber('LOG'), new Date(), this.currentUser(), action || '', entity || '', entityId || '',
        typeof details === 'string' ? details : JSON.stringify(details || {})
      ]);
    } catch (error) {
      console.warn('DACM ERP log failure: ' + error.message);
    }
  },
  currentUser: function() {
    return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'SYSTEM';
  }
});
