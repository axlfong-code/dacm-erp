/** Work Order is the central service document. Customer and vehicle are handled directly here. */
const WORK_ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED'
});

const WORK_ORDER_APPROVAL = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
});

function canonicalWorkOrderStatus(value) {
  var raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'CHECK') return WORK_ORDER_STATUS.PENDING;
  if (raw === 'CHECK_IN') return WORK_ORDER_STATUS.IN_PROGRESS;
  if (raw === 'CHECK_OUT') return WORK_ORDER_STATUS.DONE;
  if (raw === 'FINISHED') return WORK_ORDER_STATUS.DONE;
  return Object.keys(WORK_ORDER_STATUS).map(function(key) { return WORK_ORDER_STATUS[key]; }).indexOf(raw) >= 0 ? raw : '';
}

const WorkOrderModule = Object.freeze({
  list: function(filter) {
    var options = typeof filter === 'object' && filter !== null ? filter : { search: filter };
    var keyword = String(options.search || '').trim().toLowerCase();
    var status = String(options.status || '').trim();
    var customerId = String(options.customerId || '').trim();
    var dateRange = String(options.dateRange || 'ALL').trim();
    return Database.all('WORKORDER').map(enrich).filter(function(record) {
      if (status && status !== 'ALL' && canonicalWorkOrderStatus(record.Status) !== canonicalWorkOrderStatus(status)) return false;
      if (customerId && String(record.CustomerID) !== customerId) return false;
      if (!matchWorkOrderDateRange(record.StartDate, dateRange, options)) return false;
      if (!keyword) return true;
        return [record.WorkOrderNo, record.CustomerName, record.Phone, record.PlateNumber, record.VehicleName, record.TechnicianID, record.Status, record.ApprovalStatus, record.Complaint, record.ComplaintDetail, record.WorkItems]
        .some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; });
    }).sort(function(a, b) { return dateValue(b.CreatedAt || b.StartDate) - dateValue(a.CreatedAt || a.StartDate); });
  },
  get: function(workOrderNo) {
    var workOrder = Database.findById('WORKORDER', workOrderNo);
    return workOrder ? enrich(workOrder) : null;
  },
  formOptions: function() {
    return {
      customers: CustomerModule.list(''),
      vehicles: VehicleModule.list(''),
      items: typeof ItemModule !== 'undefined' ? ItemModule.list('') : []
    };
  },
  save: function(input) {
    return withWorkOrderLock(function() {
      input = input || {};
      var current = input.WorkOrderNo ? requireWorkOrder(input.WorkOrderNo, [WORK_ORDER_STATUS.PENDING, WORK_ORDER_STATUS.IN_PROGRESS, WORK_ORDER_STATUS.DONE, WORK_ORDER_STATUS.PAID, WORK_ORDER_STATUS.CANCELLED]) : null;
      var data = buildData(input, current);
      var detailLines = normalizeWorkOrderItemLines(input.WorkItemLines);
      assertSingleActiveWorkOrder(data.VehicleID, input.WorkOrderNo);

      if (current) {
        data.Status = data.Status || current.Status;
        data.ApprovalStatus = data.ApprovalStatus || current.ApprovalStatus || WORK_ORDER_APPROVAL.PENDING;
        data.ApprovedAt = data.ApprovedAt || current.ApprovedAt;
        data.FinishDate = data.FinishDate || current.FinishDate;
        data.StartDate = current.StartDate || data.StartDate || new Date();
        var updated = Database.update('WORKORDER', input.WorkOrderNo, data);
        syncWorkOrderItems(input.WorkOrderNo, detailLines);
        return updated;
      }

      data.RegisterNo = '';
      data.Status = data.Status || WORK_ORDER_STATUS.PENDING;
      data.ApprovalStatus = data.ApprovalStatus || WORK_ORDER_APPROVAL.PENDING;
      data.StartDate = data.StartDate || new Date();
      data.FinishDate = '';
      var created = Database.insert('WORKORDER', data, generateWorkOrderNo(data.Branch, data.StartDate));
      syncWorkOrderItems(created.WorkOrderNo, detailLines);
      return created;
    });
  },
  create: function(input) {
    return this.save(input);
  },
  pending: function(workOrderNo, notes) {
    var workOrder = requireWorkOrder(workOrderNo, [WORK_ORDER_STATUS.PENDING, WORK_ORDER_STATUS.IN_PROGRESS]);
    return Database.update('WORKORDER', workOrder.WorkOrderNo, { Status: WORK_ORDER_STATUS.PENDING, ApprovalStatus: WORK_ORDER_APPROVAL.PENDING, Notes: mergeNotes(workOrder.Notes, notes) });
  },
  proceed: function(workOrderNo, notes) {
    return withWorkOrderLock(function() {
      var workOrder = requireWorkOrder(workOrderNo, [WORK_ORDER_STATUS.PENDING]);
      assertSingleActiveWorkOrder(workOrder.VehicleID, workOrder.WorkOrderNo);
      return Database.update('WORKORDER', workOrder.WorkOrderNo, { Status: WORK_ORDER_STATUS.IN_PROGRESS, ApprovalStatus: WORK_ORDER_APPROVAL.APPROVED, ApprovedAt: new Date(), Notes: mergeNotes(workOrder.Notes, notes) });
    });
  },
  finish: function(workOrderNo, notes, measurement) {
    var workOrder = requireWorkOrder(workOrderNo, [WORK_ORDER_STATUS.IN_PROGRESS]);
    measurement = measurement || {};
    return Database.update('WORKORDER', workOrder.WorkOrderNo, {
      FinishDate: new Date(),
      Status: WORK_ORDER_STATUS.DONE,
      Notes: mergeNotes(workOrder.Notes, notes),
      FinalLowPress: String(measurement.FinalLowPress || workOrder.FinalLowPress || '').trim(),
      FinalHighPress: String(measurement.FinalHighPress || workOrder.FinalHighPress || '').trim(),
      FinalTemp: String(measurement.FinalTemp || workOrder.FinalTemp || '').trim()
    });
  },
  cancel: function(workOrderNo, notes) {
    var workOrder = requireWorkOrder(workOrderNo, [WORK_ORDER_STATUS.PENDING, WORK_ORDER_STATUS.IN_PROGRESS]);
    return Database.update('WORKORDER', workOrder.WorkOrderNo, { Status: WORK_ORDER_STATUS.CANCELLED, ApprovalStatus: WORK_ORDER_APPROVAL.REJECTED, FinishDate: new Date(), Notes: mergeNotes(workOrder.Notes, notes) });
  },
  remove: function(workOrderNo) {
    var workOrder = requireWorkOrder(workOrderNo, [WORK_ORDER_STATUS.PENDING, WORK_ORDER_STATUS.IN_PROGRESS, WORK_ORDER_STATUS.DONE, WORK_ORDER_STATUS.CANCELLED]);
    var invoice = Database.query('INVOICE', { WorkOrderNo: workOrder.WorkOrderNo })[0];
    if (invoice) throw new Error('WO sudah memiliki invoice dan tidak bisa dihapus. Batalkan/urus invoice terlebih dahulu.');
    clearWorkOrderItems(workOrder.WorkOrderNo);
    Database.remove('WORKORDER', workOrder.WorkOrderNo);
    return { success: true, WorkOrderNo: workOrder.WorkOrderNo };
  },
  markPaid: function(workOrderNo) {
    var workOrder = requireWorkOrder(workOrderNo, [WORK_ORDER_STATUS.DONE, WORK_ORDER_STATUS.PAID]);
    return Database.update('WORKORDER', workOrder.WorkOrderNo, { Status: WORK_ORDER_STATUS.PAID });
  }
});

