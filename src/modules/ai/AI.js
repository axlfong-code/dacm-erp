/** AI assistant for safe operational drafting and confirmed ERP actions. */
const AiModule = Object.freeze({
  chat: function(input) {
    input = input || {};
    var message = String(input.message || '').trim();
    Utils.require(message, 'Pesan AI wajib diisi.');
    var deterministic = handleDeterministicAiChat(message);
    if (deterministic) return deterministic;

    var props = PropertiesService.getScriptProperties();
    var groqKey = String(props.getProperty('GROQ_API_KEY') || '').trim();
    var openAiKey = String(props.getProperty('OPENAI_API_KEY') || '').trim();
    if (!groqKey && !openAiKey) {
      return {
        reply: 'Chat AI belum aktif karena API key belum diisi. Isi GROQ_API_KEY di Script Properties untuk memakai Groq, atau OPENAI_API_KEY untuk OpenAI.',
        action: null
      };
    }

    var context = buildAiContext();
    var history = sanitizeAiHistory(input.history);
    if (groqKey) return callGroqAi(groqKey, context, message, history);
    return callOpenAi(openAiKey, context, message, history);
  },
  execute: function(action) {
    action = action || {};
    var type = String(action.type || '').trim().toUpperCase();
    var data = action.data || {};
    if (type === 'CREATE_CUSTOMER') return { message: 'Customer tersimpan.', record: CustomerModule.save(data) };
    if (type === 'CREATE_VEHICLE') return { message: 'Kendaraan tersimpan.', record: VehicleModule.save(data) };
    if (type === 'CREATE_CUSTOMER_VEHICLE_WORK_ORDER') return createCustomerVehicleWorkOrderFromAi(data);
    if (type === 'CREATE_WORK_ORDER') return { message: 'Work Order tersimpan.', record: WorkOrderModule.save(data) };
    if (type === 'UPDATE_WORK_ORDER') return { message: 'Work Order terupdate.', record: WorkOrderModule.save(data) };
    if (type === 'PROCEED_WORK_ORDER') return { message: 'WO lanjut dikerjakan.', record: WorkOrderModule.proceed(data.WorkOrderNo, data.Notes || 'Dilanjutkan via Chat AI') };
    if (type === 'FINISH_WORK_ORDER') return { message: 'WO selesai.', record: WorkOrderModule.finish(data.WorkOrderNo, data.Notes || 'Diselesaikan via Chat AI', data) };
    if (type === 'CREATE_INVOICE') return { message: 'Invoice dibuat.', record: InvoiceModule.create(data) };
    if (type === 'CREATE_PAYMENT') return { message: 'Pembayaran tersimpan.', record: PaymentModule.save(data) };
    throw new Error('Aksi AI tidak dikenal: ' + type);
  }
});

function handleDeterministicAiChat(message) {
  var draft = getAiDraft();
  var parsedInput = parseAiCustomerVehicleInput(message);
  if (parsedInput) {
    draft = Object.assign({}, draft || {}, parsedInput);
    setAiDraft(draft);
    if (!draft.Phone) return { reply: 'Nomor telepon belum terbaca. Ketik contoh: INPUT ' + draft.CustomerName + ' 085xxxxxxxx ' + (draft.PlateNumber || '') + ' ' + (draft.Brand || ''), action: null };
    if (!draft.PlateNumber || !draft.Brand) return { reply: 'Data kendaraan belum lengkap. Ketik no polisi dan merek/model kendaraan.', action: null };
    return buildAiDraftReply(draft);
  }

  if (draft && isAiYes(message)) {
    if (!draft.Complaint) {
      return { reply: 'Baik. Silakan berikan keluhan kendaraan ' + formatAiVehicleText(draft) + '.', action: null };
    }
    clearAiDraft();
    return buildAiWorkOrderAction(draft);
  }

  if (draft && !draft.Complaint && looksLikeComplaint(message)) {
    draft.Complaint = message;
    setAiDraft(draft);
    clearAiDraft();
    return buildAiWorkOrderAction(draft);
  }

  if (/^(hapus|batal|cancel)\b/i.test(message) && draft) {
    clearAiDraft();
    return { reply: 'Draft AI dibatalkan.', action: null };
  }

  return null;
}

