/** Spreadsheet UI entry points. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu(APP.NAME)
    .addItem('Inisialisasi Database', 'initializeDatabase')
    .addItem('Tentang DACM ERP', 'showAbout')
    .addToUi();
}

function initializeDatabase() {
  var result = Database.createDatabase();
  try {
    SpreadsheetApp.getUi().alert(APP.NAME, result.tables + ' tabel berhasil disiapkan.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    console.log(result.tables + ' tabel berhasil disiapkan.');
  }
  return result;
}

function showAbout() {
  try {
    SpreadsheetApp.getUi().alert(APP.NAME, APP.COMPANY + '\nVersi ' + APP.VERSION, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    console.log(APP.NAME + ' - ' + APP.COMPANY + ' versi ' + APP.VERSION);
  }
}
