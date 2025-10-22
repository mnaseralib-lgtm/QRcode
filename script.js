/*
  هام: ضع رابط Web App (Google Apps Script) بعد النشر في GAS_URL
*/

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyA2RHTatE-2KG0Nl9q6LetCHJi233n9yNXh7KuHKGmnRyoALqvdH4zRXMXXiCtTWcHGg/exec'; // <<< ضع هنا رابط الويب الخاص بك!

let currentMovement = 'حضور';
let scanCount = Number(localStorage.getItem('qr_scan_count') || 0);

// العناصر الثابتة (DOM elements) - يجب أن تكون معرفة قبل الاستخدام
const countEl = document.getElementById('count');
const logList = document.getElementById('logList');
const messageEl = document.getElementById('message');
const manualIdInput = document.getElementById('manualId');
const manualSendButton = document.getElementById('manualSend');
const startButton = document.getElementById('startBtn');
const stopButton = document.getElementById('stopBtn');

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

    const newEntry = {
        employeeID,
        movement,
        time: localTime, 
        status
    };
    logs.push(newEntry);
    
    // حافظ على آخر 20 إدخال فقط لمنع امتلاء التخزين المحلي
    if (logs.length > 20) {
        logs.shift(); // إزالة أقدم إدخال
    }
    localStorage.setItem('qr_log_list', JSON.stringify(logs));
    
    return newEntry;
}

// ----------------------------------------------------
// وظيفة الإرسال الرئيسية (CORE FUNCTION)
// ----------------------------------------------------

async function sendRecord(employeeID, movement) {
  showMessage('جارٍ الإرسال...');
  
  // إيقاف الماسح لمنع القراءة المزدوجة
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
      isSuccess = true;
      finalStatus = 'تم الإرسال';
      message = `نجاح: ${employeeID} - ${movement}`;
      updateScanCount(); 
    } else {
      const errorText = await response.text();
      console.error('GAS Error Response:', errorText);
      throw new Error(`خطأ في استجابة الشبكة: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending record:', error);
    message = `فشل إرسال: ${employeeID} - ${error.message}`;
    finalStatus = 'فشل الإرسال';
  } 
  
  // تحديث السجل المحلي والواجهة (UI)
  const logEntry = addLogEntryToStorage(employeeID, movement, finalStatus);
  appendLog(logEntry.employeeID, logEntry.movement, logEntry.time, logEntry.status);

  // عرض رسالة النجاح/الفشل
  showMessage(message, !isSuccess);

  // استئناف الماسح بعد فترة وجيزة
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

    startButton.disabled = true;
    stopButton.disabled = false;

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
    console.error('Camera startup error:', e);
    showMessage('تعذر تشغيل الكاميرا — افحص الأذونات', true);
  }
}

async function stopCamera(){
  try {
    if (html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
    startButton.disabled = false;
    stopButton.disabled = true;
    showMessage('تم إيقاف الكاميرا');
  } catch(e){
    console.error('Camera stop error:', e);
    showMessage('خطأ عند إيقاف الكاميرا', true);
  }
}

// ----------------------------------------------------
// تهيئة التطبيق وربط الأحداث (Initialization)
// ----------------------------------------------------

function loadInitialLogs(){
  const logs = JSON.parse(localStorage.getItem('qr_log_list') || '[]');
  // نعرض السجلات بترتيب زمني معكوس (الأحدث أولاً في الواجهة)
  logs.reverse().forEach(entry => {
    // نستخدم appendLog لإنشاء العنصر الجديد وعرضه في الواجهة (يتم إضافته إلى الأعلى باستخدام prepend)
    appendLog(entry.employeeID, entry.movement, entry.time, entry.status);
  });
}

function initApp() {
    // 1. ربط أزرار الحركة (Movement buttons)
    document.querySelectorAll('.movement').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.movement').forEach(b=>b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentMovement = e.currentTarget.dataset.movement;
      });
    });

    // 2. ربط الإدخال اليدوي (Manual send)
    manualSendButton.addEventListener('click', () => {
      const id = manualIdInput.value.trim();
      if (!id) return showMessage('أدخل رقم صالح', true);
      
      sendRecord(id, currentMovement);
      manualIdInput.value = ''; // مسح الحقل بعد الإرسال
    });

    // 3. ربط وظائف الكاميرا بالأزرار
    startButton.addEventListener('click', startCamera);
    stopButton.addEventListener('click', stopCamera);
    
    // 4. تحميل السجل الأولي
    loadInitialLogs();
}

// تشغيل دالة التهيئة مباشرة لأن السكربت موجود في نهاية ملف index.html
initApp();