function parseAiCustomerVehicleInput(message) {
  var text = String(message || '').trim();
  var isInput = /^(input|buat|tambah|\+)/i.test(text);
  var phoneMatch = text.match(/(?:\+?62|0)\d{8,14}/);
  if (!isInput && !phoneMatch) return null;

  var cleaned = text.replace(/^(input|buat|tambah|\+)\s*/i, '').trim();
  var phone = phoneMatch ? phoneMatch[0] : '';
  cleaned = phone ? cleaned.replace(phone, ' ') : cleaned;
  var plateMatch = cleaned.match(/\b[A-Z]{1,2}\s*\d{1,5}\s*[A-Z]{0,3}\b/i);
  var plate = plateMatch ? normalizePlate(plateMatch[0]) : '';
  cleaned = plateMatch ? cleaned.replace(plateMatch[0], ' ') : cleaned;

  var tokens = cleaned.split(/\s+/).filter(Boolean);
  var vehicleStart = findAiVehicleStart(tokens);
  var nameTokens = vehicleStart >= 0 ? tokens.slice(0, vehicleStart) : tokens;
  var vehicleTokens = vehicleStart >= 0 ? tokens.slice(vehicleStart) : [];

  var result = {};
  if (nameTokens.length) result.CustomerName = nameTokens.join(' ').toUpperCase();
  if (phone) result.Phone = phone;
  if (plate) result.PlateNumber = plate;
  if (vehicleTokens.length) {
    result.Brand = vehicleTokens[0].toUpperCase();
    result.Model = vehicleTokens.slice(1).join(' ');
  }
  result.Branch = APP.DEFAULT_BRANCH || 'D';
  return result.CustomerName || result.Phone || result.PlateNumber || result.Brand ? result : null;
}

function findAiVehicleStart(tokens) {
  var brands = ['TOYOTA','DAIHATSU','HONDA','SUZUKI','MITSUBISHI','NISSAN','DATSUN','KIA','HYUNDAI','MAZDA','WULING','BMW','MERCEDES','FORD','CHEVROLET','ISUZU'];
  for (var i = 0; i < tokens.length; i++) {
    if (brands.indexOf(String(tokens[i] || '').toUpperCase()) >= 0) return i;
  }
  return -1;
}

function normalizePlate(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function looksLikeComplaint(message) {
  var text = String(message || '').trim();
  if (!text) return false;
  if (/^(ya|iya|ok|oke|lanjut|setuju)$/i.test(text)) return false;
  if (/^(input|buat|tambah|\+)/i.test(text)) return false;
  return true;
}

function isAiYes(message) {
  return /^(ya|iya|y|ok|oke|lanjut|setuju|buat|buatkan)$/i.test(String(message || '').trim());
}

function buildAiDraftReply(draft) {
  var existingCustomer = findAiCustomer(draft);
  var existingVehicle = findAiVehicle(draft);
  if (existingCustomer && existingVehicle) {
    draft.CustomerID = existingCustomer.CustomerID;
    draft.VehicleID = existingVehicle.VehicleID;
    setAiDraft(draft);
    return { reply: 'Data pelanggan dan kendaraan sudah ada. Silakan berikan keluhan untuk dibuatkan WO.', action: null };
  }
  return {
    reply: 'Pelanggan ' + (draft.CustomerName || '-') + ' dengan nomor telepon ' + (draft.Phone || '-') + ' dan kendaraan ' + formatAiVehicleText(draft) + ' belum lengkap/terdaftar. Silakan berikan keluhan kendaraan.',
    action: null
  };
}

function buildAiWorkOrderAction(draft) {
  var existingCustomer = findAiCustomer(draft);
  var existingVehicle = findAiVehicle(draft);
  if (existingCustomer && existingVehicle) {
    return {
      reply: 'Saya siapkan draft WO untuk ' + existingCustomer.CustomerName + ' - ' + existingVehicle.PlateNumber + '.',
      action: {
        type: 'CREATE_WORK_ORDER',
        label: 'WO Baru',
        data: {
          CustomerID: existingCustomer.CustomerID,
          VehicleID: existingVehicle.VehicleID,
          Complaint: draft.Complaint,
          Branch: draft.Branch || APP.DEFAULT_BRANCH || 'D'
        }
      }
    };
  }
  return {
    reply: 'Saya siapkan draft untuk membuat customer, kendaraan, dan WO baru. Keluhan: ' + draft.Complaint + '.',
    action: {
      type: 'CREATE_CUSTOMER_VEHICLE_WORK_ORDER',
      label: 'Customer + Kendaraan + WO Baru',
      data: {
        CustomerName: draft.CustomerName,
        Phone: draft.Phone,
        WhatsApp: draft.Phone,
        PlateNumber: draft.PlateNumber,
        Brand: draft.Brand,
        Model: draft.Model || '',
        Complaint: draft.Complaint,
        Branch: draft.Branch || APP.DEFAULT_BRANCH || 'D'
      }
    }
  };
}

function findAiCustomer(draft) {
  var phone = String(draft.Phone || '').replace(/\D/g, '');
  var name = String(draft.CustomerName || '').trim().toLowerCase();
  return CustomerModule.list('').filter(function(customer) {
    var customerPhone = String(customer.Phone || customer.WhatsApp || '').replace(/\D/g, '');
    var customerName = String(customer.CustomerName || '').trim().toLowerCase();
    return (phone && customerPhone === phone) || (name && customerName === name);
  })[0] || null;
}

function findAiVehicle(draft) {
  var plate = normalizePlate(draft.PlateNumber);
  if (!plate) return null;
  return VehicleModule.list('').filter(function(vehicle) {
    return normalizePlate(vehicle.PlateNumber) === plate;
  })[0] || null;
}

function formatAiVehicleText(draft) {
  return [draft.PlateNumber, draft.Brand, draft.Model].filter(Boolean).join(' ');
}

function getAiDraft() {
  var raw = CacheService.getScriptCache().get('dacm:ai:draft');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (error) { return null; }
}

function setAiDraft(draft) {
  CacheService.getScriptCache().put('dacm:ai:draft', JSON.stringify(draft || {}), 21600);
}

function clearAiDraft() {
  CacheService.getScriptCache().remove('dacm:ai:draft');
}

function callOpenAi(key, context, message, history) {
    var inputMessages = [{ role: 'system', content: buildAiSystemPrompt() }];
    (history || []).forEach(function(item) { inputMessages.push(item); });
    inputMessages.push({ role: 'user', content: 'KONTEKS ERP TERBARU:\n' + JSON.stringify(context) + '\n\nPESAN USER TERBARU:\n' + message });
    var payload = {
      model: getAiModel(),
      input: inputMessages
    };

    var response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code < 200 || code >= 300) throw new Error(formatAiApiError('OpenAI', code, body));
    return normalizeAiResponse(extractOpenAiText(JSON.parse(body)));
}

