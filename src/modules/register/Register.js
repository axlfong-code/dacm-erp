/** Front-office register intake service. */
const REGISTER_STATUS = Object.freeze({
  REGISTERED: 'REGISTERED',
  PENDING: 'PENDING',
  WO_CREATED: 'WO_CREATED',
  CANCELLED: 'CANCELLED'
});

const RegisterModule = Object.freeze({
  list: function(search) {
    var options = typeof search === 'object' && search !== null ? search : { search: search };
    var keyword = String(options.search || '').trim().toLowerCase();
    var status = String(options.status || '').trim().toUpperCase();
    return Database.all('REGISTER').map(enrichRegister).filter(function(record) {
      if (status && status !== 'ALL' && String(record.Status || '').toUpperCase() !== status) return false;
      if (!keyword) return true;
      return [
        record.RegisterNo,
        record.CustomerName,
        record.CustomerPhone,
        record.PlateNumber,
        record.VehicleLabel,
        record.Complaint,
        record.Recommendation,
        record.Status,
        record.WorkOrderNo
      ].some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; });
    }).sort(function(a, b) {
      return String(b.CreatedAt || b.RegisterDate || '').localeCompare(String(a.CreatedAt || a.RegisterDate || ''));
    });
  },
  get: function(registerNo) {
    var record = Database.findById('REGISTER', registerNo);
    return record ? enrichRegister(record) : null;
  },
  formOptions: function() {
    return {
      customers: CustomerModule.list(''),
      vehicles: VehicleModule.list('')
    };
  },
  save: function(input) {
    return upsertRegister(input, {
      status: String((input || {}).Status || REGISTER_STATUS.REGISTERED).trim().toUpperCase() || REGISTER_STATUS.REGISTERED
    });
  },
  pending: function(input) {
    return upsertRegister(input, { status: REGISTER_STATUS.PENDING });
  },
  proceed: function(input) {
    input = normalizeInput(input);
    var current = input.RegisterNo ? Database.findById('REGISTER', input.RegisterNo) : null;
    var activeWorkOrder = findActiveWorkOrderForRegister(input, current);
    if (activeWorkOrder) {
      return {
        register: current ? enrichRegister(current) : null,
        workOrder: activeWorkOrder,
        existingActive: true
      };
    }
    if (current && String(current.WorkOrderNo || '').trim()) {
      var existingWorkOrder = Database.findById('WORKORDER', current.WorkOrderNo);
      if (existingWorkOrder) {
        return { register: enrichRegister(current), workOrder: existingWorkOrder };
      }
    }
    var register = upsertRegister(input, { status: REGISTER_STATUS.WO_CREATED, createWorkOrder: true });
    var workOrder = register && register.WorkOrderNo ? Database.findById('WORKORDER', register.WorkOrderNo) : null;
    return {
      register: enrichRegister(register),
      workOrder: workOrder
    };
  },
  remove: function(registerNo) {
    Utils.require(registerNo, 'ID register wajib diisi.');
    var register = Database.findById('REGISTER', registerNo);
    if (!register) throw new Error('Register tidak ditemukan.');
    if (String(register.WorkOrderNo || '').trim()) {
      throw new Error('Register sudah menjadi Work Order dan tidak bisa dihapus.');
    }
    Database.remove('REGISTER', registerNo);
    return { success: true, RegisterNo: registerNo };
  }
});

