function createDatabase() {

  Object.values(SCHEMA).forEach(table => {
    createTable(table);
  });

  SpreadsheetApp.getUi().alert("Database berhasil dibuat.");

}
function createSheet(name){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(name);

  if(sheet) return;

  ss.insertSheet(name);

}
function resetDatabase(){

  const ui = SpreadsheetApp.getUi();

  const result = ui.alert(
    "Reset Database?",
    "Semua sheet DACM ERP akan dihapus.",
    ui.ButtonSet.YES_NO
  );

  if(result != ui.Button.YES)
    return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.values(SHEETS).forEach(name=>{

    const sheet = ss.getSheetByName(name);

    if(sheet)
      ss.deleteSheet(sheet);

  });

  ui.alert("Database berhasil dihapus.");

}
function createTable(table) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(table.sheet);

  if (!sheet) {
    sheet = ss.insertSheet(table.sheet);
  }

  sheet.clear();

  sheet.getRange(1, 1, 1, table.columns.length)
       .setValues([table.columns]);

}