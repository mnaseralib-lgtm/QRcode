# QR Attendance Web App

تطبيق ويب خفيف لتسجيل حضور وانصراف عبر مسح QR أو إدخال يدوي، مع إرسال البيانات إلى Google Sheets عبر Google Apps Script.

## الملفات
- `index.html` — واجهة المستخدم
- `style.css` — تنسيقات الواجهة
- `script.js` — منطق المسح والإرسال

## خطوات الإعداد السريع
1. **إنشاء Google Sheet** أو استخدم الورقة التي أرفقتها.
2. افتح محرر Google Apps Script (Extensions -> Apps Script) والصق كود `doPost(e)` الموجود لديك في ملف الـ Script.
3. قم بتعديل اسم الورقة داخل الكود `getSheetByName("Attendance")` ليتطابق مع اسم ورقتك.
4. انشر الـ Apps Script كـ Web App:
   - اختر *Deploy* → *New deployment* → اختر *Web app*.
   - تحت *Who has access* اختَر *Anyone* أو *Anyone, even anonymous* (حسب حاجتك).
   - انسخ رابط الـ Web App.
5. في ملف `script.js` استبدل قيمة `GAS_URL` بالرابط المنسوخ.
6. ارفع الملفات إلى GitHub (أو استعمل Git local ثم `git push`).

## ملاحظات أمنية
- إذا جعلت الـ Web App قابلاً للوصول من أي أحد، فسيستطيع أي شخص إرسال بيانات إلى الـ Sheet إذا عرف الرابط. أنصح بحراجة الرابط أو إضافة آلية تحقق بسيطة (مثل مفتاح API في payload).

## هل تريد مني؟
- أستطيع تعديل الكود ليضيف مفتاح تحقق بسيط (API_KEY) أو لحفظ سجل أفضل في Google Sheet (أعمدة إضافية: اسم، المكان، ملاحظات).
- أستطيع أيضاً تجهيز ملف ZIP جاهز للتحميل أو إرشادك خطوة بخطوة لرفع المستودع.