function upsertRegister(input, options) {
  input = normalizeInput(input);
  options = options || {};
  var current = input.RegisterNo ? Database.findById('REGISTER', input.RegisterNo) : null;
  var data = buildRegisterData(input, current);
  var registerStatus = String(options.status || data.Status || REGISTER_STATUS.REGISTERED).trim().toUpperCase() || REGISTER_STATUS.REGISTERED;

  if (current && String(current.WorkOrderNo || '').trim() && registerStatus !== REGISTER_STATUS.WO_CREATED) {
    registerStatus = REGISTER_STATUS.WO_CREATED;
  }
  data.Status = registerStatus;

  if (options.createWorkOrder) {
    if (current && String(current.WorkOrderNo || '').trim()) {
      data.WorkOrderNo = current.WorkOrderNo;
    } else {
      var workOrder = WorkOrderModule.save({
        RegisterNo: current ? current.RegisterNo : '',
        CustomerID: data.CustomerID,
        VehicleID: data.VehicleID,
        Branch: data.Branch,
        StartDate: data.RegisterDate,
        Complaint: data.Complaint,
        ComplaintDetail: data.Complaint,
        Recommendation: data.Recommendation,
        EstimatedTotal: data.EstimatedTotal,
        Notes: data.Notes,
        WorkItems: '',
        InitialLowPress: data.InitialLowPress,
        InitialHighPress: data.InitialHighPress,
        InitialTemp: data.InitialTemp
      });
      data.WorkOrderNo = workOrder.WorkOrderNo;
    }
  } else if (current) {
    data.WorkOrderNo = current.WorkOrderNo || '';
  }

  var registerNo = current ? current.RegisterNo : generateRegisterNo(data.RegisterDate);
  if (current) {
    return Database.update('REGISTER', registerNo, data);
  }
  return Database.insert('REGISTER', data, registerNo);
}

function buildRegisterData(input, current) {
  var customer = resolveRegisterCustomer(input, current);
  var vehicle = resolveRegisterVehicle(input, customer.CustomerID, current);
  var registerDate = registerDateValue(input.RegisterDate || (current ? current.RegisterDate : ''));
  var estimate = parseMoneyLike(input.EstimatedTotal || (current ? current.EstimatedTotal : 0));
  var complaint = String(input.Complaint || (current ? current.Complaint : '') || '').trim();
  Utils.require(complaint, 'Keluhan wajib diisi.');

  return {
    RegisterDate: registerDate,
    Branch: String(input.Branch || (current ? current.Branch : APP.DEFAULT_BRANCH || 'D')).trim() || APP.DEFAULT_BRANCH || 'D',
    CustomerID: customer.CustomerID,
    VehicleID: vehicle.VehicleID,
    Complaint: complaint,
    Recommendation: String(input.Recommendation || (current ? current.Recommendation : '') || '').trim(),
    EstimatedTotal: estimate,
    Status: String(input.Status || (current ? current.Status : REGISTER_STATUS.REGISTERED) || REGISTER_STATUS.REGISTERED).trim().toUpperCase(),
    Notes: String(input.Notes || (current ? current.Notes : '') || '').trim(),
    WorkOrderNo: String(input.WorkOrderNo || (current ? current.WorkOrderNo : '') || '').trim(),
    PIC: String(input.PIC || (current ? current.PIC : '') || '').trim()
  };
}

function normalizeInput(input) {
  return typeof input === 'string' ? { RegisterNo: input } : (input || {});
}

function enrichRegister(record) {
  if (!record) return null;
  var customer = Database.findById('CUSTOMERS', record.CustomerID);
  var vehicle = Database.findById('VEHICLES', record.VehicleID);
  return Object.assign({}, record, {
    CustomerName: customer ? customer.CustomerName : '-',
    CustomerPhone: customer ? (customer.Phone || customer.WhatsApp || '-') : '-',
    PlateNumber: vehicle ? vehicle.PlateNumber : '-',
    VehicleLabel: vehicle ? [vehicle.Brand, vehicle.Model].filter(Boolean).join(' ') || '-' : '-',
    RegisterDateText: Utils.formatDate(record.RegisterDate, APP.DATE_FORMAT),
    BranchLabel: branchLabel(record.Branch),
    EstimatedText: rupiahText(record.EstimatedTotal || 0),
    StatusLabel: registerStatusLabel(record.Status),
    WorkOrderNo: String(record.WorkOrderNo || '').trim()
  });
}

