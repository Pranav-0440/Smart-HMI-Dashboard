/**
 * Voice Assistant Service & Multilingual Command Parser
 * Supports English, Hindi (हिन्दी), and Marathi (मराठी).
 * Handles Speech Recognition (STT), Speech Synthesis (TTS),
 * and natural language command parsing for the EV-HMI dashboard.
 */
import type { VehicleState, DriveMode } from "../types/vehicle";

export type AssistantLanguage = "en" | "hi" | "mr";

export interface VoiceAssistantActions {
  onToggleControl: (control: string) => void;
  onSetMode: (mode: DriveMode) => void;
  onSetThrottle: (val: number) => void;
  onSetBrake: (val: number) => void;
  onSetSlope: (val: number) => void;
  onReset: () => void;
  onMuteWarnings?: (durationMs?: number) => void;
}

export interface VoiceCommandResult {
  matched: boolean;
  skipped?: boolean;
  actionName?: string;
  response: string;
}

export interface LanguageMeta {
  code: AssistantLanguage;
  name: string;
  nativeName: string;
  flag: string;
  recognitionLang: string;
  greeting: string;
  suggestions: string[];
}

export const LANGUAGE_CONFIG: Record<AssistantLanguage, LanguageMeta> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇬🇧",
    recognitionLang: "en-IN",
    greeting: "Hello! I am SIA, your EV copilot.",
    suggestions: [
      "SIA turn on left indicator",
      "SIA switch to Sport mode",
      "SIA turn on headlights",
      "SIA turn on hazard lights",
      "SIA what is my speed?",
      "SIA what is my battery?",
      "SIA check warnings",
      "SIA accelerate",
      "SIA slow down",
    ],
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    flag: "🇮🇳",
    recognitionLang: "hi-IN",
    greeting: "नमस्ते! मैं सिया, आपकी ईवी कोपायलट हूँ।",
    suggestions: [
      "सिया बायाँ इंडिकेटर चालू करो",
      "सिया हेडलाइट ऑन करो",
      "सिया स्पोर्ट मोड लगाओ",
      "सिया हैज़र्ड लाइट चालू करो",
      "सिया मेरी स्पीड क्या है?",
      "सिया बैटरी कितनी है?",
      "सिया अलर्ट चेक करो",
      "सिया स्पीड बढ़ाओ",
      "सिया ब्रेक लगाओ",
    ],
  },
  mr: {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    flag: "🇮🇳",
    recognitionLang: "mr-IN",
    greeting: "नमस्कार! मी सिया, तुमची ईव्ही कोपायलट आहे.",
    suggestions: [
      "सिया डावा इंडिकेटर चालू करा",
      "सिया हेडलाइट चालू करा",
      "सिया स्पोर्ट मोड सुरू करा",
      "सिया धोकादायक दिवे चालू करा",
      "सिया गाडीचा स्पीड किती आहे?",
      "सिया बॅटरी किती आहे?",
      "सिया वॉर्निंग तपासा",
      "सिया स्पीड वाढवा",
      "सिया गाडी हळू करा",
    ],
  },
};

// Wake word regex matching English, Hinglish, Marathlinglish & Devanagari wake phrases
const WAKE_WORD_REGEX =
  /^\s*(?:(?:hey|hi|ok|okay|hello|hlo|arey|arre|oye|sun|suno|yo|namaste|namaskar|अरे|सुनो|ऐक|ऐका|सांग|बोल|नमस्ते|नमस्कार)\s+)?(?:sia\b|siya\b|shia\b|shiya\b|shea\b|sheya\b|sheeya\b|shiah\b|shya\b|cr\b|c\.r\.?|c\s+r\b|see\s+r\b|see\s+are\b|siah\b|siyah\b|siyaa\b|s\.i\.a\.?|s\s+i\s+a\b|seeya\b|see\s+ya\b|ceia\b|cya\b|सिया|शिया|सीया|शीया|सिआ|सीआ|श्या|सियाजी|सीआर|सी\s*आर|एस\s*आय\s*ए)[,:\s]*/i;

// Pre-fetch voices when speech synthesis is available in the browser
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      try {
        window.speechSynthesis.getVoices();
      } catch {}
    };
  } catch {}
}

/**
 * Checks if the browser has an actual Devanagari (Hindi/Marathi) voice installed.
 */
export function hasNativeDevanagariVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  return (
    voices.find((v) => {
      const l = (v.lang || "").toLowerCase();
      const n = v.name.toLowerCase();
      return (
        l.startsWith("hi") ||
        l.startsWith("mr") ||
        n.includes("hindi") ||
        n.includes("marathi") ||
        n.includes("swara") ||
        n.includes("lekha") ||
        n.includes("ananya") ||
        n.includes("kalpana")
      );
    }) || null
  );
}

/**
 * Phonetic transliteration dictionary for Hindi and Marathi phrases when falling back to English TTS voices.
 * Ensures 100% audible, natural-sounding audio even when OS has no Hindi/Marathi voice pack installed.
 */
