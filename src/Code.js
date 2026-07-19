/******************************************************
 * DACM ERP v2.0
 * Main Controller
 ******************************************************/

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('DACM ERP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include HTML File
 */
function include(filename){
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}