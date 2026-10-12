/**
 * Kerala's sample geography, moved to another state.
 *
 * The fixtures place every party, police station, bank branch and bench in and around
 * Kollam. A Gujarat demo that files a complaint from "Chinnakada, Kollam" before the
 * "Kollam East" police reads as Kerala however the court is named, so each Kerala place
 * the data uses has a stand-in in each state: real towns, picked so the demo's district
 * (Kollam) becomes the state's own demo district — Ahmedabad, whose filings the scrutiny
 * queue already carries; Ludhiana; and Panchkula, where the Punjab & Haryana sheet's
 * Special NI Act Court sits — and Kollam's own neighbourhoods become that city's.
 *
 * These are sample places for sample people. Nothing here is a jurisdiction rule.
 */

import type { CourtId } from "./profiles";

type Places = Record<string, string>;

const KERALA_PLACES = [
  // The demo district and its city neighbourhoods.
  "Kollam", "Chinnakada", "Kadappakada", "Kilikollur",
  // Towns of Kollam district.
  "Punalur", "Paravur", "Kundara", "Karunagappally", "Chavara", "Kottiyam",
  "Kottarakkara", "Oachira", "Anchal", "Sasthamcotta", "Pathanapuram", "Kunnathur",
  // The rest of the state.
  "Thiruvananthapuram", "Trivandrum", "Ernakulam", "Kochi", "Cochin", "Kodungallur",
  "Thrissur", "Trichur", "Kottayam", "Chalakudy", "Varkala", "Nedumangad", "Attingal",
  "Kozhikode", "Calicut", "Alappuzha", "Alleppey", "Palakkad", "Malappuram", "Kannur",
  "Kasaragod", "Pathanamthitta", "Idukki", "Wayanad", "Kayamkulam", "Aluva",
  "Changanassery", "Thodupuzha", "Muvattupuzha", "Perumbavoor", "Angamaly",
  "Kunnamkulam", "Guruvayur", "Tirur", "Vadakara", "Thalassery", "Payyanur",
  "Neyyattinkara", "Kakkanad", "Edappally", "Kalamassery", "Irinjalakuda", "Thiruvalla",
  "Mavelikkara", "Cherthala",
] as const;

function zip(names: string[]): Places {
  if (names.length !== KERALA_PLACES.length) {
    throw new Error(`Place list has ${names.length} names for ${KERALA_PLACES.length} places`);
  }
  return Object.fromEntries(KERALA_PLACES.map((k, i) => [k, names[i]]));
}

const GUJARAT = zip([
  "Ahmedabad", "Navrangpura", "Maninagar", "Naroda",
  "Anand", "Nadiad", "Mehsana", "Navsari", "Valsad", "Vapi",
  "Bhavnagar", "Jamnagar", "Junagadh", "Palanpur", "Patan", "Godhra",
  "Gandhinagar", "Gandhinagar", "Surat", "Vadodara", "Vadodara", "Bharuch",
  "Rajkot", "Rajkot", "Morbi", "Ankleshwar", "Porbandar", "Amreli", "Dahod",
  "Bhuj", "Bhuj", "Gandhidham", "Botad", "Veraval", "Himmatnagar", "Kalol",
  "Surendranagar", "Gondal", "Jetpur", "Dholka", "Sanand", "Viramgam",
  "Deesa", "Unjha", "Visnagar", "Modasa", "Bardoli", "Vyara",
  "Rajpipla", "Lunawada", "Khambhat", "Petlad", "Borsad", "Dabhoi",
  "Padra", "Halol", "Kapadvanj", "Dhandhuka", "Mandvi",
  "Anjar", "Wankaner",
]);

const PUNJAB = zip([
  "Ludhiana", "Sarabha Nagar", "Model Town", "Ghumar Mandi",
  "Khanna", "Jagraon", "Samrala", "Raikot", "Doraha", "Payal",
  "Phagwara", "Nakodar", "Phillaur", "Banga", "Garhshankar", "Mukerian",
  "Chandigarh", "Chandigarh", "Jalandhar", "Amritsar", "Amritsar", "Kapurthala",
  "Patiala", "Patiala", "Bathinda", "Hoshiarpur", "Mohali", "Rupnagar", "Moga",
  "Firozpur", "Firozpur", "Pathankot", "Sangrur", "Barnala", "Faridkot", "Muktsar",
  "Fazilka", "Abohar", "Malerkotla", "Mansa", "Gurdaspur", "Batala",
  "Tarn Taran", "Nawanshahr", "Fatehgarh Sahib", "Rajpura", "Zirakpur", "Kharar",
  "Samana", "Nabha", "Sunam", "Dhuri", "Dasuya", "Kartarpur",
  "Sultanpur Lodhi", "Ajnala", "Kotkapura", "Malout", "Gidderbaha",
  "Zira", "Budhlada",
]);