export function toPhoneticSpeech(text: string, lang: AssistantLanguage): string {
  if (lang === "en") return text;

  // Exact known phrase dictionary for flawless natural pronunciation:
  const PHRASE_MAP: Record<string, string> = {
    // Greetings & Test phrases
    "नमस्ते! मैं सिया, आपकी ईवी कोपायलट हूँ।": "Namaste! Main SIA, aapki EV copilot hoon.",
    "नमस्ते! मैं सिया हूँ। आपकी ईवी प्रणाली पूरी तरह तैयार है।": "Namaste! Main SIA hoon. Aapki EV pranali poori tarah taiyaar hai.",
    "नमस्कार! मी सिया, तुमची ईव्ही कोपायलट आहे.": "Namaskar! Me SIA, tumchi EV copilot ahe.",
    "नमस्कार! मी सिया आहे. तुमची ईव्ही प्रणाली पूर्णपणे तयार आहे.": "Namaskar! Me SIA ahe. Tumchi EV pranali poornapane taiyaar ahe.",
    "हाँ? मैं सिया, सुन रही हूँ। बताइए क्या करना है?": "Haan? Main SIA, sun rahi hoon. Bataiye kya karna hai?",
    "हो, मी सिया, ऐकते आहे. सांगा काय करायचे आहे?": "Ho, me SIA, aikate ahe. Saanga kay karayche ahe?",

    // Controls - Indicators
    "बायाँ इंडिकेटर चालू कर दिया गया है।": "Bayan indicator chalu kar diya gaya hai.",
    "बायाँ इंडिकेटर बंद कर दिया गया है।": "Bayan indicator band kar diya gaya hai.",
    "डावा इंडिकेटर सुरू केला आहे.": "Dava indicator suru kela ahe.",
    "डावा इंडिकेटर बंद केला आहे.": "Dava indicator band kela ahe.",
    "दायाँ इंडिकेटर चालू कर दिया गया है।": "Dayan indicator chalu kar diya gaya hai.",
    "दायाँ इंडिकेटर बंद कर दिया गया है।": "Dayan indicator band kar diya gaya hai.",
    "उजवा इंडिकेटर सुरू केला आहे.": "Ujva indicator suru kela ahe.",
    "उजवा इंडिकेटर बंद केला आहे.": "Ujva indicator band kela ahe.",

    // Headlights & Hazard
    "हेडलाइट चालू कर दी गई है।": "Headlights chalu kar di gayi hai.",
    "हेडलाइट बंद कर दी गई है।": "Headlights band kar di gayi hai.",
    "हेडलाइट सुरू केली आहे.": "Headlights suru keli ahe.",
    "हेडलाइट बंद केली आहे.": "Headlights band keli ahe.",
    "हैज़र्ड इमरजेंसी लाइट चालू की गई।": "Hazard emergency lights chalu ki gayi.",
    "हैज़र्ड लाइट बंद की गई।": "Hazard lights band ki gayi.",
    "धोकादायक दिवे सुरू केले आहेत.": "Hazard dive suru kele ahet.",
    "धोकादायक दिवे बंद केले आहेत.": "Hazard dive band kele ahet.",

    // Drive Modes
    "स्पोर्ट मोड चालू किया गया। अधिकतम पावर सक्रिय।": "Sport mode chalu kiya gaya. Maximum power active.",
    "स्पोर्ट मोड सुरू केला. कमाल पॉवर सक्रिय.": "Sport mode suru kela. Maximum power active.",
    "इको मोड चालू किया गया। अधिकतम माइलेज रेंज।": "Eco mode chalu kiya gaya. Maximum mileage range.",
    "इको मोड सुरू केला. उत्तम कार्यक्षमता.": "Eco mode suru kela. Maximum efficiency.",
    "नॉर्मल ड्राइव मोड पर स्विच किया गया।": "Normal drive mode par switch kiya gaya.",
    "नॉर्मल ड्राइव मोड सेट केला आहे.": "Normal drive mode set kela ahe.",

    // Cabin & Controls
    "क्लाइमेट कंट्रोल टॉगल किया गया।": "Climate control toggle kiya gaya.",
    "क्लायमेट कंट्रोल टॉगल केले आहे.": "Climate control toggle kele ahe.",
    "दरवाजे का लॉक टॉगल किया गया।": "Door lock toggle kiya gaya.",
    "गाडीचे दरवाजे लॉक टॉगल केले आहेत.": "Gadi-che darwaje lock toggle kele ahet.",
    "पार्किंग ब्रेक टॉगल किया गया।": "Parking brake toggle kiya gaya.",
    "पार्किंग ब्रेक टॉगल केला आहे.": "Parking brake toggle kela ahe.",
    "सीटबेल्ट की स्थिति अपडेट की गई।": "Seatbelt status update ki gayi.",
    "सीटबेल्ट स्थिती अपडेट केली आहे.": "Seatbelt status update keli ahe.",
    "साइड स्टैंड टॉगल किया गया।": "Side stand toggle kiya gaya.",
    "साइड स्टँड टॉगल केला आहे.": "Side stand toggle kela ahe.",
    "हेलमेट सेंसर स्थिति अपडेट की गई।": "Helmet sensor status update ki gayi.",
    "हेल्मेट सेन्सर स्थिती टॉगल केली आहे.": "Helmet sensor status toggle keli ahe.",
    "बीप बीप! हॉर्न बजाया गया।": "Beep beep! Horn bajaya gaya.",
    "हॉर्न वाजवला आहे.": "Beep beep! Horn vajavla ahe.",
    "सिमुलेशन रीसेट कर दिया गया है।": "Simulation reset kar diya gaya hai.",
    "सिम्युलेशन रीसेट केले आहे.": "Simulation reset kele ahe.",

    // Throttle & Brake
    "रिजनरेटिव ब्रेक लगाया जा रहा है।": "Regenerative brake lagaya ja raha hai.",
    "ब्रेक लावला आहे.": "Brake lavla ahe.",

    // Warnings status
    "सभी वाहन प्रणालियाँ सामान्य रूप से काम कर रही हैं। कोई चेतावनी नहीं है।":
      "Sabhi vahan pranaliyan samanya roop se kaam kar rahi hain. Koi warning nahi hai.",
    "सर्व यंत्रणा सुरळीत सुरू आहेत. कोणतीही चेतावणी नाही.":
      "Sarva yantrana suralit suru ahet. Kontehi warning nahi.",
    "✅ सभी चेतावनियाँ हट गईं। सिस्टम सामान्य है।": "Sabhi warnings hat gayin. System normal hai.",
    "✅ सर्व चेतावण्या साफ झाल्या. यंत्रणा सुरळीत आहे.": "Sarva warnings saaf jhalya. System normal ahe.",

    // Warnings Spoken
    "सावधान! गाड़ी चलते समय साइड स्टैंड नीचे है। कृपया तुरंत स्टैंड ऊपर करें।":
      "Savdhan! Gadi chalte samay side stand neeche hai. Kripya turant stand oopar karein.",
    "सावधान! गाडी चालू असताना साइड स्टँड खाली आहे. कृपया लगेच स्टँड वर करा.":
      "Savdhan! Gadi chalu astana side stand khali ahe. Kripya lagech stand var kara.",
    "गंभीर चेतावनी! बैटरी बहुत कम है। कृपया तुरंत चार्ज करें।":
      "Gambhir chetavni! Battery bahut kam hai. Kripya turant charge karein.",
    "गंभीर चेतावणी! बॅटरी खूप कमी आहे. कृपया लगेच चार्ज करा.":
      "Gambhir chetavni! Battery khoop kami ahe. Kripya lagech charge kara.",
    "ध्यान दें: बैटरी का स्तर कम हो रहा है। कृपया चार्जिंग की योजना बनाएं।":
      "Dhyan dein: Battery ka level kam ho raha hai. Kripya charging ki yojana banayein.",
    "सूचना: बॅटरी लेव्हल कमी होत आहे. कृपया लवकरच चार्ज करा.":
      "Soochna: Battery level kami hot ahe. Kripya lavkarch charge kara.",
    "खतरा! बैटरी अधिक गर्म हो रही है। कृपया गाड़ी रोकें।":
      "Khatra! Battery adhik garam ho rahi hai. Kripya gadi rokein.",
    "धोका! बॅटरी जास्त गरम होत आहे. कृपया गाडी थांबवा.":
      "Dhoka! Battery jaast garam hot ahe. Kripya gadi thambva.",
    "खतरा! मोटर का तापमान बहुत अधिक है। कृपया गति कम करें।":
      "Khatra! Motor ka taapmaan bahut adhik hai. Kripya speed kam karein.",
    "धोका! मोटारचे तापमान खूप जास्त आहे. कृपया वेग कमी करा.":
      "Dhoka! Motor-che taapmaan khoop jaast ahe. Kripya speed kami kara.",
    "चेतावनी! गति सीमा पार हो गई है। कृपया गति कम करें।":
      "Chetavni! Speed limit paar ho gayi hai. Kripya speed kam karein.",
    "चेतावणी! वेग मर्यादा ओलांडली आहे. कृपया वेग कमी करा.":
      "Chetaavni! Speed limit olandli ahe. Kripya speed kami kara.",
    "सुरक्षा चेतावनी! सीट बेल्ट नहीं लगी है। कृपया सीट बेल्ट बाँधें।":
      "Suraksha chetavni! Seat belt nahi lagi hai. Kripya seat belt bandhein.",
    "सुरक्षा चेतावणी! सीट बेल्ट लावलेला नाही. कृपया सीट बेल्ट लावा.":
      "Suraksha chetaavni! Seat belt lavlela nahi. Kripya seat belt laava.",
    "सूचना: वाहन के दरवाजे अनलॉक हैं।": "Soochna: Vahan ke darwaje unlock hain.",
    "सूचना: गाडीचे दरवाजे अनलॉक आहेत.": "Soochna: Gadi-che darwaje unlock ahet.",
    "सुरक्षा चेतावनी! हेलमेट नहीं पाया गया। कृपया हेलमेट पहनें।":
      "Suraksha chetavni! Helmet nahi paya gaya. Kripya helmet pehnein.",
    "सुरक्षा चेतावणी! हेल्मेट आढळले नाही. कृपया हेल्मेट घाला.":
      "Suraksha chetaavni! Helmet aadhalle nahi. Kripya helmet ghala.",
    "चेतावनी! गाड़ी चलाते समय पार्किंग ब्रेक लगा हुआ है।":
      "Chetavni! Gadi chalate samay parking brake laga hua hai.",
    "चेतावणी! गाडी चालवताना पार्किंग ब्रेक लागलेला आहे.":
      "Chetaavni! Gadi chalavtana parking brake laglela ahe.",
  };

  const cleanText = text.trim();
  if (PHRASE_MAP[cleanText]) {
    return PHRASE_MAP[cleanText];
  }

  // Handle dynamic queries (Speed, Battery, Range, Temp, Throttle)
  const speedMatch = cleanText.match(/वर्तमान स्पीड (\d+) किलोमीटर|गाडीचा वेग सध्या (\d+) किलोमीटर/);
  if (speedMatch) {
    const spd = speedMatch[1] || speedMatch[2];
    return lang === "hi"
      ? `Vartaman speed ${spd} kilometer prati ghanta hai.`
      : `Gadicha veg sadhya ${spd} kilometer prati taas ahe.`;
  }

  const socMatch = cleanText.match(
    /बैटरी (\d+) प्रतिशत.*अनुमानित रेंज (\d+)|बॅटरी चार्ज (\d+) टक्के.*रेंज (\d+)/
  );
  if (socMatch) {
    const soc = socMatch[1] || socMatch[3];
    const rng = socMatch[2] || socMatch[4];
    return lang === "hi"
      ? `Battery ${soc} percent hai aur anumaanit range ${rng} kilometer hai.`
      : `Battery charge ${soc} take ahe aani shillak range ${rng} kilometer ahe.`;
  }

  const rangeMatch = cleanText.match(/रेंज (\d+) किलोमीटर/);
  if (rangeMatch) {
    const rng = rangeMatch[1];
    return lang === "hi"
      ? `Anumaanit driving range ${rng} kilometer hai.`
      : `Andaje urvarit driving range ${rng} kilometer ahe.`;
  }

  const tempMatch = cleanText.match(
    /तापमान (\d+) डिग्री.*बैटरी का तापमान (\d+)|तापमान (\d+) अंश.*बॅटरीचे तापमान (\d+)/
  );
  if (tempMatch) {
    const mt = tempMatch[1] || tempMatch[3];
    const bt = tempMatch[2] || tempMatch[4];
    return lang === "hi"
      ? `Motor ka taapmaan ${mt} degree aur battery ka taapmaan ${bt} degree Celsius hai.`
      : `Motor-che taapmaan ${mt} degree aani battery-che taapmaan ${bt} degree Celsius ahe.`;
  }

  const throttleMatch = cleanText.match(/थ्रॉटल (\d+) प्रतिशत|थ्रॉटल (\d+) टक्के/);
  if (throttleMatch) {
    const thr = throttleMatch[1] || throttleMatch[2];
    return lang === "hi"
      ? `Gadi ki speed badha di gayi hai. Throttle ${thr} percent hai.`
      : `Veg vaadhavla ahe. Throttle ${thr} take set kela.`;
  }

  return cleanText;
}

