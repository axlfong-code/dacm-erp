/** Diagnostic findings recorded against a vehicle register. */
const DiagnosisModule = Object.freeze({
  list: function(search) {
    var keyword = String(search || '').trim().toLowerCase();
    return Database.all('DIAGNOSIS').filter(function(record) {
      return !keyword || [record.DiagnosisNo, record.RegisterNo, record.Finding, record.Status].some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; });
    }).map(function(record) {
      var register = Database.findById('REGISTER', record.RegisterNo);
      return Object.assign({}, record, { PlateNumber: register ? (Database.findById('VEHICLES', register.VehicleID) || {}).PlateNumber || '-' : '-', DiagnosisDateText: Utils.formatDate(record.DiagnosisDate, APP.DATE_FORMAT) });
    }).sort(function(a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
  },
  save: function(input) {
    input = input || {};
    var register = Database.findById('REGISTER', input.RegisterNo);
    if (!register) throw new Error('Register tidak ditemukan.');
    var data = { RegisterNo: register.RegisterNo, TechnicianID: String(input.TechnicianID || '').trim(), DiagnosisDate: Utils.parseDate(input.DiagnosisDate), Finding: String(input.Finding || '').trim(), Recommendation: String(input.Recommendation || '').trim(), Status: 'PENDING_APPROVAL' };
    Utils.require(data.TechnicianID, 'Teknisi wajib diisi.'); Utils.require(data.Finding, 'Hasil diagnosa wajib diisi.'); Utils.require(data.Recommendation, 'Rekomendasi perbaikan wajib diisi.');
    var diagnosis = Database.insert('DIAGNOSIS', data);
    Database.update('REGISTER', register.RegisterNo, { Status: 'DIAGNOSED' });
    return diagnosis;
  }
});

function diagnosisList(search) { return DiagnosisModule.list(search); }
function diagnosisSave(data) { return DiagnosisModule.save(data); }
