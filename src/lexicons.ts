// Extra sentiment lexicons: Hindi (Devanagari + romanised) and basic coverage of other Indian languages.
// Words are matched after normalisation (lowercase, NFC, nukta removed), so "बढ़िया" and "बढिया" are the same.

export const POS_X: Record<string, number> = {
  // Hindi, Devanagari
  'अच्छा': 1.2, 'अच्छी': 1.2, 'अच्छे': 1.2, 'बढ़िया': 1.9, 'बढिया': 1.9, 'शानदार': 2.3, 'लाजवाब': 2.3, 'बेहतरीन': 2.3, 'बेहतर': 1.4,
  'स्वादिष्ट': 2.1, 'लज़ीज़': 2.1, 'मज़ेदार': 1.8, 'मजेदार': 1.8, 'मस्त': 1.8, 'ज़बरदस्त': 2.3, 'जबरदस्त': 2.3, 'कमाल': 2.1,
  'बेस्ट': 2.4, 'ताज़ा': 1.4, 'ताजा': 1.4, 'गरमागरम': 1.2, 'गरम': 0.6, 'साफ़': 1.5, 'साफ': 1.5, 'सस्ता': 1.2, 'सस्ती': 1.2, 'किफ़ायती': 1.5,
  'तेज़': 1.3, 'तेज': 1.3, 'जल्दी': 1.3, 'फटाफट': 1.5, 'खुश': 1.6, 'संतुष्ट': 1.5, 'पसंद': 1.5, 'प्यार': 1.8, 'सही': 1.2,
  'मिलनसार': 1.5, 'विनम्र': 1.5, 'मददगार': 1.6, 'बढ़ियाँ': 1.9, 'उम्दा': 2, 'शुक्रिया': 1.2, 'धन्यवाद': 1.2, 'पैसा वसूल': 2,
  // Hindi, romanised (common spellings)
  swadisht: 2.1, lazeez: 2, lajeez: 2, mazedar: 1.8, maza: 1.4, mazaa: 1.4, mast: 1.8, kamaal: 2.1, kamal: 1.8, badhiya: 1.9, badiya: 1.9, bdhiya: 1.9,
  achha: 1.2, achchha: 1.2, achcha: 1.2, acchha: 1.2, accha: 1.2, acha: 1.2, achhi: 1.2, achi: 1.2, acchi: 1.2, zabardast: 2.3, jabardast: 2.3,
  shandar: 2.2, shaandaar: 2.2, lajawab: 2.3, behtareen: 2.3, behtar: 1.4, umda: 2, tazaa: 1.4, taaza: 1.4, taza: 1.4, garam: 0.6, garamgaram: 1.2,
  saaf: 1.5, saf: 1.5, sasta: 1.2, sasti: 1.2, tez: 1.3, jaldi: 1.3, fatafat: 1.5, khush: 1.6, pasand: 1.5, pyaar: 1.8, mast_hai: 1.8,
  milansaar: 1.5, madadgar: 1.6, paisavasool: 2, shukriya: 1.2, dhanyavaad: 1.2, ekdum_mast: 2.2, first_class: 2, jhakkas: 2.1, tagda: 1.6,
  // Marathi
  'छान': 1.6, 'उत्तम': 2, 'चविष्ट': 2, 'मस्तच': 1.9, chhan: 1.6, chan: 1.4, uttam: 2, chavishta: 2, bhari: 1.8, bhannat: 2.1,
  // Bengali
  'ভালো': 1.4, 'ভাল': 1.4, 'দারুণ': 2.1, 'চমৎকার': 2.2, 'সুস্বাদু': 2.1, 'দুর্দান্ত': 2.2, 'পরিষ্কার': 1.5, 'সস্তা': 1.2, 'দ্রুত': 1.3,
  bhalo: 1.4, bhalo_laglo: 1.6, darun: 2.1, shundor: 1.8, sundor: 1.8, mojar: 1.7, khub_bhalo: 2.1,
  // Tamil
  'நல்லா': 1.4, 'நல்ல': 1.2, 'நன்று': 1.4, 'அருமை': 2.1, 'சூப்பர்': 2.1, 'சுவை': 1.0, 'சுவையான': 1.8, 'சுத்தம்': 1.4, 'வேகம்': 1.3, 'மலிவு': 1.2, 'சிறப்பு': 1.8,
  nalla: 1.4, nallaa: 1.4, nalladhu: 1.4, arumai: 2.1, super: 1.8, semma: 2.1, sema: 2.1, supera: 1.9, rusi: 1.2, ruchi: 1.2,
  // Telugu
  'బాగుంది': 1.5, 'బాగా': 1.2, 'సూపర్': 2.1, 'అద్భుతం': 2.3, 'రుచి': 1.0, 'రుచికరం': 1.9, 'శుభ్రం': 1.4, 'తక్కువ': 0.5,
  bagundi: 1.5, bagunnadi: 1.5, adbhutam: 2.3, ruchikaram: 1.9, chala_bagundi: 2.1,
  // Kannada
  'ಚೆನ್ನಾಗಿದೆ': 1.5, 'ಚೆನ್ನಾಗಿ': 1.2, 'ಸೂಪರ್': 2.1, 'ಅದ್ಭುತ': 2.3, 'ರುಚಿ': 1.0, 'ರುಚಿಕರ': 1.9, 'ಸ್ವಚ್ಛ': 1.4,
  chennagide: 1.5, chennagi: 1.2, adbhuta: 2.3, ruchikara: 1.9,
  // Gujarati / Punjabi / Malayalam
  'સરસ': 1.6, 'સારું': 1.2, 'સ્વાદિષ્ટ': 2, 'ઉત્તમ': 2, saras: 1.6, sarus: 1.4,
  'ਵਧੀਆ': 1.9, 'ਸੁਆਦ': 1.2, 'ਸ਼ਾਨਦਾਰ': 2.2, wadhiya: 1.9, vadhiya: 1.9, swaad: 1.2, balle: 1.8,
  'നല്ലത്': 1.4, 'കൊള്ളാം': 1.6, 'അടിപൊളി': 2.1, 'രുചി': 1.0, nallath: 1.4, kollam: 1.6, adipoli: 2.1,
}