/**
 * Selects the best voice for the active language:
 * - 'en': Siri-like AI Assistant voice
 * - 'hi': Hindi natural female voice
 * - 'mr': Marathi / Indian female voice with Hindi Devanagari fallback
 */
export function getVoiceForLanguage(lang: AssistantLanguage = "en"): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const isMaleName = (name: string) => {
    const lower = name.toLowerCase();
    return (
      lower.includes("david") ||
      lower.includes("george") ||
      lower.includes("mark") ||
      lower.includes("guy") ||
      lower.includes("male") ||
      lower.includes("prabhat") ||
      lower.includes("rishi") ||
      lower.includes("madhav") ||
      lower.includes("hemant")
    );
  };

  if (lang === "mr") {
    // 1. Dedicated Marathi voice (Microsoft Ananya, Google मराठी, etc.)
    const marathiVoice = voices.find((v) => {
      const lower = v.name.toLowerCase();
      const l = (v.lang || "").toLowerCase();
      return (
        l === "mr-in" ||
        l.startsWith("mr") ||
        lower.includes("marathi") ||
        lower.includes("ananya") ||
        lower.includes("aarohi")
      );
    });
    if (marathiVoice) return marathiVoice;

    // 2. Hindi Natural Female voice (Swara / Google हिन्दी / Lekha / Kalpana / Heera)
    const hindiFemaleVoice = voices.find((v) => {
      const lower = v.name.toLowerCase();
      const l = (v.lang || "").toLowerCase();
      return (
        (l === "hi-in" ||
          l.startsWith("hi") ||
          lower.includes("swara") ||
          lower.includes("hindi") ||
          lower.includes("lekha") ||
          lower.includes("kalpana") ||
          lower.includes("heera")) &&
        !isMaleName(v.name)
      );
    });
    if (hindiFemaleVoice) return hindiFemaleVoice;

    // 3. Any Hindi voice
    const anyHindi = voices.find((v) => (v.lang || "").toLowerCase().startsWith("hi"));
    if (anyHindi) return anyHindi;

    // 4. Indian English female voice (Neerja, etc.)
    const indianVoice = voices.find((v) => (v.lang || "").toLowerCase() === "en-in" && !isMaleName(v.name));
    if (indianVoice) return indianVoice;
  }

  if (lang === "hi") {
    // 1. Hindi female voice (Swara, Google हिन्दी, Lekha, Kalpana, Heera)
    const hindiFemale = voices.find((v) => {
      const lower = v.name.toLowerCase();
      const l = (v.lang || "").toLowerCase();
      return (
        (l === "hi-in" ||
          l.startsWith("hi") ||
          lower.includes("swara") ||
          lower.includes("hindi") ||
          lower.includes("lekha") ||
          lower.includes("kalpana") ||
          lower.includes("heera")) &&
        !isMaleName(v.name)
      );
    });
    if (hindiFemale) return hindiFemale;

    const anyHindi = voices.find((v) => (v.lang || "").toLowerCase().startsWith("hi"));
    if (anyHindi) return anyHindi;

    const indianVoice = voices.find((v) => (v.lang || "").toLowerCase() === "en-in" && !isMaleName(v.name));
    if (indianVoice) return indianVoice;
  }

  // English Siri-style voice
  // 1. Apple Samantha / Siri
  const siriSamantha = voices.find((v) => {
    const lower = v.name.toLowerCase();
    return lower.includes("siri") || lower.includes("samantha");
  });
  if (siriSamantha) return siriSamantha;

  // 2. Microsoft Natural AI Assistant voices (Jenny / Aria)
  const msNatural = voices.find((v) => {
    const lower = v.name.toLowerCase();
    const l = (v.lang || "").toLowerCase();
    return (
      (lower.includes("jenny") || lower.includes("aria") || lower.includes("natural")) &&
      l.startsWith("en") &&
      !isMaleName(v.name)
    );
  });
  if (msNatural) return msNatural;

  // 3. Google US / UK Natural Female English
  const googleNatural = voices.find((v) => {
    const lower = v.name.toLowerCase();
    const l = (v.lang || "").toLowerCase();
    return (
      lower.includes("google") &&
      (l.startsWith("en-us") || l.startsWith("en-gb") || l.startsWith("en")) &&
      !isMaleName(v.name)
    );
  });
  if (googleNatural) return googleNatural;

  // 4. Other Siri-style female voices (Karen, Victoria, Zira, Sonia, Tessa, Moira)
  const otherFemale = voices.find((v) => {
    const lower = v.name.toLowerCase();
    const l = (v.lang || "").toLowerCase();
    return (
      (lower.includes("karen") ||
        lower.includes("victoria") ||
        lower.includes("zira") ||
        lower.includes("sonia") ||
        lower.includes("female") ||
        lower.includes("woman")) &&
      l.startsWith("en") &&
      !isMaleName(v.name)
    );
  });
  if (otherFemale) return otherFemale;

  return voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && !isMaleName(v.name)) || voices[0] || null;
}

