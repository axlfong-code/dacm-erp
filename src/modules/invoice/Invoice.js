/** Billing is generated from a finished Work Order without re-input. */
const InvoiceModule = Object.freeze({
  list: function(search) {
    var options = typeof search === 'object' && search !== null ? search : { search: search };
    var keyword = String(options.search || '').trim().toLowerCase();
    var status = String(options.status || 'ALL').trim().toUpperCase();
    var dateRange = String(options.dateRange || 'ALL').trim();
    return Database.all('INVOICE').map(enrichInvoice).filter(function(record) {
      if (!matchInvoiceDateRange(record.InvoiceDate, dateRange, options)) return false;
      if (status !== 'ALL') {
        var effectiveStatus = invoiceEffectiveStatus(record);
        if (effectiveStatus !== status) return false;
      }
      return !keyword || [record.InvoiceNo, record.WorkOrderNo, record.RegisterNo, record.Status, record.CustomerName, record.PlateNumber]
        .some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; });
    }).sort(function(a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
  },
  formOptions: function() {
    return {
      workOrders: WorkOrderModule.list({ status: WORK_ORDER_STATUS.DONE }).filter(function(wo) { return !wo.InvoiceNo; })
    };
  },
  get: function(invoiceNo) {
    var invoice = Database.findById('INVOICE', String(invoiceNo || '').trim());
    if (!invoice) throw new Error('Invoice tidak ditemukan.');
    return enrichInvoice(invoice);
  },
  create: function(input) {
    input = input || {};
    var workOrder = Database.findById('WORKORDER', input.WorkOrderNo);
    if (!workOrder || workOrder.Status !== WORK_ORDER_STATUS.DONE) throw new Error('Invoice hanya dapat dibuat dari WO yang sudah selesai.');
    if (Database.query('INVOICE', { WorkOrderNo: workOrder.WorkOrderNo }).length) throw new Error('WO ini sudah memiliki invoice.');
    var detailLines = listWorkOrderItems(workOrder.WorkOrderNo);
    var detailTotal = detailLines.reduce(function(sum, line) { return sum + Number(line.Subtotal || 0); }, 0);
    var total = Number(input.GrandTotal || detailTotal || workOrder.EstimatedTotal || 0);
    if (!isFinite(total) || total <= 0) throw new Error('Total tagihan harus lebih besar dari nol.');
    return Database.insert('INVOICE', {
      RegisterNo: workOrder.RegisterNo || '',
      WorkOrderNo: workOrder.WorkOrderNo,
      InvoiceDate: Utils.parseDate(input.InvoiceDate),
      GrandTotal: total,
      Status: 'UNPAID'
    }, generateInvoiceNo(workOrder.Branch, input.InvoiceDate));
  },
  openFromWorkOrder: function(workOrderNo) {
    var workOrder = Database.findById('WORKORDER', workOrderNo);
    if (!workOrder) throw new Error('Work Order tidak ditemukan.');
    if (workOrder.Status !== WORK_ORDER_STATUS.DONE && workOrder.Status !== WORK_ORDER_STATUS.PAID) throw new Error('Invoice hanya dapat dibuka dari WO yang sudah selesai.');
    var existing = Database.query('INVOICE', { WorkOrderNo: workOrder.WorkOrderNo })[0];
    if (!existing) {
      var detailLines = listWorkOrderItems(workOrder.WorkOrderNo);
      var detailTotal = detailLines.reduce(function(sum, line) { return sum + Number(line.Subtotal || 0); }, 0);
      existing = this.create({
        WorkOrderNo: workOrder.WorkOrderNo,
        InvoiceDate: new Date(),
        GrandTotal: Number(detailTotal || workOrder.EstimatedTotal || 0)
      });
    }
    return enrichInvoice(existing);
  },
  remove: function(invoiceNo) {
    var invoice = Database.findById('INVOICE', invoiceNo);
    if (!invoice) throw new Error('Invoice tidak ditemukan.');
    var payments = Database.query('PAYMENT', { InvoiceNo: invoice.InvoiceNo });
    if (payments.length) throw new Error('Invoice sudah memiliki pembayaran. Hapus pembayaran terlebih dahulu sebelum hapus invoice.');
    Database.remove('INVOICE', invoice.InvoiceNo);
    return { success: true, InvoiceNo: invoice.InvoiceNo, WorkOrderNo: invoice.WorkOrderNo || '' };
  }
});

