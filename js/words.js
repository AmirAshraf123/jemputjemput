/* What the guest page says, in each card language. English is the fallback for anything missing.
   Values are strings, or functions for wording that includes a number or a name. */
const W = {
  en: {
    join: "Will you join us?", replyBy: (d) => `Please reply by ${d}.`, yes: "Joyfully accept", no: "Regretfully decline",
    howMany: "How many of you are coming?", upTo: (n) => `(up to ${n})`, reserved: (n) => `(${n} ${n === 1 ? "seat" : "seats"} reserved for you)`,
    diet: "Dietary needs", dietPh: "e.g. vegetarian, no seafood", note: (h) => `A note for ${h} (optional)`,
    send: "Send reply", sending: "Sending…", name: "Your name", phone: "Your WhatsApp number",
    numberNote: (h) => `Your number is only shared with ${h}, so they know who replied. Reply once per household.`,
    seeYou: "See you there!", thanksNo: "Thank you for letting us know", saved: (n) => `We've saved ${n} ${n === 1 ? "seat" : "seats"} for you.`, missed: "You'll be missed.",
    change: "Change my reply", someoneElse: (n) => `Not ${n}? Reply for someone else`,
    errName: "Please enter your name.", errPhone: "Please enter your WhatsApp number, so the hosts know who replied.",
    errSend: "Couldn't send your reply. Please check your connection and try again.",
    sent: "Reply sent. Thank you!", updated: "You'd already replied, so we've updated your reply.",
    date: "Date", time: "Time", venue: "Venue", dress: "Dress", maps: "Open in Maps", cal: "Add to Google Calendar",
    reply: "Reply", kicker: "You're invited", forName: (n) => `For ${n}`, tap: "Tap the envelope to open", openIt: "Open your invitation",
    play: "Play music", pause: "Pause music",
  },
  ms: {
    join: "Sudikah anda hadir?", replyBy: (d) => `Sila balas sebelum ${d}.`, yes: "Dengan gembira, saya hadir", no: "Maaf, tidak dapat hadir",
    howMany: "Berapa orang yang akan hadir?", upTo: (n) => `(sehingga ${n})`, reserved: (n) => `(${n} tempat dikhaskan untuk anda)`,
    diet: "Keperluan pemakanan", dietPh: "cth. vegetarian, tiada makanan laut", note: () => "Pesanan untuk tuan rumah (pilihan)",
    send: "Hantar jawapan", sending: "Menghantar…", name: "Nama anda", phone: "Nombor WhatsApp anda",
    numberNote: () => "Nombor anda hanya dikongsi dengan tuan rumah. Balas sekali bagi setiap keluarga.",
    seeYou: "Jumpa di sana!", thanksNo: "Terima kasih kerana memaklumkan", saved: (n) => `Kami telah menyimpan ${n} tempat untuk anda.`, missed: "Kehadiran anda akan dirindui.",
    change: "Tukar jawapan saya", someoneElse: (n) => `Bukan ${n}? Balas untuk orang lain`,
    errName: "Sila masukkan nama anda.", errPhone: "Sila masukkan nombor WhatsApp anda supaya tuan rumah tahu siapa yang membalas.",
    errSend: "Jawapan anda tidak dapat dihantar. Sila semak sambungan dan cuba lagi.",
    sent: "Jawapan dihantar. Terima kasih!", updated: "Anda sudah membalas, jadi jawapan anda telah dikemas kini.",
    date: "Tarikh", time: "Masa", venue: "Tempat", dress: "Pakaian", maps: "Buka di Peta", cal: "Tambah ke Google Calendar",
    reply: "Balas", kicker: "Anda dijemput", forName: (n) => `Buat ${n}`, tap: "Ketik sampul untuk membuka", openIt: "Buka jemputan anda",
    play: "Main muzik", pause: "Jeda muzik",
  },
  zh: {
    join: "您能出席吗？", replyBy: (d) => `请于${d}前回复。`, yes: "欣然出席", no: "遗憾无法出席",
    howMany: "共有几位出席？", upTo: (n) => `（最多${n}位）`, reserved: (n) => `（已为您保留${n}个座位）`,
    diet: "饮食需求", dietPh: "例如：素食、不吃海鲜", note: () => "给主人家的留言（选填）",
    send: "发送回复", sending: "正在发送…", name: "您的姓名", phone: "您的 WhatsApp 号码",
    numberNote: () => "您的号码只会提供给主人家，方便他们知道是谁回复的。每户请回复一次。",
    seeYou: "到时见！", thanksNo: "感谢您告知我们", saved: (n) => `我们已为您保留${n}个座位。`, missed: "我们会想念您的。",
    change: "更改我的回复", someoneElse: (n) => `不是${n}？为其他人回复`,
    errName: "请输入您的姓名。", errPhone: "请输入您的 WhatsApp 号码，以便主人家知道是谁回复的。",
    errSend: "无法发送您的回复，请检查网络后重试。",
    sent: "回复已发送，谢谢！", updated: "您之前已回复，我们已更新您的回复。",
    date: "日期", time: "时间", venue: "地点", dress: "着装", maps: "在地图中打开", cal: "添加到 Google 日历",
    reply: "回复", kicker: "诚邀您", forName: (n) => `致${n}`, tap: "点击信封打开", openIt: "打开您的请柬",
    play: "播放音乐", pause: "暂停音乐",
  },
  ta: {
    join: "நீங்கள் வருவீர்களா?", replyBy: (d) => `${d}க்குள் பதிலளிக்கவும்.`, yes: "மகிழ்வுடன் வருகிறேன்", no: "வருந்துகிறேன், வர இயலாது",
    howMany: "எத்தனை பேர் வருகிறீர்கள்?", upTo: (n) => `(அதிகபட்சம் ${n})`, reserved: (n) => `(உங்களுக்காக ${n} இருக்கைகள் ஒதுக்கப்பட்டுள்ளன)`,
    diet: "உணவுத் தேவைகள்", dietPh: "எ.கா. சைவம், கடல் உணவு வேண்டாம்", note: () => "விழா நடத்துபவர்களுக்கு ஒரு குறிப்பு (விருப்பம்)",
    send: "பதிலை அனுப்பு", sending: "அனுப்புகிறது…", name: "உங்கள் பெயர்", phone: "உங்கள் WhatsApp எண்",
    numberNote: () => "உங்கள் எண் விழா நடத்துபவர்களுடன் மட்டுமே பகிரப்படும். ஒரு குடும்பத்திற்கு ஒரு முறை பதிலளிக்கவும்.",
    seeYou: "அங்கே சந்திப்போம்!", thanksNo: "தெரிவித்தமைக்கு நன்றி", saved: (n) => `உங்களுக்காக ${n} இருக்கைகளை ஒதுக்கியுள்ளோம்.`, missed: "உங்கள் வருகையை இழக்கிறோம்.",
    change: "என் பதிலை மாற்று", someoneElse: (n) => `${n} இல்லையா? வேறொருவருக்காகப் பதிலளிக்கவும்`,
    errName: "உங்கள் பெயரை உள்ளிடவும்.", errPhone: "யார் பதிலளித்தார்கள் என்று தெரிய, உங்கள் WhatsApp எண்ணை உள்ளிடவும்.",
    errSend: "உங்கள் பதிலை அனுப்ப முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்.",
    sent: "பதில் அனுப்பப்பட்டது. நன்றி!", updated: "நீங்கள் ஏற்கனவே பதிலளித்திருந்தீர்கள், எனவே உங்கள் பதிலைப் புதுப்பித்துள்ளோம்.",
    date: "தேதி", time: "நேரம்", venue: "இடம்", dress: "உடை", maps: "வரைபடத்தில் திற", cal: "Google Calendar-இல் சேர்",
    reply: "பதிலளி", kicker: "உங்களுக்கு அழைப்பு", forName: (n) => `${n} அவர்களுக்கு`, tap: "திறக்க உறையைத் தொடவும்", openIt: "உங்கள் அழைப்பைத் திறக்கவும்",
    play: "இசையை இயக்கு", pause: "இசையை நிறுத்து",
  },
};
/** The guest page's wording for `key` in `lang`, filling in any number or name. */
export function words(lang, key, ...args) {
  const v = W[lang]?.[key] ?? W.en[key];
  return typeof v === "function" ? v(...args) : v;
}