export const NEG_X: Record<string, number> = {
  // Hindi, Devanagari
  'बेकार': -2.1, 'खराब': -1.9, 'ख़राब': -1.9, 'गंदा': -2.1, 'गंदी': -2.1, 'गंदे': -2.1, 'घटिया': -2.3, 'बकवास': -2.3, 'फालतू': -1.8, 'वाहियात': -2.4,
  'बदतर': -2.2, 'बुरा': -1.8, 'बुरी': -1.8, 'भयानक': -2.2, 'खौफनाक': -2.2, 'महंगा': -1.5, 'महँगा': -1.5, 'मेहंगा': -1.5, 'महंगी': -1.5, 'लूट': -2,
  'धीमा': -1.5, 'धीमी': -1.5, 'देर': -1.4, 'लेट': -1.4, 'इंतज़ार': -0.8, 'इंतजार': -0.8, 'ठंडा': -1.3, 'ठंडी': -1.3, 'बासी': -2.1, 'कच्चा': -1.4,
  'जला': -1.8, 'जली': -1.8, 'नमकीन': -0.8, 'फीका': -1.6, 'फीकी': -1.6, 'बेस्वाद': -2, 'बदबू': -2, 'बदबूदार': -2, 'कीड़ा': -2.4, 'मक्खी': -1.4, 'बाल': -0.6,
  'बदतमीज़': -2.1, 'बदतमीज': -2.1, 'बेरुखी': -1.7, 'धोखा': -2.2, 'निराश': -1.8, 'निराशाजनक': -1.9, 'परेशान': -1.6, 'परेशानी': -1.3, 'शिकायत': -1.4,
  'कम': -0.5, 'छोटा': -0.7, 'खत्म': -1.2, 'ख़त्म': -1.2, 'नाराज़': -1.6, 'नाराज': -1.6, 'गलत': -1.6, 'ग़लत': -1.6, 'मुश्किल': -1,
  // Hindi, romanised
  bekar: -2.1, bekaar: -2.1, kharab: -1.9, kharaab: -1.9, ganda: -2.1, gandi: -2.1, gande: -2.1, ghatiya: -2.3, bakwas: -2.3, bakwaas: -2.3, faltu: -1.8,
  wahiyat: -2.4, vahiyat: -2.4, bura: -1.8, buri: -1.8, bhayanak: -2.2, mehenga: -1.5, mehnga: -1.5, mahanga: -1.5, mahenga: -1.5, mehengi: -1.5, loot: -2, lootera: -2.1,
  dheema: -1.5, dheemi: -1.5, dhima: -1.5, dheere: -1.1, dhire: -1.1, der: -1.4, deri: -1.4, late: -1.4, intezaar: -0.8, intzaar: -0.8, thanda: -1.3, thandi: -1.3,
  baasi: -2.1, basi: -2.1, kaccha: -1.4, kachcha: -1.4, jala: -1.8, jali: -1.8, feeka: -1.6, pheeka: -1.6, besvaad: -2, badbu: -2, badboo: -2, keeda: -2.4, makkhi: -1.4,
  badtameez: -2.1, badtamiz: -2.1, dhokha: -2.2, dhoka: -2.2, nirash: -1.8, pareshan: -1.6, pareshani: -1.3, shikayat: -1.4, kam: -0.5, chhota: -0.7, chota: -0.7,
  khatam: -1.2, naraz: -1.6, galat: -1.6, mushkil: -1, ghatia: -2.3, gandagi: -2.1, sadda: -1.6,
  // Marathi
  'वाईट': -1.8, 'खराब्': -1.9, 'महाग': -1.5, 'घाणेरडा': -2.2, 'बेचव': -2, vait: -1.8, mahag: -1.5, ghanerda: -2.2, bechav: -2,
  // Bengali
  'খারাপ': -1.8, 'বাজে': -2, 'নোংরা': -2.1, 'দামি': -1.2, 'ধীর': -1.5, 'ঠান্ডা': -1.2, 'বাসি': -2, kharap: -1.8, baje: -2, nongra: -2.1, dami: -1.2, thanda_bengali: -1.2,
  // Tamil
  'மோசம்': -2, 'கெட்ட': -1.8, 'மட்டம்': -1.8, 'விலை': -0.3, 'தாமதம்': -1.4, 'அழுக்கு': -2, 'குளிர்': -0.8, mosam: -2, mattam: -1.8, kevalam: -2.2, thaamadham: -1.4, azhukku: -2,
  // Telugu
  'చెత్త': -2.2, 'దారుణం': -2.3, 'ఖరీదు': -1.2, 'ఆలస్యం': -1.4, 'మురికి': -2, chetta: -2.2, daarunam: -2.3, alasyam: -1.4,
  // Kannada
  'ಕೆಟ್ಟ': -1.8, 'ಕೆಟ್ಟದು': -1.9, 'ದುಬಾರಿ': -1.5, 'ತಡ': -1.3, 'ಕೊಳಕು': -2, ketta: -1.8, dubari: -1.5, kolaku: -2,
  // Gujarati / Punjabi / Malayalam
  'ખરાબ': -1.8, 'મોંઘું': -1.5, 'ગંદુ': -2.1, kharab_gu: -1.8, monghu: -1.5,
  'ਮਾੜਾ': -1.8, 'ਮਹਿੰਗਾ': -1.5, 'ਗੰਦਾ': -2.1, maada: -1.8, mada: -1.8,
  'മോശം': -2, 'വില': -0.3, 'വൃത്തികേട്': -2.1, 'വൈകി': -1.3, 'ചെലവേറിയ': -1.4, mosham: -2, vaiki: -1.3,
}