function callGroqAi(key, context, message, history) {
  var messages = [{ role: 'system', content: buildAiSystemPrompt() }];
  (history || []).forEach(function(item) { messages.push(item); });
  messages.push({ role: 'user', content: 'KONTEKS ERP TERBARU:\n' + JSON.stringify(context) + '\n\nPESAN USER TERBARU:\n' + message });
  var payload = {
    model: getGroqModel(),
    messages: messages,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  };
  var response = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code < 200 || code >= 300) throw new Error(formatAiApiError('Groq', code, body));
  var result = JSON.parse(body);
  var text = result.choices && result.choices[0] && result.choices[0].message ? result.choices[0].message.content : '';
  return normalizeAiResponse(text);
}

function buildAiSystemPrompt() {
  return [
    'Anda adalah DACM ERP AI untuk bengkel AC mobil.',
    'Jawab dalam Bahasa Indonesia yang ringkas.',
    'Tugas utama: bantu user mencari arah kerja dan membuat draft aksi ERP.',
    'Gunakan riwayat percakapan untuk memahami kata lanjutan seperti "ya", "lanjutkan", "buat wo baru", atau "pakai data tadi".',
    'Jangan mengarang ID. Jika perlu CustomerID, VehicleID, WorkOrderNo, atau InvoiceNo, gunakan dari konteks yang diberikan.',
    'Jika customer dan kendaraan belum terdaftar lalu user setuju membuat data baru dan memberi keluhan, buat action CREATE_CUSTOMER_VEHICLE_WORK_ORDER dengan data CustomerName, Phone, PlateNumber, Brand, Model, Complaint, Branch.',
    'Jika data kurang untuk aksi simpan, beri reply menanyakan data yang kurang dan action harus null.',
    'Jangan meminta user mengetik CustomerID atau VehicleID jika data customer/kendaraan sudah bisa dikenali dari konteks atau riwayat.',
    'Jika user ingin membuat WO dari kendaraan yang sudah dikenali tetapi keluhan belum ada, tanyakan keluhannya saja.',
    'Aksi simpan/update hanya berupa draft; eksekusi tetap menunggu konfirmasi user.',
    'Untuk CREATE_WORK_ORDER wajib ada CustomerID, VehicleID, Complaint. Branch default D jika tidak disebut.',
    'Untuk CREATE_CUSTOMER_VEHICLE_WORK_ORDER wajib CustomerName, Phone, PlateNumber, Brand, Complaint. Model boleh kosong jika tidak diketahui.',
    'Untuk CREATE_VEHICLE wajib ada CustomerID, PlateNumber, Brand.',
    'Untuk CREATE_PAYMENT wajib ada InvoiceNo, Amount, Method.',
    'Untuk CREATE_INVOICE wajib WorkOrderNo dan GrandTotal.',
    'Balas hanya JSON valid tanpa markdown, bentuk: {"reply":"...","action":null} atau {"reply":"...","action":{"type":"CREATE_WORK_ORDER","label":"...","data":{...}}}.'
  ].join('\n');
}