const HARYANA = zip([
  "Panchkula", "Sector 5", "Sector 9", "Sector 15",
  "Kalka", "Pinjore", "Barwala", "Raipur Rani", "Naraingarh", "Morni",
  "Ambala", "Yamunanagar", "Jagadhri", "Shahabad", "Pehowa", "Ladwa",
  "Chandigarh", "Chandigarh", "Gurugram", "Faridabad", "Faridabad", "Kurukshetra",
  "Karnal", "Karnal", "Panipat", "Sonipat", "Rohtak", "Hisar", "Sirsa",
  "Bhiwani", "Bhiwani", "Jind", "Kaithal", "Rewari", "Palwal", "Jhajjar",
  "Fatehabad", "Narnaul", "Nuh", "Charkhi Dadri", "Mahendragarh", "Hansi",
  "Tohana", "Narwana", "Bahadurgarh", "Thanesar", "Gohana", "Samalkha",
  "Assandh", "Gharaunda", "Nilokheri", "Indri", "Meham", "Loharu",
  "Adampur", "Ellenabad", "Dabwali", "Safidon", "Julana",
  "Pundri", "Hodal",
]);

/**
 * The rest of Kerala's places in the fixtures — mostly Kollam's villages and
 * neighbourhoods (Thevally, Asramam, Mundakkal…), with the spellings the data uses. Too
 * many to pair by hand and none of them a district, so each takes a neighbourhood of the
 * state's demo district from `LOCALITY_POOL`, the same one every time.
 *
 * Found by sweeping the fixtures' address fields and Malayalam place-name endings
 * (owner's review, 2026-10-08). A new Kerala place in the data belongs here.
 */
const KERALA_LOCALITIES = [
  "Thevally", "Asramam", "Mundakkal", "Mayyanad", "Eravipuram", "Thangasseri",
  "Thangassery", "Thankassery", "Neendakara", "Pallimukku", "Sakthikulangara", "Perinad",
  "Kavanad", "Thenmala", "Thazhava", "Sooranad", "Kulathupuzha", "Chadayamangalam",
  "Vazhuthacaud", "Mynagappally", "Kaloor", "Kadavoor", "Kilikolloor", "Chathannoor",
  "Kadakkal", "Vadakkevila", "Kureepuzha", "Nedumpaikulam", "Kalluvathukkal", "Aryankavu",
  "Anchalummoodu", "Anchalumoodu", "Adichanalloor", "Venjaramoodu", "Thattamala",
  "Pooyappally", "Perumpuzha", "Parippally", "Pallithottam", "Neduvathoor", "Kilimanoor",
  "Kannanalloor", "Guruvayoor", "Yeroor", "Vembanad", "Ummannoor", "Thrikkovilvattom",
  "Thrikkadavoor", "Thodiyoor", "Thevalappuram", "Puthoor", "Puthur", "Piravanthoor",
  "Kulasekharapuram", "Kottukal", "Kottamkara", "Karimpinpuzha", "Kanjirappally",
  "Kalayapuram", "Kadappakkada", "Ithikkara", "Elampalloor", "Edamulakkal", "Chithara",
  "Chirakkara", "Kallingal", "Sasthamkotta", "Ashramam", "Ochira", "Mevaram",
  "Polayathode", "Ashtamudi", "Alappad", "Valakom", "Veliyam", "Ezhukone", "Poruvazhy",
  "Clappana", "Vayalar", "Vettikkavala", "Shakthikulangara",
] as const;

/**
 * The scrutiny queue's Ahmedabad localities — right in Gujarat, and moved to the state's
 * demo district like Kerala's everywhere else.
 */
const AHMEDABAD_LOCALITIES = [
  "Nikol", "Ghatlodia", "Bopal", "Chandkheda", "Naroda", "Vastrapur", "Satellite",
] as const;