function resolveRegisterCustomer(input, current) {
  var customerId = String(input.CustomerID || (current ? current.CustomerID : '') || '').trim();
  if (customerId) {
    var existing = Database.findById('CUSTOMERS', customerId);
    if (!existing) throw new Error('Pelanggan tidak ditemukan.');
    return existing;
  }

  var name = String(input.CustomerName || '').trim();
  if (!name) throw new Error('Customer wajib dipilih atau dibuat baru.');
  return CustomerModule.save({
    CustomerName: name,
    Phone: String(input.Phone || input.CustomerPhone || '').trim(),
    WhatsApp: String(input.WhatsApp || input.CustomerPhone || '').trim(),
    Address: String(input.Address || '').trim()
  });
}

function resolveRegisterVehicle(input, customerId, current) {
  var vehicleId = String(input.VehicleID || (current ? current.VehicleID : '') || '').trim();
  if (vehicleId) {
    var existing = Database.findById('VEHICLES', vehicleId);
    if (!existing) throw new Error('Kendaraan tidak ditemukan.');
    if (String(existing.CustomerID) !== String(customerId)) throw new Error('Kendaraan tidak sesuai dengan customer.');
    return existing;
  }

  var plate = String(input.PlateNumber || '').toUpperCase().replace(/\s+/g, ' ').trim();
  var brand = String(input.Brand || '').trim();
  var model = String(input.Model || '').trim();
  if (!plate || !brand) throw new Error('Kendaraan baru wajib memiliki nomor polisi dan merek.');
  return VehicleModule.save({
    CustomerID: customerId,
    PlateNumber: plate,
    Brand: brand,
    Model: model,
    Year: String(input.Year || '').trim(),
    Color: String(input.Color || '').trim(),
    LastKM: Number(input.LastKM || input.Odometer || 0)
  });
}

function findActiveWorkOrderForRegister(input, current) {
  var vehicleId = String(input.VehicleID || (current ? current.VehicleID : '') || '').trim();
  if (!vehicleId) return null;
  return Database.all('WORKORDER').find(function(record) {
    if (String(record.VehicleID || '') !== vehicleId) return false;
    return [WORK_ORDER_STATUS.PENDING, WORK_ORDER_STATUS.IN_PROGRESS].indexOf(String(record.Status || '').toUpperCase()) >= 0;
  }) || null;
}

function registerDateValue(value) {
  if (value instanceof Date) return value;
  var raw = String(value || '').trim();
  if (!raw) return new Date();
  var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  var parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function registerNumberSeed(date) {
  var source = registerDateValue(date);
  return Utilities.formatDate(source, DATABASE.TIME_ZONE, 'yyMMdd');
}

function generateRegisterNo(date) {
  var seed = registerNumberSeed(date);
  var prefix = 'R' + seed;
  var highest = Database.all('REGISTER', { noCache: true }).reduce(function(max, record) {
    var id = String(record.RegisterNo || '');
    if (id.indexOf(prefix) !== 0) return max;
    var sequence = Number(id.slice(prefix.length));
    return isNaN(sequence) ? max : Math.max(max, sequence);
  }, 0);
  return prefix + String(highest + 1).padStart(2, '0');
}

function parseMoneyLike(value) {
  var digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function branchLabel(value) {
  var branch = String(value || '').trim().toUpperCase();
  if (branch === 'D' || branch === 'PERINTIS') return 'PERINTIS';
  if (branch === 'C' || branch === 'CAKALANG') return 'CAKALANG';
  if (branch === 'M' || branch === 'MAMUJU') return 'MAMUJU';
  return branch || '-';
}

function registerStatusLabel(value) {
  var status = String(value || '').trim().toUpperCase();
  if (status === REGISTER_STATUS.WO_CREATED) return 'LANJUT WO';
  if (status === REGISTER_STATUS.PENDING) return 'PENDING';
  if (status === REGISTER_STATUS.CANCELLED) return 'BATAL';
  return 'REGISTER';
}

function rupiahText(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function registerList(search) { return RegisterModule.list(search); }
function registerGet(registerNo) { return RegisterModule.get(registerNo); }
function registerFormOptions() { return RegisterModule.formOptions(); }
function registerSave(data) { return RegisterModule.save(data); }
function registerPending(data) { return RegisterModule.pending(data); }
function registerProceed(data) { return RegisterModule.proceed(data); }
function registerDelete(registerNo) { return RegisterModule.remove(registerNo); }