export const BOOST_X: Record<string, number> = {
  'बहुत': 1.4, 'बोहोत': 1.4, 'बड़ा': 1.1, 'काफी': 1.2, 'काफ़ी': 1.2, 'एकदम': 1.4, 'बिलकुल': 1.4, 'बिल्कुल': 1.4, 'थोड़ा': 0.6, 'थोड़ी': 0.6, 'ज़रा': 0.7, 'ज्यादा': 1.3, 'ज़्यादा': 1.3, 'सबसे': 1.5, 'बेहद': 1.6,
  bohot: 1.4, bhot: 1.4, bahot: 1.4, kaafi: 1.2, kafi: 1.2, bilkul: 1.4, thodi: 0.6, zara: 0.7, jyada: 1.3, zyada: 1.3, sabse: 1.5, behad: 1.6, bhaut: 1.4, bahut_zyada: 1.6,
  'खूब': 1.3, khoob: 1.3, 'ரொம்ப': 1.4, romba: 1.4, 'చాలా': 1.4, chala: 1.4, 'ತುಂಬಾ': 1.4, tumba: 1.4, 'খুব': 1.4, khub: 1.4, 'ખૂબ': 1.4, khub_gu: 1.4, 'ਬਹੁਤ': 1.4,
}

// Negators that come BEFORE the word (English-style) in addition to the base list.
export const NEGATORS_X = ['नहीं', 'नही', 'मत', 'बिना', 'कभी नहीं', 'nahin', 'nai', 'nhi', 'nahii', 'bina', 'ছাড়া', 'இல்லை', 'illai', 'లేదు', 'ledu', 'ಇಲ್ಲ', 'illa', 'नाही', 'nahi', 'નથી', 'ਨਹੀਂ', 'അല്ല', 'alla']

