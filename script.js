/*
  قبل الاستخدام: ضع رابط Web App (Google Apps Script) بعد النشر في GAS_URL
  خطوات سريعة لنشر GAS:
  1. في محرر Google Apps Script اختر Deploy -> New deployment -> Web app
  2. تعيّن "Who has access" إلى "Anyone" أو "Anyone, even anonymous" إذا لزم
  3. انسخ رابط Web app وأدخله في GAS_URL أدناه
*/

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyA2RHTatE-2KG0Nl9q6LetCHJi233n9yNXh7KuHKGmnRyoALqvdH4zRXMXXiCtTWcHGg/exec'; // <<< ضع هنا رابط الويب الخاص بك!

let currentMovement = 'حضور';
let scanCount = Number(localStorage.getItem('qr_scan_count') || 0);
const countEl = document.getElementById('count');
const logList = document.getElementById('logList');
const messageEl = document.getElementById('message');
countEl.textContent = scanCount;

// تهيئة ماسح QR
const qrCodeElementId = 'reader';
const html5QrCode = new Html5Qrcode(qrCodeElementId);

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
  document.getElementById('manualId').value = ''; // مسح الحقل بعد الإرسال
});

function showMessage(msg, isError = false) {
  messageEl.textContent = msg;
  messageEl.className = 'message';
  if (isError) {
    messageEl.classList.add('error');
  } else if (msg) {
    messageEl.classList.add('success');
  }
}

function updateScanCount() {
  scanCount++;
  countEl.textContent = scanCount;
  localStorage.setItem('qr_scan_count', scanCount);
}

function appendLog(employeeID, movement, status = 'تم الإرسال') {
  const listItem = document.createElement('li');
  const now = new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'});
  listItem.innerHTML = `
    <span class="log-id">${employeeID}</span>
    <span class="log-movement">${movement} (${now})</span>
    <span class="log-status">${status}</span>
  `;
  // أضف العنصر الجديد إلى الأعلى
  logList.prepend(listItem);
}

// دالة الإرسال إلى Google Sheets
async function sendRecord(employeeID, movement) {
  showMessage('جارٍ الإرسال...');
  // منع المسح التلقائي لمدة قصيرة لمنع الإرسالات المكررة
  await html5QrCode.pause(); 

  const data = new FormData();
  data.append('employeeID', employeeID);
  data.append('movement', movement);

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: data
    });

    if (response.ok) {
      updateScanCount();
      appendLog(employeeID, movement);
      showMessage(`نجاح: ${employeeID} - ${movement}`, false);
    } else {
      throw new Error(`خطأ في استجابة الشبكة: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending record:', error);
    showMessage(`فشل إرسال: ${employeeID} - ${error.message}`, true);
    appendLog(employeeID, movement, 'فشل الإرسال');
  } finally {
    // استئناف المسح التلقائي بعد 3 ثوانٍ
    setTimeout(() => {
      html5QrCode.resume();
    }, 3000);
  }
}

// تشغيل الكاميرا مع تفضيل الكاميرا الخلفية (المحيط/البيئة)
async function startCamera() {
  try {
    // تحديد تفضيل الكاميرا الخلفية باستخدام facingMode
    const videoConstraints = { 
        // تفضيل الكاميرا الخلفية. استخدام "environment" يزيد من موثوقية التشغيل على الهواتف
        facingMode: "environment" 
    };

    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;

    await html5QrCode.start(
      videoConstraints, // تمرير كائن القيود مباشرة بدلاً من معرف الكاميرا
      { fps: 10, qrbox: {width: 250, height: 150} },
      (decodedText, decodedResult) => {
        // يحدث عند قراءة QR
        sendRecord(decodedText, currentMovement);
      },
      (errorMessage) => {
        // لا نعرض أخطاء المسح المتكررة 
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
  logs.reverse().forEach(entry => appendLog(entry.employeeID, entry.movement, entry.status || 'تم الإرسال'));
})();

// وظيفة لحفظ السجل محليًا
(function patchSendToStore(){
  const originalSend = sendRecord;
  window.sendRecord = async function(employeeID, movement){
    // قم بحفظ البيانات في الذاكرة المحلية قبل الإرسال الفعلي
    const logs = JSON.parse(localStorage.getItem('qr_log_list') || '[]');
    const newEntry = {
        employeeID, 
        movement, 
        ts: new Date().toISOString(),
        status: 'قيد الإرسال'
    };
    logs.push(newEntry);
    localStorage.setItem('qr_log_list', JSON.stringify(logs));
    
    // استدعاء دالة الإرسال الأصلية
    await originalSend(employeeID, movement);

    // تحديث الحالة في الذاكرة المحلية بناءً على نتيجة الإرسال
    const updatedLogs = JSON.parse(localStorage.getItem('qr_log_list') || '[]');
    const lastEntry = updatedLogs.find(log => log.ts === newEntry.ts);
    if (lastEntry) {
        // تحديث الحالة بناءً على ما إذا كان الإرسال ناجحًا أو فاشلاً (بعد تحديث حالة الرسالة)
        lastEntry.status = messageEl.classList.contains('error') ? 'فشل الإرسال' : 'تم الإرسال';
        localStorage.setItem('qr_log_list', JSON.stringify(updatedLogs));
    }
  }
})();
