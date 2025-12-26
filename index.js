const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const { PrayerTimes, CalculationMethod, Coordinates } = require('adhan');

// ضبط إحداثيات عمان، الأردن
const coordinates = new Coordinates(31.9539, 35.9106);
const params = CalculationMethod.MuslimWorldLeague();
params.madhab = 'Shafi';

// رقم القروب
const groupId = '123456789012-3456789@g.us'; // ضع هنا الـ Group ID

const client = new Client({
    authStrategy: new LocalAuth()
});

// مسح QR
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('📱 امسح QR من واتساب');
});

// تخزين الصلوات المرسلة لتجنب التكرار
let sentToday = {
    fajrReminder: false,
    dhuhrReminder: false,
    asrReminder: false,
    maghribReminder: false,
    ishaReminder: false,
    fajrAdkar: false,
    asrAdkar: false,
    lastDate: new Date().getDate()
};

// دالة لحساب فرق الدقائق بين وقتين
function minutesDiff(date1, date2) {
    return Math.round((date2 - date1) / 60000);
}

client.on('ready', () => {
    console.log('✅ البوت اشتغل بنجاح!');

    // ===== الرد التلقائي =====
    client.on('message', message => {
        const text = message.body.toLowerCase();
        if(text === 'مرحبا' || text === 'السلام عليكم') {
            message.reply(' شكراً على رسالتك، رح نرد عليك بأقرب وقت.');
        }
    });

    // ===== جدولة الأذكار والتذكيرات =====
    cron.schedule('* * * * *', () => { // كل دقيقة
        const now = new Date();

        // إعادة تعيين الحالة يومياً
        if(now.getDate() !== sentToday.lastDate){
            sentToday = {
                fajrReminder: false,
                dhuhrReminder: false,
                asrReminder: false,
                maghribReminder: false,
                ishaReminder: false,
                fajrAdkar: false,
                asrAdkar: false,
                lastDate: now.getDate()
            };
        }

        const times = new PrayerTimes(coordinates, now, params);

        const prayers = [
            { name: 'fajr', label: 'الفجر 🌅', ayah: '﴿ وَقُرْآنَ الْفَجْرِ ۖ إِنَّ قُرْآنَ الْفَجْرِ كَانَ مَشْهُودًا ﴾\nالإسراء: 78', reminderKey: 'fajrReminder', adkarKey: 'fajrAdkar', adkarFile: './اذكار الصباح.jpeg', adkarOffset: 15 },
            { name: 'dhuhr', label: 'الظهر ☀️', ayah: '﴿ أَقِمِ الصَّلَاةَ لِذِكْرِي ﴾\nطه: 14', reminderKey: 'dhuhrReminder' },
            { name: 'asr', label: 'العصر 🌇', ayah: '﴿ حَافِظُوا عَلَى الصَّلَوَاتِ وَالصَّلَاةِ الْوُسْطَىٰ ﴾\nالبقرة: 238', reminderKey: 'asrReminder', adkarKey: 'asrAdkar', adkarFile: './اذكار المساء.jpeg', adkarOffset: 15 },
            { name: 'maghrib', label: 'المغرب 🌆', ayah: '﴿ وَسَبِّحْ بِحَمْدِ رَبِّكَ قَبْلَ غُرُوبِ الشَّمْسِ ﴾\nطه: 130', reminderKey: 'maghribReminder' },
            { name: 'isha', label: 'العشاء 🌙', ayah: '﴿ وَمِنَ اللَّيْلِ فَاسْجُدْ لَهُ وَسَبِّحْهُ لَيْلًا طَوِيلًا ﴾\nالإنسان: 26', reminderKey: 'ishaReminder' }
        ];

        prayers.forEach(prayer => {
            const prayerTime = times[prayer.name];

            // تذكير قبل الصلاة 5 دقائق
            if(!sentToday[prayer.reminderKey] && minutesDiff(now, prayerTime) === 5){
                client.sendMessage(groupId, `🕌 تذكير: ${prayer.label} على وشك أن تبدأ بعد 5 دقائق!\n${prayer.ayah}`);
                sentToday[prayer.reminderKey] = true;
            }

            // إرسال الأذكار بعد الصلاة إذا محدد
            if(prayer.adkarKey && !sentToday[prayer.adkarKey] && minutesDiff(prayerTime, now) === prayer.adkarOffset){
                const media = MessageMedia.fromFilePath(prayer.adkarFile);
                client.sendMessage(groupId, media);
                sentToday[prayer.adkarKey] = true;
            }
        });

        // تذكير قيام الليل عند الساعة 02:30 صباحًا
        if(now.getHours() === 2 && now.getMinutes() === 30){
            client.sendMessage(groupId, '🌙 تذكير: وقت قيام الليل الآن، استغل هذه اللحظة!');
        }

    });
});

client.initialize();
