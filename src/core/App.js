/** First web-app endpoint; UI views will be added in Sprint 1B. */
function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate().setTitle(APP.NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

function renderLogin() {
  return HtmlService.createTemplateFromFile('Login').evaluate().getContent();
}

function renderDashboard() {
  return HtmlService.createTemplateFromFile('Dashboard').evaluate().getContent();
}

function getDashboardSummary() {
  var recent = WorkOrderModule.list('').slice(0, 5).map(function(record) {
    return {
      WorkOrderNo: record.WorkOrderNo,
      StartDate: record.StartDateText,
      CustomerName: record.CustomerName,
      PlateNumber: record.PlateNumber,
      Complaint: record.Complaint,
      Status: record.Status
    };
  });
  var todayText = Utils.formatDate(new Date(), APP.DATE_FORMAT);
  var workOrders = WorkOrderModule.list('');
  var invoices = InvoiceModule.list('');
  return {
    metrics: [
      { label: 'Pelanggan', value: Database.all('CUSTOMERS').length },
      { label: 'Kendaraan', value: Database.all('VEHICLES').length },
      { label: 'WO Hari Ini', value: workOrders.filter(function(wo) { return wo.StartDateText === todayText; }).length },
      { label: 'WO Pending', value: workOrders.filter(function(wo) { return wo.Status === WORK_ORDER_STATUS.PENDING; }).length },
      { label: 'WO Dikerjakan', value: workOrders.filter(function(wo) { return wo.Status === WORK_ORDER_STATUS.IN_PROGRESS; }).length },
      { label: 'WO Siap Invoice', value: workOrders.filter(function(wo) { return wo.Status === WORK_ORDER_STATUS.DONE && !wo.InvoiceNo; }).length },
      { label: 'Stok Rendah', value: StockModule.list('').filter(function(stock) { return stock.LowStock; }).length },
      { label: 'Piutang Invoice', value: invoices.filter(function(invoice) { return invoice.Balance > 0; }).length }
    ],
    recentWorkOrders: recent
  };
}

/** Compatibility endpoint used by the existing Login view. */
function login(username, password) {
  try {
    var user = Auth.login(username, password);
    return { success: true, nama: user.FullName, role: user.Role, cabang: user.Branch };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function healthCheck() {
  return { name: APP.NAME, version: APP.VERSION, status: 'OK', timestamp: new Date() };
}
