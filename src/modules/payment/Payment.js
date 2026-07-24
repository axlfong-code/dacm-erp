/** Payment collection with invoice balance validation. */
const PaymentModule = Object.freeze({
  list: function(search) {
    var keyword = String(search || '').trim().toLowerCase();
    return Database.all('PAYMENT').filter(function(payment) { return !keyword || [payment.PaymentNo, payment.InvoiceNo, payment.ReferenceNo].some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; }); })
      .map(function(payment) { return Object.assign({}, payment, { PaymentDateText: Utils.formatDate(payment.PaymentDate, APP.DATE_FORMAT) }); })
      .sort(function(a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
  },
  save: function(input) {
    input = input || {};
    var invoice = Database.findById('INVOICE', input.InvoiceNo);
    if (!invoice || invoice.Status === 'PAID') throw new Error('Invoice tidak ditemukan atau sudah lunas.');
    var amount = Number(input.Amount);
    if (!isFinite(amount) || amount <= 0) throw new Error('Nominal pembayaran harus lebih besar dari nol.');
    var paid = Database.query('PAYMENT', { InvoiceNo: invoice.InvoiceNo }).reduce(function(total, payment) { return total + Number(payment.Amount || 0); }, 0);
    var balance = Number(invoice.GrandTotal) - paid;
    if (amount > balance) throw new Error('Pembayaran melebihi sisa tagihan (' + balance + ').');
    var payment = Database.insert('PAYMENT', { InvoiceNo: invoice.InvoiceNo, PaymentDate: parseDate(input.PaymentDate), Method: String(input.Method || '').trim(), Amount: amount, ReferenceNo: String(input.ReferenceNo || '').trim() });
    var newBalance = balance - amount;
    Database.update('INVOICE', invoice.InvoiceNo, { Status: newBalance === 0 ? 'PAID' : 'PARTIAL' });
    if (newBalance === 0 && invoice.WorkOrderNo) {
      try { workOrderMarkPaid(invoice.WorkOrderNo); } catch (e) {}
    }
    return payment;
  },
  remove: function(paymentNo) {
    var payment = Database.findById('PAYMENT', paymentNo);
    if (!payment) throw new Error('Pembayaran tidak ditemukan.');
    var invoice = Database.findById('INVOICE', payment.InvoiceNo);
    Database.remove('PAYMENT', payment.PaymentNo);
    if (invoice) {
      var paid = Database.query('PAYMENT', { InvoiceNo: invoice.InvoiceNo }).reduce(function(total, row) { return total + Number(row.Amount || 0); }, 0);
      var total = Number(invoice.GrandTotal || 0);
      Database.update('INVOICE', invoice.InvoiceNo, { Status: paid >= total ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID') });
      if (invoice.WorkOrderNo && paid < total) {
        try { Database.update('WORKORDER', invoice.WorkOrderNo, { Status: WORK_ORDER_STATUS.DONE }); } catch (e) {}
      }
    }
    return { success: true, PaymentNo: payment.PaymentNo, InvoiceNo: payment.InvoiceNo };
  }
});

function paymentList(invoiceNo) { return PaymentModule.list(invoiceNo); }
function paymentSave(data) { return PaymentModule.save(data); }
function paymentDelete(paymentNo) { return PaymentModule.remove(paymentNo); }