function generateInvoiceNo(branch, dateValue) {
  var code = String(branch || APP.DEFAULT_BRANCH || 'D').trim().toUpperCase().charAt(0) || 'D';
  var date = dateValue ? new Date(dateValue) : new Date();
  var yearCode = Utilities.formatDate(date, DATABASE.TIME_ZONE, 'yy');
  var prefix = code + '-' + yearCode;
  var max = Database.all('INVOICE', { noCache: true }).reduce(function(highest, record) {
    var id = String(record.InvoiceNo || '');
    if (id.indexOf(prefix) !== 0) return highest;
    var sequence = Number(id.slice(prefix.length));
    return isNaN(sequence) ? highest : Math.max(highest, sequence);
  }, 0);
  return prefix + String(max + 1).padStart(4, '0');
}

function invoiceEffectiveStatus(record) {
  if (Number(record.Balance || 0) <= 0) return 'PAID';
  if (Number(record.PaidAmount || 0) > 0) return 'PARTIAL';
  return 'UNPAID';
}

function matchInvoiceDateRange(value, dateRange, options) {
  if (!dateRange || dateRange === 'ALL') return true;
  var date = invoiceDateValue(value);
  if (!date) return false;
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (dateRange === 'TODAY') return date >= start;
  if (dateRange === '7D') return date >= start - (6 * 24 * 60 * 60 * 1000);
  if (dateRange === 'MONTH') return date >= new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (dateRange === 'FROM' || dateRange === 'RANGE') {
    var from = invoiceParseDateStart(options && options.dateFrom);
    var to = invoiceParseDateEnd(options && options.dateTo);
    if (from && date < from) return false;
    if (dateRange === 'RANGE' && to && date > to) return false;
    return true;
  }
  if (dateRange === 'LAST') {
    var duration = Number(options && options.dateDuration || 0);
    var unit = String(options && options.dateUnit || 'MONTH').toUpperCase();
    if (!duration || duration < 1) return true;
    var limit = start;
    if (unit === 'DAY') limit = start - ((duration - 1) * 24 * 60 * 60 * 1000);
    else if (unit === 'WEEK') limit = start - (((duration * 7) - 1) * 24 * 60 * 60 * 1000);
    else limit = new Date(now.getFullYear(), now.getMonth() - duration + 1, 1).getTime();
    return date >= limit;
  }
  return true;
}

function invoiceDateValue(value) {
  if (!value) return 0;
  if (Object.prototype.toString.call(value) === '[object Date]') return value.getTime();
  var date = new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function invoiceParseDateStart(value) {
  if (!value) return 0;
  var parts = String(value).split('-');
  if (parts.length !== 3) return invoiceDateValue(value);
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
}

function invoiceParseDateEnd(value) {
  var start = invoiceParseDateStart(value);
  return start ? start + (24 * 60 * 60 * 1000) - 1 : 0;
}

function enrichInvoice(record) {
  var workOrder = record.WorkOrderNo ? WorkOrderModule.get(record.WorkOrderNo) : null;
  var register = !workOrder && record.RegisterNo ? Database.findById('REGISTER', record.RegisterNo) : null;
  var vehicle = register ? Database.findById('VEHICLES', register.VehicleID) : null;
  var payments = Database.query('PAYMENT', { InvoiceNo: record.InvoiceNo });
  var details = workOrder ? listWorkOrderItems(workOrder.WorkOrderNo) : [];
  var paid = payments.reduce(function(total, payment) { return total + Number(payment.Amount || 0); }, 0);
  var grandTotal = Number(record.GrandTotal || 0);
  return Object.assign({}, record, {
    WorkOrderNo: record.WorkOrderNo || '',
    CustomerName: workOrder ? workOrder.CustomerName : '-',
    CustomerPhone: workOrder ? (workOrder.Phone || '') : '',
    PlateNumber: workOrder ? workOrder.PlateNumber : (vehicle ? vehicle.PlateNumber : '-'),
    VehicleName: workOrder ? workOrder.VehicleName : '-',
    Branch: workOrder ? (workOrder.Branch || APP.DEFAULT_BRANCH) : APP.DEFAULT_BRANCH,
    InvoiceDateText: Utils.formatDate(record.InvoiceDate, APP.DATE_FORMAT),
    InvoiceTimeText: Utils.formatDate(record.CreatedAt || record.InvoiceDate, 'HH:mm'),
    Details: details,
    PaidAmount: paid,
    Balance: grandTotal - paid,
    Status: grandTotal - paid <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : record.Status)
  });
}

function invoiceList(search) { return InvoiceModule.list(search); }
function invoiceFormOptions() { return InvoiceModule.formOptions(); }
function invoiceCreate(data) { return InvoiceModule.create(data); }
function invoiceGet(invoiceNo) { return InvoiceModule.get(invoiceNo); }
function invoiceOpenFromWorkOrder(workOrderNo) { return InvoiceModule.openFromWorkOrder(workOrderNo); }
function invoiceDelete(invoiceNo) { return InvoiceModule.remove(invoiceNo); }
