# إرسال تحديث على واتساب عبر CallMeBot — جاهز للتشغيل
#
# السبب في عدم الإرسال التلقائي حتى الآن:
#   1) حقل phone إلزامي ولم يُعطَ رقم واتساب.
#   2) المفتاح المُعطى 9560419 أعاد CallMeBot: "APIKey is invalid"
#      (جرّبت فعليًا: https://api.callmebot.com/whatsapp.php?phone=9560419&...&apikey=9560419)
#
# طريقة الحصول على مفتاح صحيح:
#   1) أرسل رسالة واتساب إلى +34 644 84 48 44 بالنص: I allow callmebot to send me messages
#   2) سيردّ_bot بمفتاح apikey (6-7 أرقام) + رقمك يظهر في المحادثة.
#   3) ضع الرقم (دولي بدون +) والمفتاح في الحقلين التاليين ثم شغّل:
#        powershell -ExecutionPolicy Bypass -File send-update.ps1

param(
    [string]$Phone = "",    # مثال: 201001234567
    [string]$ApiKey = "",   # المفتاح من CallMeBot
    [string]$Text   = "مِرسم: تحديث جديد — تم إصلاح الترميز واكتمل الفحص بصفر أخطاء"
)

if (-not $Phone -or -not $ApiKey) {
    Write-Host "أدخل -Phone و -ApiKey أولًا (أو عدّل القيمتين الافتراضيتين في أعلى الملف)."
    exit 1
}

# curl.exe يرمّز UTF-8 صحيحاً بخلاف أوامر Invoke-WebRequest القديمة
$args = @(
    "-sS", "-G",
    "https://api.callmebot.com/whatsapp.php",
    "--data-urlencode", "phone=$Phone",
    "--data-urlencode", "text=$Text",
    "--data-urlencode", "apikey=$ApiKey"
)
& curl.exe @args
Write-Host ""