function buildData(input, current) {
  var customer = resolveCustomer(input, current);
  var vehicle = resolveVehicle(input, customer.CustomerID, current);
  var estimatedTotal = parseMoney(input.EstimatedTotal || 0);
  var odometer = Number(input.Odometer || vehicle.LastKM || 0);
  if (!isFinite(odometer) || odometer < 0) throw new Error('KM kendaraan tidak valid.');

  var data = {
    RegisterNo: String(input.RegisterNo || (current ? current.RegisterNo : '') || '').trim(),
    TechnicianID: String(input.TechnicianID || (current ? current.TechnicianID : '') || '').trim(),
    StartDate: input.StartDate || (current ? current.StartDate : new Date()),
    FinishDate: input.FinishDate || '',
    Status: normalizeStatus(input.Status),
    Notes: String(input.Notes || (current ? current.Notes : '') || '').trim(),
    CustomerID: customer.CustomerID,
    VehicleID: vehicle.VehicleID,
    Branch: String(input.Branch || (current ? current.Branch : APP.DEFAULT_BRANCH)).trim() || APP.DEFAULT_BRANCH,
    Odometer: odometer,
    Complaint: String(input.Complaint || input.ComplaintDetail || '').trim(),
    ComplaintDetail: String(input.ComplaintDetail || (current ? current.ComplaintDetail : '') || '').trim(),
    Observation: String(input.Observation || (current ? current.Observation : '') || '').trim(),
    Recommendation: String(input.Recommendation || (current ? current.Recommendation : '') || '').trim(),
    WorkItems: String(input.WorkItems || (current ? current.WorkItems : '') || '').trim(),
    EstimatedTotal: estimatedTotal,
    ApprovalStatus: normalizeApproval(input.ApprovalStatus),
    ApprovedAt: input.ApprovedAt || '',
    InitialLowPress: String(input.InitialLowPress || '').trim(),
    InitialHighPress: String(input.InitialHighPress || '').trim(),
    InitialTemp: String(input.InitialTemp || '').trim(),
    FinalLowPress: String(input.FinalLowPress || '').trim(),
    FinalHighPress: String(input.FinalHighPress || '').trim(),
    FinalTemp: String(input.FinalTemp || '').trim()
  };
  Utils.require(data.Complaint, 'Keluhan wajib diisi.');
  return data;
}