// Speak response using browser Text-to-Speech in the appropriate language voice
export function speakResponse(
  text: string,
  enabled: boolean = true,
  onEnd?: () => void,
  onStart?: () => void,
  lang: AssistantLanguage = "en"
): void {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }
  try {
    window.speechSynthesis.cancel(); // cancel previous speech

    const nativeDevanagariVoice = hasNativeDevanagariVoice();
    let textToSpeak = text;
    let voiceToUse: SpeechSynthesisVoice | null = null;
    let langToSet = "en-US";

    if (lang === "en") {
      voiceToUse = getVoiceForLanguage("en");
      langToSet = voiceToUse?.lang || "en-US";
      textToSpeak = text;
    } else {
      // Hindi or Marathi
      if (nativeDevanagariVoice) {
        // Native Devanagari voice exists (e.g. Swara, Google Hindi, Ananya)
        voiceToUse = nativeDevanagariVoice;
        langToSet = nativeDevanagariVoice.lang.startsWith("mr")
          ? nativeDevanagariVoice.lang
          : "hi-IN";
        textToSpeak = text;
      } else {
        // No Hindi/Marathi voice on Windows/Chrome!
        // Fallback to English voice speaking romanized phonetic words with 100% audible clarity
        voiceToUse = getVoiceForLanguage("en");
        langToSet = voiceToUse?.lang || "en-IN";
        textToSpeak = toPhoneticSpeech(text, lang);
      }
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }
    utterance.lang = langToSet;

    // Retain global reference to avoid Chrome GC bug dropping onend
    (window as any).__lastSpeechUtterance = utterance;

    let hasEnded = false;
    const safeEnd = () => {
      if (hasEnded) return;
      hasEnded = true;
      if (onEnd) onEnd();
    };

    if (onStart) utterance.onstart = onStart;
    utterance.onend = safeEnd;
    utterance.onerror = (e) => {
      console.warn("[VoiceAssistant] TTS error:", e);
      safeEnd();
    };

    const maxDuration = Math.max(2000, textToSpeak.length * 75);
    setTimeout(safeEnd, maxDuration);

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("[VoiceAssistant] TTS error:", err);
    if (onEnd) onEnd();
  }
}

