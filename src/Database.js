/******************************************************
 * Database Helper
 ******************************************************/

function db(){

  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

}

function getSheet(name){

  return db().getSheetByName(name);

}