function matchWorkOrderDateRange(value, dateRange, options) {
  if (!dateRange || dateRange === 'ALL') return true;
  var date = dateValue(value);
  if (!date) return false;
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (dateRange === 'TODAY') return date >= start;
  if (dateRange === '7D') return date >= start - (6 * 24 * 60 * 60 * 1000);
  if (dateRange === 'MONTH') return date >= new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (dateRange === 'FROM' || dateRange === 'RANGE') {
    var from = parseDateStart(options && options.dateFrom);
    var to = parseDateEnd(options && options.dateTo);
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

function parseDateStart(value) {
  if (!value) return 0;
  var parts = String(value).split('-');
  if (parts.length !== 3) return dateValue(value);
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
}

function parseDateEnd(value) {
  var start = parseDateStart(value);
  return start ? start + (24 * 60 * 60 * 1000) - 1 : 0;
}

function resolveCustomer(input, current) {
  var customerId = String(input.CustomerID || (current ? current.CustomerID : '') || '').trim();
  if (customerId) {
    var existing = Database.findById('CUSTOMERS', customerId);
    if (!existing) throw new Error('Pelanggan tidak ditemukan.');
    return existing;
  }

  var name = String(input.CustomerName || '').trim();
  if (!name) throw new Error('Nama pelanggan wajib diisi.');
  return CustomerModule.save({
    CustomerName: name,
    Phone: String(input.Phone || input.CustomerPhone || '').trim(),
    WhatsApp: String(input.WhatsApp || '').trim(),
    Address: String(input.Address || '').trim()
  });
}

function resolveVehicle(input, customerId, current) {
  var vehicleId = String(input.VehicleID || (current ? current.VehicleID : '') || '').trim();
  if (vehicleId) {
    var existing = Database.findById('VEHICLES', vehicleId);
    if (!existing) throw new Error('Kendaraan tidak ditemukan.');
    if (String(existing.CustomerID) !== String(customerId)) throw new Error('Kendaraan tidak sesuai dengan pelanggan.');
    return existing;
  }

  return VehicleModule.save({
    CustomerID: customerId,
    PlateNumber: String(input.PlateNumber || '').trim(),
    Brand: String(input.Brand || '').trim(),
    Model: String(input.Model || '').trim(),
    Year: String(input.Year || '').trim(),
    LastKM: Number(input.Odometer || input.LastKM || 0)
  });
}

function assertSingleActiveWorkOrder(vehicleId, currentWorkOrderNo) {
  var active = Database.all('WORKORDER').find(function(record) {
    if (String(record.VehicleID) !== String(vehicleId)) return false;
    if (currentWorkOrderNo && String(record.WorkOrderNo) === String(currentWorkOrderNo)) return false;
    return [WORK_ORDER_STATUS.PENDING, WORK_ORDER_STATUS.IN_PROGRESS].indexOf(canonicalWorkOrderStatus(record.Status)) >= 0;
  });
  if (active) throw new Error('Kendaraan ini masih memiliki WO aktif: ' + active.WorkOrderNo + '. Buka WO tersebut untuk lanjut proses.');
}

function ensureWorkOrderItemsTable() {
  try {
    Database.all('WORKORDER_ITEMS');
  } catch (error) {
    if (String(error && error.message || error).indexOf('Sheet belum dibuat') >= 0) {
      Database.createTable('WORKORDER_ITEMS');
      return;
    }
    throw error;
  }
}

function normalizeWorkOrderItemLines(input) {
  if (input == null || input === '') return null;
  var lines = input;
  if (typeof lines === 'string') {
    try {
      lines = JSON.parse(lines);
    } catch (error) {
      throw new Error('Format detail item WO tidak valid.');
    }
  }
  if (!Array.isArray(lines)) return null;
  return lines.map(function(line, index) {
    var qty = Number(line.Qty || 1);
    var price = Number(line.Price || 0);
    var subtotal = Number(line.Subtotal || (qty * price));
    return {
      LineNo: index + 1,
      GroupName: String(line.GroupName || line.Group || 'LAINNYA').trim() || 'LAINNYA',
      ItemName: String(line.ItemName || line.Name || '').trim(),
      Qty: isFinite(qty) && qty > 0 ? qty : 1,
      Price: isFinite(price) && price >= 0 ? price : 0,
      Subtotal: isFinite(subtotal) && subtotal >= 0 ? subtotal : 0,
      Source: String(line.Source || 'QUICK').trim() || 'QUICK'
    };
  }).filter(function(line) { return line.ItemName; });
}

function clearWorkOrderItems(workOrderNo) {
  ensureWorkOrderItemsTable();
  Database.query('WORKORDER_ITEMS', { WorkOrderNo: workOrderNo }).forEach(function(line) {
    Database.remove('WORKORDER_ITEMS', line.WorkOrderItemNo);
  });
}

function syncWorkOrderItems(workOrderNo, lines) {
  if (!lines) return;
  ensureWorkOrderItemsTable();
  clearWorkOrderItems(workOrderNo);
  lines.forEach(function(line, index) {
    Database.insert('WORKORDER_ITEMS', {
      WorkOrderNo: workOrderNo,
      LineNo: index + 1,
      GroupName: line.GroupName,
      ItemName: line.ItemName,
      Qty: line.Qty,
      Price: line.Price,
      Subtotal: line.Subtotal,
      Source: line.Source
    });
  });
}

function listWorkOrderItems(workOrderNo) {
  ensureWorkOrderItemsTable();
  return Database.query('WORKORDER_ITEMS', { WorkOrderNo: workOrderNo }).sort(function(a, b) {
    return Number(a.LineNo || 0) - Number(b.LineNo || 0);
  }).map(function(line) {
    return Object.assign({}, line, {
      Qty: Number(line.Qty || 0),
      Price: Number(line.Price || 0),
      Subtotal: Number(line.Subtotal || 0)
    });
  });
}

function withWorkOrderLock(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function enrich(record) {
  var status = canonicalWorkOrderStatus(record.Status) || WORK_ORDER_STATUS.PENDING;
  var customer = record.CustomerID ? Database.findById('CUSTOMERS', record.CustomerID) : null;
  var vehicle = record.VehicleID ? Database.findById('VEHICLES', record.VehicleID) : null;
  var invoice = Database.query('INVOICE', { WorkOrderNo: record.WorkOrderNo })[0] || null;
  var items = listWorkOrderItems(record.WorkOrderNo);
  var paymentBadge = 'Belum invoice';
  if (invoice) {
    var paid = Database.query('PAYMENT', { InvoiceNo: invoice.InvoiceNo }).reduce(function(total, payment) { return total + Number(payment.Amount || 0); }, 0);
    paymentBadge = paid >= Number(invoice.GrandTotal || 0) ? 'Lunas' : 'Belum lunas';
  }
  return Object.assign({}, record, {
    Status: status,
    CustomerName: customer ? customer.CustomerName : '-',
    Phone: customer ? (customer.Phone || customer.WhatsApp || '') : '',
    PlateNumber: vehicle ? vehicle.PlateNumber : '-',
    VehicleName: vehicle ? String(vehicle.Brand + ' ' + vehicle.Model).trim() : '-',
    Branch: record.Branch || APP.DEFAULT_BRANCH,
    StartDateText: Utils.formatDate(record.StartDate, APP.DATE_FORMAT),
    FinishDateText: Utils.formatDate(record.FinishDate, APP.DATE_FORMAT),
    EstimatedTotal: Number(record.EstimatedTotal || 0),
    WorkItems: String(record.WorkItems || ''),
    WorkOrderItems: items,
    PaymentBadge: paymentBadge,
    InvoiceNo: invoice ? invoice.InvoiceNo : ''
  });
}

function normalizeStatus(value) {
  return canonicalWorkOrderStatus(value);
}

function normalizeApproval(value) {
  value = String(value || '').trim();
  return Object.keys(WORK_ORDER_APPROVAL).map(function(key) { return WORK_ORDER_APPROVAL[key]; }).indexOf(value) >= 0 ? value : '';
}

function requireWorkOrder(workOrderNo, allowedStatuses) {
  var workOrder = Database.findById('WORKORDER', workOrderNo);
  if (!workOrder) throw new Error('Work Order tidak ditemukan.');
  workOrder = Object.assign({}, workOrder, { Status: canonicalWorkOrderStatus(workOrder.Status) || workOrder.Status });
  if (allowedStatuses.map(canonicalWorkOrderStatus).indexOf(canonicalWorkOrderStatus(workOrder.Status)) < 0) throw new Error('Status Work Order tidak valid untuk aksi ini: ' + workOrder.Status);
  return workOrder;
}

function mergeNotes(current, next) {
  current = String(current || '').trim();
  next = String(next || '').trim();
  return next ? (current ? current + '\n' + next : next) : current;
}

function generateWorkOrderNo(branch, dateValue) {
  var code = String(branch || APP.DEFAULT_BRANCH || 'D').trim().toUpperCase().charAt(0) || 'D';
  var date = dateValue ? new Date(dateValue) : new Date();
  var dayCode = Utilities.formatDate(date, DATABASE.TIME_ZONE, 'yyMMdd');
  var prefix = 'WO-' + code + dayCode;
  var max = Database.all('WORKORDER', { noCache: true }).reduce(function(highest, record) {
    var id = String(record.WorkOrderNo || '');
    if (id.indexOf(prefix) !== 0) return highest;
    var sequence = Number(id.slice(prefix.length));
    return isNaN(sequence) ? highest : Math.max(highest, sequence);
  }, 0);
  return prefix + String(max + 1).padStart(3, '0');
}

function dateValue(value) {
  return value ? new Date(value).getTime() || 0 : 0;
}

function parseMoney(value) {
  var cleaned = String(value == null ? '' : value).replace(/[^\d-]/g, '');
  var amount = Number(cleaned || 0);
  if (!isFinite(amount) || amount < 0) throw new Error('Estimasi biaya tidak valid.');
  return amount;
}

function workOrderList(filter) { return WorkOrderModule.list(filter); }
function workOrderGet(workOrderNo) { return WorkOrderModule.get(workOrderNo); }
function workOrderFormOptions() { return WorkOrderModule.formOptions(); }
function workOrderSave(data) { return WorkOrderModule.save(data); }
function workOrderCreate(data) { return WorkOrderModule.create(data); }
function workOrderQuickAction(data) {
  data = data || {};
  var action = String(data.Action || 'PENDING').trim().toUpperCase();
  if (['WORK', 'INVOICE', 'PAID', 'PENDING', 'DRAFT'].indexOf(action) < 0) throw new Error('Aksi WO Cepat tidak valid.');
  var selectedVehicle = data.VehicleID ? Database.findById('VEHICLES', String(data.VehicleID).trim()) : null;
  if (selectedVehicle && selectedVehicle.CustomerID) {
    data.CustomerID = selectedVehicle.CustomerID;
  }

  var payload = Object.assign({}, data, {
    Status: action === 'WORK' ? WORK_ORDER_STATUS.IN_PROGRESS : ((action === 'INVOICE' || action === 'PAID') ? WORK_ORDER_STATUS.DONE : WORK_ORDER_STATUS.PENDING),
    ApprovalStatus: (action === 'PENDING' || action === 'DRAFT') ? WORK_ORDER_APPROVAL.PENDING : WORK_ORDER_APPROVAL.APPROVED,
    ApprovedAt: (action === 'PENDING' || action === 'DRAFT') ? '' : new Date(),
    FinishDate: (action === 'INVOICE' || action === 'PAID') ? new Date() : ''
  });
  var workOrder = WorkOrderModule.save(payload);
  var result = {
    WorkOrderNo: workOrder.WorkOrderNo,
    Status: action === 'WORK' ? 'DIKERJAKAN' : (action === 'DRAFT' ? WORK_ORDER_STATUS.PENDING : action)
  };

  if (action === 'INVOICE') {
    var createdInvoice = InvoiceModule.openFromWorkOrder(workOrder.WorkOrderNo);
    result.InvoiceNo = createdInvoice.InvoiceNo;
    result.Status = WORK_ORDER_STATUS.DONE;
  }

  if (action === 'PAID') {
    var method = String(data.PaymentMethods || '').trim();
    if (!method) throw new Error('Metode pembayaran wajib dipilih untuk aksi LUNAS.');
    var invoice = InvoiceModule.create({
      WorkOrderNo: workOrder.WorkOrderNo,
      InvoiceDate: data.StartDate || new Date(),
      GrandTotal: Number(parseMoney(data.EstimatedTotal || 0))
    });
    var payment = PaymentModule.save({
      InvoiceNo: invoice.InvoiceNo,
      PaymentDate: data.StartDate || new Date(),
      Method: method,
      Amount: Number(invoice.GrandTotal || 0),
      ReferenceNo: ''
    });
    Database.update('WORKORDER', workOrder.WorkOrderNo, {
      Status: WORK_ORDER_STATUS.PAID,
      FinishDate: workOrder.FinishDate || new Date()
    });
    result.InvoiceNo = invoice.InvoiceNo;
    result.PaymentNo = payment.PaymentNo;
    result.PaymentMethod = method;
    result.Status = WORK_ORDER_STATUS.PAID;
  }
  return result;
}
function workOrderPending(workOrderNo, notes) { return WorkOrderModule.pending(workOrderNo, notes); }
function workOrderProceed(workOrderNo, notes) { return WorkOrderModule.proceed(workOrderNo, notes); }
function workOrderFinish(workOrderNo, notes, measurement) { return WorkOrderModule.finish(workOrderNo, notes, measurement); }
function workOrderCancel(workOrderNo, notes) { return WorkOrderModule.cancel(workOrderNo, notes); }
function workOrderDelete(workOrderNo) { return WorkOrderModule.remove(workOrderNo); }
function workOrderMarkPaid(workOrderNo) { return WorkOrderModule.markPaid(workOrderNo); }
