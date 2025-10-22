/*
  قبل الاستخدام: ضع رابط Web App (Google Apps Script) بعد النشر في GAS_URL
  خطوات سريعة لنشر GAS:
  1. في محرر Google Apps Script اختر Deploy -> New deployment -> Web app
  2. تعيّن "Who has access" إلى "Anyone" أو "Anyone, even anonymous" إذا لزم
  3. انسخ رابط Web app وأدخله في GAS_URL أدناه
*/

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyA2RHTatE-2KG0Nl9q6LetCHJi233n9yNXh7KuHKGmnRyoALqvdH4zRXmXXiCtTWcHGg/exec'; // <<< ضع هنا رابط الويب الذي تحصل عليه بعد النشر

let currentMovement = 'حضور';
let scanCount = Number(localStorage.getItem('qr_scan_count') || 0);
const countEl = document.getElementById('count');
const logList = document.getElementById('logList');
const messageEl = document.getElementById('message');
countEl.textContent = scanCount;

// Movement buttons
document.querySelectorAll('.movement').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.movement').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentMovement = btn.dataset.movement;
  });
});

// Manual send
document.getElementById('manualSend').addEventListener('click', () => {
  const id = document.getElementById('manualId').value.trim();
  if (!id) return showMessage('أدخل رقم صالح');
  sendRecord(id, currentMovement);
  document.getElementById('manualId').value = '';
});

function showMessage(txt, isError=false){
  messageEl.textContent = txt;
  messageEl.style.color = isError ? '#c0392b' : '#111';
  setTimeout(()=>{ messageEl.textContent = '' }, 3500);
}

function appendLog(employeeID, movement){
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleString()} — ${movement} — ${employeeID}`;
  logList.insertBefore(li, logList.firstChild);
}

function incCount(){
  scanCount += 1;
  localStorage.setItem('qr_scan_count', scanCount);
  countEl.textContent = scanCount;
}

async function sendRecord(employeeID, movement){
  if (!GAS_URL || GAS_URL.includes('PASTE_YOUR')){
    showMessage('ضع رابط Web App الخاص بك في script.js', true);
    return;
  }

  const payload = { EmployeeID: employeeID, MovementType: movement };

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (json.status && json.status === 'SUCCESS'){
      incCount();
      appendLog(employeeID, movement);
      showMessage('تم الإرسال بنجاح');
    } else {
      showMessage('فشل الإرسال — تحقق من رابط الـ Web App', true);
    }
  } catch (err){
    console.error(err);
    showMessage('خطأ في الاتصال — راجع الشبكة أو رابط الـ Web App', true);
  }
}

// QR scanner setup using html5-qrcode
const html5QrCode = new Html5Qrcode("reader");
let currentCameraId = null;

async function startCamera() {
  try {
    const devices = await Html5Qrcode.getCameras();
    if (!devices || devices.length === 0) return showMessage('لا توجد كاميرا متاحة', true);
    // اختَر الكاميرا الخلفية إن وُجدت
    const backCamera = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];
    currentCameraId = backCamera.id;

    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;

    await html5QrCode.start(
      currentCameraId,
      { fps: 10, qrbox: {width: 250, height: 150} },
      (decodedText, decodedResult) => {
        // يحدث عند قراءة QR
        // نستخدم decodedText كـ EmployeeID
        sendRecord(decodedText, currentMovement);
      },
      (errorMessage) => {
        // نقص معلومات مسح متكرر — لا نعرضها باستمرار
        // console.log('scan error', errorMessage);
      }
    );
    showMessage('الكاميرا تعمل — وجّه الكاميرا نحو QR');
  } catch (e) {
    console.error(e);
    showMessage('تعذر تشغيل الكاميرا — افحص الأذونات', true);
  }
}

async function stopCamera(){
  try {
    await html5QrCode.stop();
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    showMessage('تم إيقاف الكاميرا');
  } catch(e){
    console.error(e);
    showMessage('خطأ عند إيقاف الكاميرا', true);
  }
}

document.getElementById('startBtn').addEventListener('click', startCamera);
document.getElementById('stopBtn').addEventListener('click', stopCamera);

// عند التحميل: عرض سجل المخزن محلياً (إن وُجد)
(function loadInitial(){
  const logs = JSON.parse(localStorage.getItem('qr_log_list') || '[]');
  logs.reverse().forEach(entry => appendLog(entry.employeeID, entry.movement));
})();

// Append to local log for persistence (optional enhancement)
(function patchSendToStore(){
  const originalSend = sendRecord;
  window.sendRecord = async function(employeeID, movement){
    // push to local store immediately
    const logs = JSON.parse(localStorage.getItem('qr_log_list') || '[]');
    logs.push({ts: new Date().toISOString(), employeeID, movement});
    localStorage.setItem('qr_log_list', JSON.stringify(logs));
    await originalSend(employeeID, movement);
  }
})();