function createCustomerVehicleWorkOrderFromAi(data) {
  data = data || {};
  var customer = CustomerModule.save({
    CustomerName: data.CustomerName,
    Phone: data.Phone,
    WhatsApp: data.WhatsApp || data.Phone,
    Address: data.Address || ''
  });
  var vehicle = VehicleModule.save({
    CustomerID: customer.CustomerID,
    PlateNumber: data.PlateNumber,
    Brand: data.Brand,
    Model: data.Model || '',
    Year: data.Year || '',
    Color: data.Color || '',
    LastKM: data.LastKM || 0
  });
  var workOrder = WorkOrderModule.save({
    CustomerID: customer.CustomerID,
    VehicleID: vehicle.VehicleID,
    Complaint: data.Complaint,
    Observation: data.Observation || '',
    Recommendation: data.Recommendation || '',
    Notes: data.Notes || 'Dibuat via Chat AI',
    TechnicianID: data.TechnicianID || '',
    Branch: data.Branch || APP.DEFAULT_BRANCH || 'D'
  });
  return {
    message: 'Customer, kendaraan, dan Work Order berhasil dibuat.',
    record: {
      customer: customer,
      vehicle: vehicle,
      workOrder: workOrder
    }
  };
}

function sanitizeAiHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-10).map(function(item) {
    var role = item && item.role === 'assistant' ? 'assistant' : 'user';
    var content = String(item && item.content || '').slice(0, 2000);
    return { role: role, content: content };
  }).filter(function(item) { return item.content; });
}

function getAiModel() {
  var configured = String(PropertiesService.getScriptProperties().getProperty('OPENAI_MODEL') || '').trim();
  if (!configured || configured === 'gpt-5.1-mini') return 'gpt-5-mini';
  return configured;
}

function getGroqModel() {
  return String(PropertiesService.getScriptProperties().getProperty('GROQ_MODEL') || '').trim() || 'llama-3.3-70b-versatile';
}

function buildAiContext() {
  return {
    today: Utils.formatDate(new Date(), APP.DATE_FORMAT),
    customers: CustomerModule.list('').slice(0, 30).map(function(c) {
      return { CustomerID: c.CustomerID, CustomerName: c.CustomerName, Phone: c.Phone, WhatsApp: c.WhatsApp };
    }),
    vehicles: VehicleModule.list('').slice(0, 40).map(function(v) {
      return { VehicleID: v.VehicleID, CustomerID: v.CustomerID, CustomerName: v.CustomerName, PlateNumber: v.PlateNumber, Brand: v.Brand, Model: v.Model, LastKM: v.LastKM };
    }),
    workOrders: WorkOrderModule.list('').slice(0, 40).map(function(wo) {
      return { WorkOrderNo: wo.WorkOrderNo, CustomerID: wo.CustomerID, CustomerName: wo.CustomerName, VehicleID: wo.VehicleID, PlateNumber: wo.PlateNumber, Status: wo.Status, Complaint: wo.Complaint, EstimatedTotal: wo.EstimatedTotal, InvoiceNo: wo.InvoiceNo };
    }),
    invoices: InvoiceModule.list('').slice(0, 30).map(function(inv) {
      return { InvoiceNo: inv.InvoiceNo, WorkOrderNo: inv.WorkOrderNo, CustomerName: inv.CustomerName, PlateNumber: inv.PlateNumber, GrandTotal: inv.GrandTotal, PaidAmount: inv.PaidAmount, Balance: inv.Balance, Status: inv.Status };
    })
  };
}

function extractOpenAiText(result) {
  if (result.output_text) return result.output_text;
  var output = result.output || [];
  for (var i = 0; i < output.length; i++) {
    var content = output[i].content || [];
    for (var j = 0; j < content.length; j++) {
      if (content[j].text) return content[j].text;
    }
  }
  throw new Error('Respons AI kosong.');
}

function normalizeAiResponse(text) {
  text = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  var parsed = typeof text === 'string' ? JSON.parse(text) : text;
  return { reply: String(parsed.reply || ''), action: parsed.action || null };
}

function formatAiApiError(provider, code, body) {
  var message = body;
  try {
    var parsed = JSON.parse(body);
    message = parsed.error && parsed.error.message ? parsed.error.message : body;
  } catch (error) {}
  if (code === 401) return provider + ' API key tidak valid atau belum aktif.';
  if (code === 429) return provider + ' quota/rate limit habis. Cek billing, limit, atau tunggu beberapa saat.';
  if (code === 400 && String(message).toLowerCase().indexOf('model') >= 0) return provider + ' model tidak tersedia: ' + message;
  return provider + ' API error ' + code + ': ' + message;
}

function aiChat(input) { return AiModule.chat(input); }
function aiExecuteAction(action) { return AiModule.execute(action); }