const LOCALITY_POOL: Partial<Record<CourtId, string[]>> = {
  gujarat: [
    "Vastrapur", "Bopal", "Paldi", "Ellisbridge", "Vejalpur", "Ghatlodia", "Chandkheda",
    "Motera", "Sabarmati", "Isanpur", "Vatva", "Odhav", "Nikol", "Bapunagar", "Khokhra",
    "Ambawadi", "Thaltej", "Bodakdev", "Gota", "Sola", "Ranip", "Memnagar", "Shahibaug",
    "Jamalpur", "Kalupur", "Juhapura", "Sarkhej", "Narol", "Vastral", "Ramol",
  ],
  punjab: [
    "Civil Lines", "Dugri", "Haibowal", "BRS Nagar", "Kitchlu Nagar", "Shimlapuri",
    "Salem Tabri", "Gill Road", "Field Ganj", "Chaura Bazaar", "Daresi", "Focal Point",
    "Giaspura", "Lohara", "Basti Jodhewal", "Rajguru Nagar", "Pakhowal", "Ayali Kalan",
    "Mullanpur Dakha", "Sahnewal", "Machhiwara", "Maloud", "Sudhar", "Halwara", "Ladhowal",
    "Koom Kalan", "Dehlon", "Threeke", "Jhande", "Bhamian",
  ],
  haryana: [
    "Sector 2", "Sector 4", "Sector 6", "Sector 7", "Sector 8", "Sector 10", "Sector 11",
    "Sector 12", "Sector 14", "Sector 16", "Sector 17", "Sector 19", "Sector 20",
    "Sector 21", "Sector 25", "Sector 26", "Sector 28", "Mansa Devi Complex", "Surajpur",
    "Chandimandir", "Ramgarh", "Bhainsa Tibba", "Abheypur", "Budanpur", "Rajiv Colony",
    "Indira Colony", "Majri", "Amravati Enclave", "Kot Billa", "Batour",
  ],
};

/** A stable pick from the pool: the same Kerala locality always lands in the same place. */
function fromPool(name: string, pool: string[]): string {
  let hash = 7;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 10007;
  return pool[hash % pool.length];
}

/** Kollam's older name, which some of the data still uses. */
const ALIASES: Record<string, string> = { Quilon: "Kollam" };

export const PLACES: Partial<Record<CourtId, Places>> = Object.fromEntries(
  (
    [
      ["gujarat", GUJARAT],
      ["punjab", PUNJAB],
      ["haryana", HARYANA],
    ] as const
  ).map(([court, named]) => [
    court,
    {
      ...Object.fromEntries(KERALA_LOCALITIES.map((l) => [l, fromPool(l, LOCALITY_POOL[court]!)])),
      ...(court === "gujarat"
        ? {}
        : Object.fromEntries(AHMEDABAD_LOCALITIES.map((l) => [l, fromPool(l, LOCALITY_POOL[court]!)]))),
      ...named,
      ...Object.fromEntries(Object.entries(ALIASES).map(([alias, of]) => [alias, named[of]])),
    },
  ]),
);

/** Every Kerala place the fixtures use, for the localiser and for the review's detector. */
export const ALL_KERALA_PLACES: string[] = [
  ...KERALA_PLACES,
  ...KERALA_LOCALITIES,
  ...Object.keys(ALIASES),
];

/** Every place the localiser moves, Kerala's and the scrutiny queue's Ahmedabad ones. */
const MOVED_PLACES: string[] = [...ALL_KERALA_PLACES, ...AHMEDABAD_LOCALITIES];

/** One pattern for every Kerala place, longest names first so "Kochi" never eats a longer one. */
export const KERALA_PLACE_PATTERN = new RegExp(
  `\\b(${[...MOVED_PLACES].sort((a, b) => b.length - a.length).join("|")})\\b`,
  "g",
);

/** The state's court language, where the fixtures name Kerala's. */
export const COURT_LANGUAGE: Partial<Record<CourtId, string>> = {
  gujarat: "Gujarati",
  punjab: "Punjabi",
  haryana: "Hindi",
};

/** PIN codes begin with the postal circle: Kerala's 67–69 becomes the state's own. */
export const PIN_PREFIX: Partial<Record<CourtId, string>> = {
  gujarat: "38",
  punjab: "14",
  haryana: "13",
};

/**
 * Bar Council enrolment prefixes — one per state, whichever form the Kerala data wrote
 * (owner, 2026-10-12): Kerala's own `K` stays as it is, Gujarat takes `G`, and Punjab and
 * Haryana, which share the Bar Council of Punjab and Haryana, take `P`.
 */
export const BAR_PREFIX: Partial<Record<CourtId, { long: string; short: string }>> = {
  gujarat: { long: "G", short: "G" },
  punjab: { long: "P", short: "P" },
  haryana: { long: "P", short: "P" },
};/**
 * The approvals queue's names in Malayalam script — the screen's own test of a name in a
 * second script (`approve-registrations.ts`). Each state shows the same people in its
 * own court script, so the case the screen was built to survive still exists there.
 */
