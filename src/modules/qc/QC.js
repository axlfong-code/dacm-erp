/** Quality-control inspection after work execution. */
const QCModule = Object.freeze({
  list: function(search) {
    var keyword = String(search || '').trim().toLowerCase();
    return Database.all('QC').filter(function(record) {
      return !keyword || [record.QCNo, record.WorkOrderNo, record.InspectorID, record.Status].some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; });
    }).map(function(record) {
      var workOrder = Database.findById('WORKORDER', record.WorkOrderNo);
      return Object.assign({}, record, { RegisterNo: workOrder ? workOrder.RegisterNo : '-', QCDateText: Utils.formatDate(record.QCDate, APP.DATE_FORMAT) });
    }).sort(function(a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
  },
  inspect: function(input) {
    input = input || {};
    var workOrder = Database.findById('WORKORDER', input.WorkOrderNo);
    if (!workOrder || workOrder.Status !== 'COMPLETED') throw new Error('QC hanya dapat dilakukan pada Work Order yang telah selesai.');
    var status = String(input.Status || '').toUpperCase();
    if (['PASS', 'FAIL'].indexOf(status) < 0) throw new Error('Hasil QC harus PASS atau FAIL.');
    var inspector = String(input.InspectorID || '').trim(); Utils.require(inspector, 'Inspector QC wajib diisi.');
    var qc = Database.insert('QC', { WorkOrderNo: workOrder.WorkOrderNo, QCDate: parseDate(input.QCDate), InspectorID: inspector, Status: status, Notes: String(input.Notes || '').trim() });
    Database.update('WORKORDER', workOrder.WorkOrderNo, { Status: status === 'PASS' ? 'QC_PASSED' : 'REWORK' });
    Database.update('REGISTER', workOrder.RegisterNo, { Status: status === 'PASS' ? 'COMPLETED' : 'REWORK' });
    return qc;
  }
});

function qcList(search) { return QCModule.list(search); }
function qcInspect(data) { return QCModule.inspect(data); }
