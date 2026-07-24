/** Approval workflow for a diagnosed register. */
const ApprovalModule = Object.freeze({
  list: function(search) {
    var keyword = String(search || '').trim().toLowerCase();
    return Database.all('APPROVAL').filter(function(record) {
      return !keyword || [record.ApprovalNo, record.RegisterNo, record.Status].some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; });
    }).map(function(record) {
      var register = Database.findById('REGISTER', record.RegisterNo);
      return Object.assign({}, record, { PlateNumber: register ? (Database.findById('VEHICLES', register.VehicleID) || {}).PlateNumber || '-' : '-', ApprovalDateText: Utils.formatDate(record.ApprovalDate, APP.DATE_FORMAT) });
    }).sort(function(a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
  },
  create: function(input) {
    input = input || {};
    var register = Database.findById('REGISTER', input.RegisterNo);
    if (!register) throw new Error('Register tidak ditemukan.');
    if (!Database.query('DIAGNOSIS', { RegisterNo: register.RegisterNo }).length) throw new Error('Register belum memiliki diagnosa.');
    var exists = Database.query('APPROVAL', { RegisterNo: register.RegisterNo, Status: 'PENDING' })[0];
    if (exists) throw new Error('Persetujuan untuk register ini masih menunggu keputusan.');
    return Database.insert('APPROVAL', { RegisterNo: register.RegisterNo, ApprovalDate: new Date(), Status: 'PENDING', ApprovedBy: '', Notes: String(input.Notes || '').trim() });
  },
  decide: function(approvalNo, decision, approvedBy, notes) {
    var approval = Database.findById('APPROVAL', approvalNo);
    if (!approval) throw new Error('Data persetujuan tidak ditemukan.');
    if (approval.Status !== 'PENDING') throw new Error('Persetujuan ini sudah diproses.');
    if (['APPROVED', 'REJECTED'].indexOf(decision) < 0) throw new Error('Keputusan persetujuan tidak valid.');
    Utils.require(String(approvedBy || '').trim(), 'Nama pemberi keputusan wajib diisi.');
    var result = Database.update('APPROVAL', approvalNo, { Status: decision, ApprovedBy: String(approvedBy).trim(), Notes: String(notes || '').trim() });
    Database.update('REGISTER', approval.RegisterNo, { Status: decision });
    return result;
  }
});

function approvalList(search) { return ApprovalModule.list(search); }
function approvalCreate(data) { return ApprovalModule.create(data); }
function approvalDecide(approvalNo, decision, approvedBy, notes) { return ApprovalModule.decide(approvalNo, decision, approvedBy, notes); }
