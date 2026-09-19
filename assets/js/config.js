/* ============================================================
   ملف الإعدادات — عدّلي هذا الملف فقط
   CONFIG FILE — this is the only file you need to edit
   ============================================================ */

window.SITE_CONFIG = {

  /* ---- معلومات الروضة ---- */
  kindergartenName: "جمعية فتاة الخليج",
  directorName: "ملاك المهاجري",
  nationalDayNumber: "٩٦",

  /* تاريخ اليوم الوطني (الشهر من ١ إلى ١٢) — للعدّ التنازلي */
  nationalDayDate: { year: 2026, month: 9, day: 23 },

  /* ---- التخزين ----
     اتركيها فارغة = وضع التجربة: البيانات تُحفظ في متصفح كل جهاز فقط.
     املأيها ببيانات Supabase = وضع المشاركة: كل الأهالي يرون نفس البصمات.
     خطوات الإعداد في README.md (١٠ دقائق).
  */
  supabaseUrl: "https://vkwqdiezblhunrwbeydt.supabase.co",       // مثال: "https://abcdefgh.supabase.co"
  supabaseAnonKey: "sb_publishable_xo-T7865qkmLarHAA0NbAw_Wy0Gj_Ts",   // المفتاح العام anon public key

  /* اسم مجلد التخزين في Supabase للصور والأصوات */
  storageBucket: "musharakat",

  /* ---- حدود المشاركة ---- */
  maxAudioSeconds: 60,
  maxPhotoMB: 5,
  maxTextChars: 280
};
