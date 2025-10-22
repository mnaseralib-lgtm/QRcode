/*
  هام: ضع رابط Web App (Google Apps Script) بعد النشر في GAS_URL
  ملاحظة: تم تطبيق fix 'DOMContentLoaded' لضمان استجابة التطبيق.
*/

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyA2RHTatE-2KG0Nl9q6LetCHJi233n9yNXh7KuHKGmnRyoALqvdH4zRXMXXiCtTWcHGg/exec'; // <<< ضع هنا رابط الويب الخاص بك!

let currentMovement = 'حضور';
let scanCount = Number(localStorage.getItem('qr_scan_count') || 0);

// تعريف المتغيرات التي ستحمل مراجع عناصر DOM ونسخة الماسح (لتجنب الأعطال المبكرة)
let countEl, logList, messageEl, manualIdInput, manualSendButton, startButton, stopButton;
let html5QrCode;
const qrCodeElementId = 'reader';

// ----------------------------------------------------
// وظائف المساعدة (Helpers)
// ----------------------------------------------------

function showMessage(msg, isError = false) {
  // هذه الدالة تعتمد على 'messageEl' الذي يتم تهيئته في initApp
  if (!messageEl) return; 
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
    
    if (logs.length > 20) {
        logs.shift();
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
  if (html5QrCode && html5QrCode.isScanning) {
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
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.resume();
    }
  }, 3000);
}


// ----------------------------------------------------
// وظائف الكاميرا والتحكم (Camera & Controls)
// ----------------------------------------------------

async function startCamera() {
  try {
    const videoConstraints = { facingMode: "environment" }; 

    startButton.disabled = true;
    stopButton.disabled = false;

    await html5QrCode.start(
      videoConstraints,
      { fps: 10, qrbox: {width: 250, height: 150} },
      (decodedText, decodedResult) => {
        sendRecord(decodedText, currentMovement);
      },
      (errorMessage) => {
        // ...
      }
    );
    showMessage('الكاميرا تعمل — وجّه الكاميرا نحو QR');
  } catch (e) {
    console.error('Camera startup error:', e);
    showMessage('تعذر تشغيل الكاميرا — افحص الأذونات (قد تحتاج HTTPS)', true);
  }
}

async function stopCamera(){
  try {
    if (html5QrCode && html5QrCode.isScanning) {
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
  logs.reverse().forEach(entry => {
    appendLog(entry.employeeID, entry.movement, entry.time, entry.status);
  });
}

function initApp() {
    // 1. الحصول على مراجع العناصر (الذي كان سبب المشكلة)
    countEl = document.getElementById('count');
    logList = document.getElementById('logList');
    messageEl = document.getElementById('message');
    manualIdInput = document.getElementById('manualId');
    manualSendButton = document.getElementById('manualSend');
    startButton = document.getElementById('startBtn');
    stopButton = document.getElementById('stopBtn');

    // 2. تهيئة عداد المسح و ماسح QR
    countEl.textContent = scanCount;
    html5QrCode = new Html5Qrcode(qrCodeElementId);

    // 3. ربط أزرار الحركة (Movement buttons)
    document.querySelectorAll('.movement').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.movement').forEach(b=>b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentMovement = e.currentTarget.dataset.movement;
      });
    });

    // 4. ربط الإدخال اليدوي (Manual send)
    manualSendButton.addEventListener('click', () => {
      const id = manualIdInput.value.trim();
      if (!id) return showMessage('أدخل رقم صالح', true);
      
      sendRecord(id, currentMovement);
      manualIdInput.value = '';
    });

    // 5. ربط وظائف الكاميرا بالأزرار
    startButton.addEventListener('click', startCamera);
    stopButton.addEventListener('click', stopCamera);
    
    // 6. تحميل السجل الأولي
    loadInitialLogs();
}

// *** الحل النهائي لعدم الاستجابة ***
// تشغيل دالة التهيئة فقط بعد أن يجهز هيكل DOM بالكامل.
document.addEventListener('DOMContentLoaded', initApp);