/**
 * Parses user spoken phrase and triggers the corresponding vehicle control.
 * Supports English, Hindi (Devanagari + Hinglish), and Marathi (Devanagari + Marathlinglish).
 * Requires mandatory 'SIA' / 'SIYA' / 'CR' wake word at the start for spoken input.
 */
export function processVoiceCommand(
  rawTranscript: string,
  state: VehicleState,
  actions: VoiceAssistantActions,
  isManual: boolean = false,
  lang: AssistantLanguage = "en"
): VoiceCommandResult {
  const trimmed = rawTranscript.trim();
  if (!trimmed) {
    return { matched: false, skipped: true, response: "" };
  }

  let commandText = trimmed;
  const wakeMatch = trimmed.match(WAKE_WORD_REGEX);

  // If spoken via microphone and wake word is missing:
  if (!isManual && !wakeMatch) {
    console.debug("[VoiceAssistant] Skipped input (missing wake word):", trimmed);
    return {
      matched: false,
      skipped: true,
      response: "",
    };
  }

  // Strip the wake word prefix
  if (wakeMatch) {
    commandText = trimmed.slice(wakeMatch[0].length).trim();
  }

  // If user only said the wake word without a command
  if (!commandText) {
    const greetingReplies: Record<AssistantLanguage, string> = {
      en: "Yes? I'm SIA, listening. Tell me what you'd like to do.",
      hi: "हाँ? मैं सिया, सुन रही हूँ। बताइए क्या करना है?",
      mr: "हो, मी सिया, ऐकते आहे. सांगा काय करायचे आहे?",
    };
    return {
      matched: true,
      actionName: "wake_greeting",
      response: greetingReplies[lang] || greetingReplies.en,
    };
  }

  const text = commandText.toLowerCase().trim();

  // Helper for localized response strings
  const getReply = (en: string, hi: string, mr: string) => {
    if (lang === "hi") return hi;
    if (lang === "mr") return mr;
    return en;
  };

  // ── LEFT INDICATOR ──
  const isLeftIndicator =
    text.includes("left") ||
    text.includes("डावा") ||
    text.includes("डावे") ||
    text.includes("बायाँ") ||
    text.includes("बायें") ||
    text.includes("बाएं") ||
    text.includes("dava") ||
    text.includes("bayan") ||
    text.includes("baye");

  if (isLeftIndicator && (text.includes("indicator") || text.includes("इंडिकेटर") || text.includes("signal") || text.includes("लाइट") || text.includes("light") || text.includes("turn") || text.includes("side") || text.includes("चालू") || text.includes("बंद") || text.includes("kara") || text.includes("karo") || text.includes("on") || text.includes("off"))) {
    const isOff =
      text.includes("off") ||
      text.includes("stop") ||
      text.includes("cancel") ||
      text.includes("disable") ||
      text.includes("cut") ||
      text.includes("band") ||
      text.includes("bandh") ||
      text.includes("hatao") ||
      text.includes("बंद") ||
      text.includes("थांबवा");

    if (isOff) {
      if (state.leftIndicator) actions.onToggleControl("leftIndicator");
      return {
        matched: true,
        actionName: "left_indicator_off",
        response: getReply("Left indicator turned off.", "बायाँ इंडिकेटर बंद कर दिया गया है।", "डावा इंडिकेटर बंद केला आहे."),
      };
    } else {
      if (!state.leftIndicator) actions.onToggleControl("leftIndicator");
      return {
        matched: true,
        actionName: "left_indicator_on",
        response: getReply("Left indicator turned on.", "बायाँ इंडिकेटर चालू कर दिया गया है।", "डावा इंडिकेटर सुरू केला आहे."),
      };
    }
  }

  // ── RIGHT INDICATOR ──
  const isRightIndicator =
    text.includes("right") ||
    text.includes("उजवा") ||
    text.includes("उजवे") ||
    text.includes("दायाँ") ||
    text.includes("दायें") ||
    text.includes("दाएं") ||
    text.includes("ujva") ||
    text.includes("dayan") ||
    text.includes("daye");

  if (isRightIndicator && (text.includes("indicator") || text.includes("इंडिकेटर") || text.includes("signal") || text.includes("लाइट") || text.includes("light") || text.includes("turn") || text.includes("side") || text.includes("चालू") || text.includes("बंद") || text.includes("kara") || text.includes("karo") || text.includes("on") || text.includes("off"))) {
    const isOff =
      text.includes("off") ||
      text.includes("stop") ||
      text.includes("cancel") ||
      text.includes("disable") ||
      text.includes("cut") ||
      text.includes("band") ||
      text.includes("bandh") ||
      text.includes("hatao") ||
      text.includes("बंद") ||
      text.includes("थांबवा");

    if (isOff) {
      if (state.rightIndicator) actions.onToggleControl("rightIndicator");
      return {
        matched: true,
        actionName: "right_indicator_off",
        response: getReply("Right indicator turned off.", "दायाँ इंडिकेटर बंद कर दिया गया है।", "उजवा इंडिकेटर बंद केला आहे."),
      };
    } else {
      if (!state.rightIndicator) actions.onToggleControl("rightIndicator");
      return {
        matched: true,
        actionName: "right_indicator_on",
        response: getReply("Right indicator turned on.", "दायाँ इंडिकेटर चालू कर दिया गया है।", "उजवा इंडिकेटर सुरू केला आहे."),
      };
    }
  }

  // ── HAZARD LIGHTS ──
  if (
    text.includes("hazard") ||
    text.includes("हैज़र्ड") ||
    text.includes("धोकादायक") ||
    text.includes("emergency light") ||
    text.includes("flashers") ||
    text.includes("both indicator") ||
    text.includes("four indicator") ||
    text.includes("चारों") ||
    text.includes("चारही") ||
    text.includes("parking light") ||
    text.includes("warning light")
  ) {
    actions.onToggleControl("hazard");
    const nextState = !state.hazard;
    return {
      matched: true,
      actionName: "hazard",
      response: nextState
        ? getReply("Hazard warning flashers activated.", "हैज़र्ड इमरजेंसी लाइट चालू की गई।", "धोकादायक दिवे सुरू केले आहेत.")
        : getReply("Hazard lights deactivated.", "हैज़र्ड लाइट बंद की गई।", "धोकादायक दिवे बंद केले आहेत."),
    };
  }

  // ── HEADLIGHTS / LIGHTS ──
  if (
    text.includes("headlight") ||
    text.includes("head light") ||
    text.includes("head lamp") ||
    text.includes("front light") ||
    text.includes("light") ||
    text.includes("lamp") ||
    text.includes("beam") ||
    text.includes("हेडलाइट") ||
    text.includes("लाइट") ||
    text.includes("दिवे") ||
    text.includes("दिवा") ||
    text.includes("बत्ती") ||
    text.includes("batti")
  ) {
    const isOff =
      text.includes("off") ||
      text.includes("turn off") ||
      text.includes("disable") ||
      text.includes("kill") ||
      text.includes("band") ||
      text.includes("bandh") ||
      text.includes("hatao") ||
      text.includes("बंद") ||
      text.includes("विझवा");

    if (isOff) {
      if (state.headlight) actions.onToggleControl("headlight");
      return {
        matched: true,
        actionName: "headlight_off",
        response: getReply("Headlights turned off.", "हेडलाइट बंद कर दी गई है।", "हेडलाइट बंद केली आहे."),
      };
    } else {
      if (!state.headlight) actions.onToggleControl("headlight");
      return {
        matched: true,
        actionName: "headlight_on",
        response: getReply("Headlights turned on.", "हेडलाइट चालू कर दी गई है।", "हेडलाइट सुरू केली आहे."),
      };
    }
  }

  // ── DRIVE MODES ──
  if (
    text.includes("sport") ||
    text.includes("sports") ||
    text.includes("beast") ||
    text.includes("fast mode") ||
    text.includes("power mode") ||
    text.includes("turbo") ||
    text.includes("tez mode") ||
    text.includes("स्पोर्ट") ||
    text.includes("तेज़ मोड")
  ) {
    actions.onSetMode("SPORT");
    return {
      matched: true,
      actionName: "mode_sport",
      response: getReply("Engaged Sport mode. Maximum power unlocked.", "स्पोर्ट मोड चालू किया गया। अधिकतम पावर सक्रिय।", "स्पोर्ट मोड सुरू केला. कमाल पॉवर सक्रिय."),
    };
  }

  if (
    text.includes("eco") ||
    text.includes("economy") ||
    text.includes("save battery") ||
    text.includes("efficient") ||
    text.includes("range mode") ||
    text.includes("mileage") ||
    text.includes("इको") ||
    text.includes("बचत")
  ) {
    actions.onSetMode("ECO");
    return {
      matched: true,
      actionName: "mode_eco",
      response: getReply("Switched to Eco mode for maximum efficiency.", "इको मोड चालू किया गया। अधिकतम माइलेज रेंज।", "इको मोड सुरू केला. उत्तम कार्यक्षमता."),
    };
  }

  if (
    text.includes("normal") ||
    text.includes("standard") ||
    text.includes("city mode") ||
    text.includes("default mode") ||
    text.includes("drive mode") ||
    text.includes("नॉर्मल") ||
    text.includes("सामान्य")
  ) {
    actions.onSetMode("NORMAL");
    return {
      matched: true,
      actionName: "mode_normal",
      response: getReply("Switched to Normal drive mode.", "नॉर्मल ड्राइव मोड पर स्विच किया गया।", "नॉर्मल ड्राइव मोड सेट केला आहे."),
    };
  }

  // ── CAR CABIN CONTROLS (Climate / Doors / Seatbelt / Park Brake) ──
  if (
    text.includes("climate") ||
    text.includes("ac") ||
    text.includes("air condition") ||
    text.includes("cooling") ||
    text.includes("heater") ||
    text.includes("temperature control") ||
    text.includes("एसी") ||
    text.includes("कूलिंग")
  ) {
    actions.onToggleControl("climate");
    return {
      matched: true,
      actionName: "climate",
      response: getReply("Climate control toggled.", "क्लाइमेट कंट्रोल टॉगल किया गया।", "क्लायमेट कंट्रोल टॉगल केले आहे."),
    };
  }

  if (
    text.includes("door") ||
    text.includes("lock") ||
    text.includes("unlock") ||
    text.includes("darwaza") ||
    text.includes("दरवाजा") ||
    text.includes("दरवाजे") ||
    text.includes("लॉक")
  ) {
    actions.onToggleControl("doorsLocked");
    return {
      matched: true,
      actionName: "doors",
      response: getReply("Vehicle door locks toggled.", "दरवाजे का लॉक टॉगल किया गया।", "गाडीचे दरवाजे लॉक टॉगल केले आहेत."),
    };
  }

  if (
    text.includes("parking brake") ||
    text.includes("handbrake") ||
    text.includes("p brake") ||
    text.includes("park brake") ||
    text.includes("पार्किंग ब्रेक") ||
    text.includes("हँडब्रेक")
  ) {
    actions.onToggleControl("parkingBrake");
    return {
      matched: true,
      actionName: "parking_brake",
      response: getReply("Parking brake toggled.", "पार्किंग ब्रेक टॉगल किया गया।", "पार्किंग ब्रेक टॉगल केला आहे."),
    };
  }

  if (
    text.includes("seatbelt") ||
    text.includes("seat belt") ||
    text.includes("belt") ||
    text.includes("सीटबेल्ट") ||
    text.includes("सीट बेल्ट")
  ) {
    actions.onToggleControl("seatBelt");
    return {
      matched: true,
      actionName: "seatbelt",
      response: getReply("Seatbelt status updated.", "सीटबेल्ट की स्थिति अपडेट की गई।", "सीटबेल्ट स्थिती अपडेट केली आहे."),
    };
  }

  // ── BIKE CONTROLS (Side Stand / Helmet / Horn) ──
  if (
    text.includes("stand") ||
    text.includes("side stand") ||
    text.includes("kickstand") ||
    text.includes("स्टैंड") ||
    text.includes("स्टँड")
  ) {
    actions.onToggleControl("sideStand");
    return {
      matched: true,
      actionName: "side_stand",
      response: getReply("Side stand toggled.", "साइड स्टैंड टॉगल किया गया।", "साइड स्टँड टॉगल केला आहे."),
    };
  }

  // ── RESET ──
  if (
    text.includes("reset") ||
    text.includes("restart") ||
    text.includes("start over") ||
    text.includes("रीसेट") ||
    text.includes("पुन्हा सुरू")
  ) {
    actions.onReset();
    return {
      matched: true,
      actionName: "reset",
      response: getReply("Simulation reset to default initial state.", "सिमुलेशन रीसेट कर दिया गया है।", "सिम्युलेशन रीसेट केले आहे."),
    };
  }

  if (text.includes("helmet") || text.includes("हेल्मेट")) {
    actions.onToggleControl("helmetOn");
    return {
      matched: true,
      actionName: "helmet",
      response: getReply("Helmet sensor status toggled.", "हेलमेट सेंसर स्थिति अपडेट की गई।", "हेल्मेट सेन्सर स्थिती टॉगल केली आहे."),
    };
  }

  if (
    text.includes("horn") ||
    text.includes("honk") ||
    text.includes("beep") ||
    text.includes("bajao") ||
    text.includes("vajva") ||
    text.includes("हॉर्न") ||
    text.includes("बजाओ") ||
    text.includes("वाजवा")
  ) {
    actions.onToggleControl("horn");
    return {
      matched: true,
      actionName: "horn",
      response: getReply("Beep beep! Horn sounded.", "बीप बीप! हॉर्न बजाया गया।", "हॉर्न वाजवला आहे."),
    };
  }

  // ── TELEMETRY QUERIES ──
  if (
    text.includes("speed") ||
    text.includes("how fast") ||
    text.includes("kitna speed") ||
    text.includes("speed kitna") ||
    text.includes("स्पीड") ||
    text.includes("वेग") ||
    text.includes("रफ़्तार") ||
    text.includes("raftar") ||
    text.includes("veg")
  ) {
    const currentSpeed = Math.round(state.speed);
    return {
      matched: true,
      actionName: "query_speed",
      response: getReply(
        `Current speed is ${currentSpeed} kilometers per hour.`,
        `वर्तमान स्पीड ${currentSpeed} किलोमीटर प्रति घंटा है।`,
        `गाडीचा वेग सध्या ${currentSpeed} किलोमीटर प्रति तास आहे.`
      ),
    };
  }

  if (
    text.includes("battery") ||
    text.includes("charge") ||
    text.includes("soc") ||
    text.includes("power left") ||
    text.includes("battery kitna") ||
    text.includes("charge kitna") ||
    text.includes("बैटरी") ||
    text.includes("बॅटरी") ||
    text.includes("चार्ज")
  ) {
    const soc = Math.round(state.batterySoc);
    const range = Math.round(state.range);
    return {
      matched: true,
      actionName: "query_battery",
      response: getReply(
        `Battery state of charge is at ${soc} percent with approximately ${range} kilometers of remaining range.`,
        `बैटरी ${soc} प्रतिशत है और अनुमानित रेंज ${range} किलोमीटर है।`,
        `बॅटरी चार्ज ${soc} टक्के आहे आणि शिल्लक रेंज ${range} किलोमीटर आहे.`
      ),
    };
  }

  if (
    text.includes("range") ||
    text.includes("how far") ||
    text.includes("distance") ||
    text.includes("range kitna") ||
    text.includes("रेंज") ||
    text.includes("अंतर") ||
    text.includes("दूरी")
  ) {
    const range = Math.round(state.range);
    return {
      matched: true,
      actionName: "query_range",
      response: getReply(
        `Estimated remaining driving range is ${range} kilometers.`,
        `अनुमानित ड्राइविंग रेंज ${range} किलोमीटर है।`,
        `अंदाजे उर्वरित ड्रायव्हिंग रेंज ${range} किलोमीटर आहे.`
      ),
    };
  }

  if (
    text.includes("temperature") ||
    text.includes("temp") ||
    text.includes("motor temp") ||
    text.includes("overheating") ||
    text.includes("garam") ||
    text.includes("तापमान") ||
    text.includes("गरम")
  ) {
    const mTemp = Math.round(state.motorTemperature);
    const bTemp = Math.round(state.batteryTemperature);
    return {
      matched: true,
      actionName: "query_temp",
      response: getReply(
        `Motor temperature is ${mTemp} degrees Celsius, and battery temperature is ${bTemp} degrees Celsius.`,
        `मोटर का तापमान ${mTemp} डिग्री और बैटरी का तापमान ${bTemp} डिग्री सेल्सियस है।`,
        `मोटारचे तापमान ${mTemp} अंश आणि बॅटरीचे तापमान ${bTemp} अंश सेल्सिअस आहे.`
      ),
    };
  }

  // ── THROTTLE / ACCELERATION / BRAKE ──
  if (
    text.includes("accelerate") ||
    text.includes("speed up") ||
    text.includes("speed badhao") ||
    text.includes("throttle") ||
    text.includes("go faster") ||
    text.includes("fast") ||
    text.includes("tez karo") ||
    text.includes("tez") ||
    text.includes("race") ||
    text.includes("स्पीड वाढवा") ||
    text.includes("वेग वाढवा") ||
    text.includes("पळवा")
  ) {
    const newThrottle = Math.min(100, Math.round(state.throttle + 25));
    actions.onSetThrottle(newThrottle);
    return {
      matched: true,
      actionName: "accelerate",
      response: getReply(
        `Accelerating. Throttle set to ${newThrottle} percent.`,
        `गाड़ी की स्पीड बढ़ा दी गई है। थ्रॉटल ${newThrottle} प्रतिशत है।`,
        `वेग वाढवला आहे. थ्रॉटल ${newThrottle} टक्के सेट केला.`
      ),
    };
  }

  if (
    text.includes("brake") ||
    text.includes("slow down") ||
    text.includes("speed kam") ||
    text.includes("dheere") ||
    text.includes("stop") ||
    text.includes("rok") ||
    text.includes("decelerate") ||
    text.includes("gaadi roko") ||
    text.includes("ब्रेक") ||
    text.includes("हळू करा") ||
    text.includes("थांबवा") ||
    text.includes("गाडी थांबवा")
  ) {
    actions.onSetThrottle(0);
    actions.onSetBrake(60);
    return {
      matched: true,
      actionName: "brake",
      response: getReply("Applying regenerative braking.", "रिजनरेटिव ब्रेक लगाया जा रहा है।", "ब्रेक लावला आहे."),
    };
  }

  // ── WARNINGS & SAFETY STATUS QUERY ──
  if (
    text.includes("warning") ||
    text.includes("alert") ||
    text.includes("issue") ||
    text.includes("problem") ||
    text.includes("health") ||
    text.includes("safety") ||
    text.includes("error") ||
    text.includes("check vehicle") ||
    text.includes("status check") ||
    text.includes("kya issue") ||
    text.includes("kya alert") ||
    text.includes("अलर्ट") ||
    text.includes("वॉर्निंग") ||
    text.includes("चेतावणी") ||
    text.includes("तपासा") ||
    text.includes("समस्या")
  ) {
    if (state.warnings && state.warnings.length > 0) {
      const spokenList = state.warnings.map((w) => formatWarningForSpeech(w, lang)).join(" ");
      return {
        matched: true,
        actionName: "query_warnings",
        response: getReply(`Active vehicle alerts: ${spokenList}`, `सक्रिय अलर्ट: ${spokenList}`, `सक्रिय अलर्ट: ${spokenList}`),
      };
    } else {
      return {
        matched: true,
        actionName: "query_warnings",
        response: getReply(
          "All vehicle systems are functioning normally. There are no active warnings.",
          "सभी वाहन प्रणालियाँ सामान्य रूप से काम कर रही हैं। कोई चेतावनी नहीं है।",
          "सर्व यंत्रणा सुरळीत सुरू आहेत. कोणतीही चेतावणी नाही."
        ),
      };
    }
  }

  // ── FALLBACK / UNRECOGNIZED ──
  return {
    matched: false,
    response: getReply(
      `I heard "${commandText}", but I didn't recognize that command. Try saying "SIA turn on left indicator", "SIA switch to Sport mode", or "SIA check warnings".`,
      `मैंने सुना "${commandText}", लेकिन समझ नहीं आया। बोलिए "सिया बायाँ इंडिकेटर चालू करो" या "सिया अलर्ट चेक करो"।`,
      `मी ऐकले "${commandText}", परंतु समजले नाही. बोला "सिया डावा इंडिकेटर चालू करा" किंवा "सिया वॉर्निंग तपासा".`
    ),
  };
}