// Negators that come AFTER the word in SOV languages: "achha nahi tha" = "was not good".
export const POST_NEG = new Set(['नहीं', 'नही', 'नाही', 'नहि', 'nahi', 'nahin', 'nhi', 'nahii', 'nai', 'না', 'নয়', 'illai', 'இல்லை', 'ledu', 'లేదు', 'illa', 'ಇಲ್ಲ', 'નથી', 'ਨਹੀਂ', 'alla', 'അല്ല', 'mat', 'मत'])

export const CONTRAST_X = ['लेकिन', 'मगर', 'पर', 'परंतु', 'किंतु', 'पन', 'पण', 'परन्तु', 'लेकीन', 'lekin', 'magar', 'parantu', 'kintu', 'par', 'pan', 'কিন্তু', 'kintu_bn', 'ஆனால்', 'aanal', 'anal', 'కానీ', 'kani', 'ಆದರೆ', 'aadare', 'પણ', 'ਪਰ', 'പക്ഷേ', 'pakshe']

export const ASPECT_X: Record<string, string[]> = {
  Taste: ['स्वाद', 'खाना', 'चाय', 'कॉफ़ी', 'कॉफी', 'मैगी', 'समोसा', 'नाश्ता', 'स्वादिष्ट', 'ज़ायका', 'जायका', 'swad', 'swaad', 'khana', 'khaana', 'chai', 'nashta', 'zayka', 'jayka', 'ruchi', 'rusi', 'சுவை', 'ருசி', 'రుచి', 'ರುಚಿ', 'স্বাদ', 'ખાવાનું', 'ਸੁਆਦ', 'ചായ'],
  'Wait time': ['देर', 'इंतज़ार', 'इंतजार', 'जल्दी', 'तेज़', 'तेज', 'धीमा', 'धीमी', 'समय', 'मिनट', 'लाइन', 'der', 'intezaar', 'intzaar', 'jaldi', 'tez', 'dheema', 'dheere', 'samay', 'time', 'minute', 'min', 'நேரம்', 'தாமதம்', 'సమయం', 'ఆలస్యం', 'ಸಮಯ', 'ತಡ', 'দেরি', 'সময়'],
  Price: ['दाम', 'कीमत', 'क़ीमत', 'महंगा', 'महंगी', 'सस्ता', 'सस्ती', 'पैसा', 'पैसे', 'रेट', 'लूट', 'daam', 'dam', 'keemat', 'kimat', 'paisa', 'paise', 'rate', 'mehenga', 'mehnga', 'sasta', 'loot', 'விலை', 'ధర', 'ಬೆಲೆ', 'দাম', 'કિંમત', 'ਕੀਮਤ'],
  Hygiene: ['साफ़', 'साफ', 'सफाई', 'सफ़ाई', 'गंदा', 'गंदी', 'बदबू', 'कीड़ा', 'मक्खी', 'बाल', 'saaf', 'saf', 'safai', 'ganda', 'gandi', 'gandagi', 'badbu', 'keeda', 'makkhi', 'சுத்தம்', 'அழுக்கு', 'శుభ్రం', 'ಸ್ವಚ್ಛ', 'পরিষ্কার', 'নোংরা'],
  Staff: ['भैया', 'भइया', 'अंकल', 'आंटी', 'स्टाफ', 'सर्विस', 'सेवा', 'व्यवहार', 'बर्ताव', 'मालिक', 'bhaiya', 'bhaiyya', 'uncle', 'aunty', 'staff', 'service', 'vyavhar', 'vyavahar', 'bartav', 'malik', 'maalik', 'behaviour', 'சேவை', 'సేవ', 'ಸೇವೆ', 'সার্ভিস'],
  Stock: ['स्टॉक', 'उपलब्ध', 'खत्म', 'ख़त्म', 'सामान', 'विकल्प', 'stock', 'available', 'khatam', 'khtm', 'saman', 'samaan', 'option', 'varieties'],
}

