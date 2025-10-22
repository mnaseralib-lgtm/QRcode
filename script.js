/*
  هام: ضع رابط Web App (Google Apps Script) بعد النشر في GAS_URL
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

// ----------------------------------------------------
// وظائف المساعدة (Helpers)
// ----------------------------------------------------

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

// دالة تحديث سجل الواجهة (UI)
function appendLog(employeeID, movement, time, status) {
  const listItem = document.createElement('li');
  // تحديد اللون بناءً على حالة الإرسال
  const statusColor = status === 'تم الإرسال' ? 'green' : 'red';
  
  listItem.innerHTML = `
    <span class="log-id">${employeeID}</span>
    <span class="log-movement">${movement} (${time})</span>
    <span class="log-status" style="color: ${statusColor};">${status}</span>
  `;
  // أضف العنصر الجديد إلى الأعلى
  logList.prepend(listItem);
}

// دالة إضافة سجل إلى التخزين المحلي
function addLogEntryToStorage(employeeID, movement, status) {
    const logs = JSON.parse(localStorage.getItem('qr_log_list') || '[]');
    const now = new Date();
    const localTime = now.toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'});

    logs.push({
        employeeID,
        movement,
        time: localTime, // نستخدم الوقت المحلي المخزّن مباشرة للعرض
        status
    });
    
    // حافظ على آخر 20 إدخال فقط لمنع امتلاء التخزين المحلي
    if (logs.length > 20) {
        logs.shift(); // إزالة أقدم إدخال
    }
    localStorage.setItem('qr_log_list', JSON.stringify(logs));
    
    // إعادة السجل المضاف لتحديث الواجهة
    return { employeeID, movement, time: localTime, status };
}

// ----------------------------------------------------
// وظيفة الإرسال الرئيسية (CORE FUNCTION)
// ----------------------------------------------------

async function sendRecord(employeeID, movement) {
  showMessage('جارٍ الإرسال...');
  
  // 1. إيقاف الماسح لمنع القراءة المزدوجة
  if (html5QrCode.isScanning) {
     await html5QrCode.pause(); 
  }
  
  const data = new FormData();
  data.append('employeeID', employeeID);
  data.append('movement', movement);

  let isSuccess = false;
  let finalStatus = 'فشل الإرسال';
  let message = '';

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: data
    });

    if (response.ok && response.status === 200) {
      // افتراض أن أي استجابة ناجحة من السيرفر (GAS) تعني نجاح الإرسال
      isSuccess = true;
      finalStatus = 'تم الإرسال';
      message = `نجاح: ${employeeID} - ${movement}`;
      updateScanCount(); // يتم العد فقط عند النجاح
    } else {
      throw new Error(`خطأ في استجابة الشبكة: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending record:', error);
    message = `فشل إرسال: ${employeeID} - ${error.message}`;
    finalStatus = 'فشل الإرسال';
  } 
  
  // 2. تحديث السجل المحلي والواجهة
  const logEntry = addLogEntryToStorage(employeeID, movement, finalStatus);
  appendLog(logEntry.employeeID, logEntry.movement, logEntry.time, logEntry.status);

  // 3. عرض رسالة النجاح/الفشل
  showMessage(message, !isSuccess);

  // 4. استئناف الماسح بعد فترة وجيزة
  setTimeout(() => {
    if (html5QrCode.isScanning) {
        html5QrCode.resume();
    }
  }, 3000); // 3 ثواني تأخير
}


// ----------------------------------------------------
// وظائف الكاميرا والتحكم (Camera & Controls)
// ----------------------------------------------------

async function startCamera() {
  try {
    // تفضيل الكاميرا الخلفية باستخدام facingMode
    const videoConstraints = { facingMode: "environment" }; 

    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;

    await html5QrCode.start(
      videoConstraints,
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


// ----------------------------------------------------
// تهيئة التطبيق (Initialization)
// ----------------------------------------------------

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


// ربط وظائف الكاميرا بالأزرار
document.getElementById('startBtn').addEventListener('click', startCamera);
document.getElementById('stopBtn').addEventListener('click', stopCamera);


// تحميل السجل الأولي عند فتح التطبيق
(function loadInitialLogs(){
  const logs = JSON.parse(localStorage.getItem('qr_log_list') || '[]');
  // يتم تحميل السجلات حسب الترتيب المخزن (الأقدم أولاً) ثم يتم عرضها باستخدام prepend (الأحدث أولاً في الواجهة)
  logs.forEach(entry => appendLog(entry.employeeID, entry.movement, entry.time, entry.status));
})();