/**
 * Converts a raw vehicle warning message into a natural, spoken audio announcement in EN, HI, or MR.
 */
export function formatWarningForSpeech(rawWarning: string, lang: AssistantLanguage = "en"): string {
  const upper = rawWarning.toUpperCase();

  if (upper.includes("SIDE STAND DOWN")) {
    if (lang === "hi") return "सावधान! गाड़ी चलते समय साइड स्टैंड नीचे है। कृपया तुरंत स्टैंड ऊपर करें।";
    if (lang === "mr") return "सावधान! गाडी चालू असताना साइड स्टँड खाली आहे. कृपया लगेच स्टँड वर करा.";
    return "Warning! Side stand is down while the vehicle is in motion. Please raise the side stand immediately.";
  }
  if (upper.includes("BATTERY CRITICALLY LOW")) {
    if (lang === "hi") return "गंभीर चेतावनी! बैटरी बहुत कम है। कृपया तुरंत चार्ज करें।";
    if (lang === "mr") return "गंभीर चेतावणी! बॅटरी खूप कमी आहे. कृपया लगेच चार्ज करा.";
    return "Critical Alert! Battery is critically low. Please recharge immediately.";
  }
  if (upper.includes("LOW BATTERY")) {
    if (lang === "hi") return "ध्यान दें: बैटरी का स्तर कम हो रहा है। कृपया चार्जिंग की योजना बनाएं।";
    if (lang === "mr") return "सूचना: बॅटरी लेव्हल कमी होत आहे. कृपया लवकरच चार्ज करा.";
    return "Caution: Battery level is running low. Please plan to recharge soon.";
  }
  if (upper.includes("BATTERY OVERHEATING")) {
    if (lang === "hi") return "खतरा! बैटरी अधिक गर्म हो रही है। कृपया गाड़ी रोकें।";
    if (lang === "mr") return "धोका! बॅटरी जास्त गरम होत आहे. कृपया गाडी थांबवा.";
    return "Danger! Battery is overheating. Please stop to allow cooling.";
  }
  if (upper.includes("MOTOR OVERHEATING")) {
    if (lang === "hi") return "खतरा! मोटर का तापमान बहुत अधिक है। कृपया गति कम करें।";
    if (lang === "mr") return "धोका! मोटारचे तापमान खूप जास्त आहे. कृपया वेग कमी करा.";
    return "Danger! Motor temperature is dangerously high. Please reduce speed.";
  }
  if (upper.includes("OVERSPEED")) {
    if (lang === "hi") return "चेतावनी! गति सीमा पार हो गई है। कृपया गति कम करें।";
    if (lang === "mr") return "चेतावणी! वेग मर्यादा ओलांडली आहे. कृपया वेग कमी करा.";
    return "Warning! Speed limit exceeded. Please reduce your speed.";
  }
  if (upper.includes("SEAT BELT")) {
    if (lang === "hi") return "सुरक्षा चेतावनी! सीट बेल्ट नहीं लगी है। कृपया सीट बेल्ट बाँधें।";
    if (lang === "mr") return "सुरक्षा चेतावणी! सीट बेल्ट लावलेला नाही. कृपया सीट बेल्ट लावा.";
    return "Safety Warning! Seat belt is not fastened. Please buckle up.";
  }
  if (upper.includes("DOORS UNLOCKED")) {
    if (lang === "hi") return "सूचना: वाहन के दरवाजे अनलॉक हैं।";
    if (lang === "mr") return "सूचना: गाडीचे दरवाजे अनलॉक आहेत.";
    return "Notice: Vehicle doors are currently unlocked.";
  }
  if (upper.includes("HELMET")) {
    if (lang === "hi") return "सुरक्षा चेतावनी! हेलमेट नहीं पाया गया। कृपया हेलमेट पहनें।";
    if (lang === "mr") return "सुरक्षा चेतावणी! हेल्मेट आढळले नाही. कृपया हेल्मेट घाला.";
    return "Safety Warning! Helmet not detected. Please wear a helmet.";
  }
  if (upper.includes("PARKING BRAKE")) {
    if (lang === "hi") return "चेतावनी! गाड़ी चलाते समय पार्किंग ब्रेक लगा हुआ है।";
    if (lang === "mr") return "चेतावणी! गाडी चालवताना पार्किंग ब्रेक लागलेला आहे.";
    return "Warning! Parking brake is engaged while driving.";
  }

  const clean = rawWarning.replace(/^(CRITICAL:|DANGER:|WARNING:)\s*/i, "");
  if (lang === "hi") return `चेतावनी: ${clean}।`;
  if (lang === "mr") return `चेतावणी: ${clean}.`;
  return `Warning: ${clean}.`;
}