export const SCRIPT_NAMES: Record<string, Partial<Record<CourtId, string>>> = {
  "അനിൽകുമാർ പി. നായർ": { gujarat: "અનિલકુમાર પી. નાયર", punjab: "ਅਨਿਲਕੁਮਾਰ ਪੀ. ਨਾਇਰ", haryana: "अनिलकुमार पी. नायर" },
  "മീര സുധാകരൻ": { gujarat: "મીરા સુધાકરન", punjab: "ਮੀਰਾ ਸੁਧਾਕਰਨ", haryana: "मीरा सुधाकरन" },
  "ഷൈലജ രാമകൃഷ്ണൻ": { gujarat: "શૈલજા રામકૃષ્ણન", punjab: "ਸ਼ੈਲਜਾ ਰਾਮਕ੍ਰਿਸ਼ਨਨ", haryana: "शैलजा रामकृष्णन" },
  "സുമ ബാലകൃഷ്ണൻ": { gujarat: "સુમા બાલકૃષ્ણન", punjab: "ਸੁਮਾ ਬਾਲਕ੍ਰਿਸ਼ਨਨ", haryana: "सुमा बालकृष्णन" },
  "ജോസഫ് മാത്യു": { gujarat: "જોસેફ મેથ્યુ", punjab: "ਜੋਸਫ਼ ਮੈਥਿਊ", haryana: "जोसेफ मैथ्यू" },
};

/** The `lang` code for that script, where the data marks a name as Malayalam (`ml`). */
export const SCRIPT_LANG: Partial<Record<CourtId, string>> = {
  gujarat: "gu",
  punjab: "pa",
  haryana: "hi",
};

/**
 * Kerala house names in the sample addresses ("Puthenveedu, Market Road") — as plainly
 * Malayalam as the towns around them, so each state has its own in their place.
 */
export const HOUSE_NAMES: Record<string, Partial<Record<CourtId, string>>> = {
  Sreenilayam: { gujarat: "Shanti Kunj", punjab: "Kirpa Niwas", haryana: "Sukh Niwas" },
  Puthenveedu: { gujarat: "Krishna Kunj", punjab: "Guru Kripa", haryana: "Hari Om Bhawan" },
  Ayathil: { gujarat: "Gokul Dham", punjab: "Sukh Sadan", haryana: "Radhe Niwas" },
  Vadakkethil: { gujarat: "Sai Krupa", punjab: "Preet Niwas", haryana: "Jai Bhawan" },
  Thekkethil: { gujarat: "Shiv Shakti", punjab: "Shanti Bhawan", haryana: "Gopal Sadan" },
  Nedumkandathil: { gujarat: "Narmada Niwas", punjab: "Satnam Villa", haryana: "Shiv Kripa" },
  Muttathil: { gujarat: "Ambika Sadan", punjab: "Jot Niwas", haryana: "Prem Niwas" },
  Kizhakkethil: { gujarat: "Om Villa", punjab: "Waheguru Niwas", haryana: "Shanti Kunj" },
  Kadavil: { gujarat: "Nandanvan", punjab: "Kartar Niwas", haryana: "Ram Niwas" },
  Anugraha: { gujarat: "Krupa", punjab: "Kirpa", haryana: "Kripa" },
};

/** The state's two-letter code, where an identifier carries Kerala's "KL". */
export const STATE_CODE: Partial<Record<CourtId, string>> = {
  gujarat: "GJ",
  punjab: "PB",
  haryana: "HR",
};

/**
 * Kerala's district codes inside identifiers (KLKL01-…, KL-KLEK-…) and the Kerala
 * Gramin Bank's IFSC prefix (KLGB…), as the state's: the demo district by default.
 */
const DISTRICT_CODE: Partial<Record<CourtId, Record<string, string>>> = {
  gujarat: { KL: "AH", KM: "AH", EK: "SR", TV: "GN", GB: "GB" },
  punjab: { KL: "LD", KM: "LD", EK: "JL", TV: "MH", GB: "GB" },
  haryana: { KL: "PK", KM: "PK", EK: "GG", TV: "AM", GB: "GB" },
};

export function districtCode(court: CourtId, kerala: string): string {
  const codes = DISTRICT_CODE[court];
  return codes?.[kerala] ?? codes?.KL ?? kerala;
}
