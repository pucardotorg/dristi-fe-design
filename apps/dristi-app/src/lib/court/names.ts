/**
 * Kerala's sample people, renamed for another state's court.
 *
 * The fixtures' parties, advocates and staff carry Malayali names — "Gopinathan Nair v.
 * Chaithanya Agencies", "Krishnan Kutty" — which read as Kerala on a Gujarat cause list
 * however the court and the numbers are re-voiced (owner's review, 2026-10-08). Each
 * clearly Malayali name part takes a name typical of the state instead, and the same one
 * every time, so a party keeps one name across every screen:
 *
 * - a surname for a surname — and a Malayali given name used as a surname ("Ravi
 *   Sudhakaran") becomes a surname too;
 * - a man's name for a man's, a woman's for a woman's;
 * - a Malayali Muslim name for a Muslim name of the state, and a Kerala Christian family
 *   name for a Christian one, so nobody's community changes with the court.
 *
 * Names shared across India — Suresh, Priya, Thomas, Fathima, Abdul — are left alone.
 * The lists were taken from the fixtures by comparing every screen in Kerala with the
 * same screen in Gujarat (2026-10-08); a new Malayali name in the data belongs here.
 */

import type { CourtId } from "./profiles";

type Kind =
  | "surname"
  | "christian"
  | "christianMan"
  | "christianWoman"
  | "man"
  | "woman"
  | "muslimMan"
  | "muslimWoman"
  | "suffix"
  | "trade";

const KERALA: Record<Kind, string[]> = {
  surname: [
    "Pillai", "Menon", "Menonn", "Nair", "Kutty", "Kurup", "Warrier", "Nambiar", "Panicker",
    "Unnithan", "Thampi", "Achari", "Chirayil", "Kunnathu", "Vadakkan", "Pareed", "Aliyar",
    "Kunju", "Rawther",
  ],
  christian: [
    "Varghese", "Vargheese", "Kurian", "Kurien", "Kuriakose", "Chacko", "Varkey", "Chandy",
    "Thankachan", "Avirah",
   "Cruz",
  ],
  man: [
    "Krishnan", "Chandran", "Raghavan", "Sasidharan", "Ravindran", "Raveendran", "Kesavan",
    "Vasudevan", "Balachandran", "Vijayan", "Sivadasan", "Damodaran", "Chandrasekharan",
    "Sudhakaran", "Sankaran", "Mohanan", "Lakshmanan", "Neelakantan", "Neelakanta",
    "Radhakrishnan", "Unnikrishnan", "Gopalakrishnan", "Balakrishnan", "Ramakrishnan",
    "Sadanandan", "Nadesan", "Devarajan", "Achuthan", "Anandan", "Gopinathan", "Sreedharan",
    "Chellappan", "Ponnappan", "Kuttan", "Krishnankutty", "Balan", "Balagopal", "Gopakumar",
    "Nandakumar", "Sreekumar", "Anilkumar", "Vijayakumar", "Haridas", "Haridasan",
    "Mohandas", "Rejen", "Rajilan", "Sabu", "Biju", "Shaji", "Sajan", "Saji", "Baiju",
    "Sreejith", "Unni", "Sabari", "Nithin", "Sanoop", "Aneesh", "Prasanth", "Sudheer",
    "Vinu", "Sasi", "Ashokan", "Ajith", "Rajagopal",
  
    "Sreedhar", "Sajeev", "Sujith", "Sarath", "Krishnakumar", "Sudheesh", "Kunjumon",
    "Prabhakaran", "Bhaskaran", "Ramachandran",
  
    "Shibu", "Byju", "Thejas", "Prakashan", "Hariharan", "Kochu",
  ],
  woman: [
    "Latha", "Bindu", "Shailaja", "Sreeja", "Bijini", "Salini", "Leena", "Leela",
    "Jayasree", "Sreedevi", "Sreelatha", "Sheeba", "Beena", "Omana", "Soumya", "Remya",
    "Geetha", "Kavitha", "Girija", "Ajitha", "Remani", "Vasanthi", "Thankamani", "Mangala",
    "Manju", "Neethu", "Sindhu", "Aiswarya", "Anitha",
  
    "Jayalakshmi", "Sheeja", "Sarala", "Padmini", "Sarasamma", "Sosamma", "Thulasi",
    "Sujatha",
  
    "Vijayamma", "Deepthi", "Suma", "Preetha", "Sabitha", "Lathika", "Nila", "Sreekala",
    "Bhagyalakshmi",
  ],
  muslimMan: [
    "Riyas", "Noushad", "Ashique", "Shihabudeen", "Aboobacker", "Sainudheen", "Rafeeq",
    "Basheer", "Sadath", "Haneefa", "Latheef", "Sidhique", "Nazar", "Muhammed",
  
    "Zakariya", "Fazil", "Nazeer",
  
    "Nasar", "Shanavas", "Nowfal", "Sait",
  ],
  muslimWoman: [
    "Sainaba", "Zainaba", "Rukhiya", "Fousiya", "Suhara", "Jameela", "Ramla", "Ameena",
    "Shameem",
  
    "Nazeema", "Nazrin", "Meharunnisa", "Saleena", "Sabeena", "Nabeesa", "Shabna",
  
    "Ayisha", "Tahera", "Shahana", "Beegum", "Jaseela", "Mariyam", "Latheefa",
  ],
  christianMan: ["Jomon"],
  christianWoman: ["Annamma", "Leelamma", "Ponnamma", "Roselyn"],
  suffix: ["Beevi", "Amma", "Ammal"],
  trade: ["Malabar", "Travancore", "Vismaya", "Chaithanya", "Kairali", "Sree", "Highrange"],
};

/** Christian given names in use across India, for Kerala's Christian given names. */
const CHRISTIAN_MEN = ["Samuel", "Daniel", "Emmanuel", "Stephen", "Paul", "Anthony"];
const CHRISTIAN_WOMEN = ["Mary", "Rebecca", "Ruth", "Esther", "Grace", "Agnes"];

type Pools = Record<Exclude<Kind, "suffix" | "trade" | "christianMan" | "christianWoman">, string[]> & {
  suffix: string;
  trade: Record<string, string>;
};

const POOLS: Partial<Record<CourtId, Pools>> = {
  gujarat: {
    surname: [
      "Patel", "Shah", "Desai", "Mehta", "Joshi", "Trivedi", "Parikh", "Modi", "Bhatt",
      "Pandya", "Chauhan", "Solanki", "Parmar", "Rathod", "Vyas", "Thakkar", "Doshi",
      "Kothari", "Raval", "Panchal",
    ],
    christian: ["Macwan", "Christian", "Vaghela", "Rathod"],
    man: [
      "Hitesh", "Jignesh", "Bhavesh", "Ketan", "Nilesh", "Paresh", "Dhaval", "Chirag",
      "Hardik", "Mehul", "Jayesh", "Kalpesh", "Mitesh", "Rakesh", "Tushar", "Hemant",
      "Pankaj", "Bharat", "Dinesh", "Kirit",
    ],
    woman: [
      "Kinjal", "Hetal", "Nirali", "Dhara", "Falguni", "Bhumika", "Komal", "Jagruti",
      "Hiral", "Krupa", "Mansi", "Rupal",
    ],
    muslimMan: ["Irfan", "Imran", "Javed", "Yusuf", "Salim", "Altaf", "Arif", "Juned"],
    muslimWoman: ["Shabana", "Rukhsar", "Nasreen", "Sabiha", "Firdaus", "Shehnaz"],
    suffix: "Ben",
    trade: {
      Malabar: "Saurashtra", Travancore: "Kathiawar", Vismaya: "Vandana",
      Chaithanya: "Chetna", Kairali: "Gurjari", Sree: "Shree", Highrange: "Girnar",
    },
  },
  "punjab-haryana": {
    surname: [
      "Yadav", "Malik", "Dahiya", "Hooda", "Sangwan", "Phogat", "Chaudhary", "Sheoran",
      "Rathee", "Dalal", "Ahlawat", "Kadian", "Beniwal", "Saini", "Jangra", "Goyal",
      "Bansal", "Mittal", "Garg", "Aggarwal",
    ],
    christian: ["Masih", "Peter", "Lal", "Massey"],
    man: [
      "Sandeep", "Pradeep", "Naveen", "Rakesh", "Ankit", "Vikas", "Deepak", "Mukesh",
      "Sanjay", "Jitender", "Satbir", "Dharmender", "Surender", "Manjeet", "Rajbir",
      "Joginder", "Krishan", "Ramesh", "Virender", "Yogesh",
    ],
    woman: [
      "Sunita", "Kavita", "Neha", "Monika", "Ritu", "Babita", "Savita", "Suman", "Anju",
      "Seema", "Poonam", "Kiran",
    ],
    muslimMan: ["Aslam", "Mubarik", "Ishaq", "Khurshid", "Saddiq", "Hakam", "Zakir", "Rashid"],
    muslimWoman: ["Sajida", "Mehmuna", "Shakila", "Asmina", "Rubeena", "Sabra"],
    suffix: "Devi",
    trade: {
      Malabar: "Bangar", Travancore: "Mewat", Vismaya: "Vardaan",
      Chaithanya: "Chetna", Kairali: "Haryali", Sree: "Shri", Highrange: "Aravali",
    },
  },
};

/**
 * The scrutiny queue's sample people are Gujarati ("Nirmala Ben v. Girish Thakkar") —
 * right in Gujarat and moved, like Kerala's, everywhere else.
 */
const GUJARATI: Partial<Record<Kind, string[]>> = {
  surname: ["Thakkar", "Vyas", "Dave", "Trivedi", "Modi", "Bhatt", "Solanki", "Mehta", "Vaidya", "Vasani"],
  man: ["Alkesh", "Jignesh", "Jayesh", "Suyog"],
  woman: ["Hetal"],
  suffix: ["Ben"],
};

/** A stable pick: the same name always becomes the same name. */
function pick(name: string, pool: string[]): string {
  let hash = 11;
  for (const char of name) hash = (hash * 33 + char.charCodeAt(0)) % 100003;
  return pool[hash % pool.length];
}

const KIND_OF = new Map<string, Kind>();
for (const kind of Object.keys(KERALA) as Kind[]) for (const n of KERALA[kind]) KIND_OF.set(n, kind);
const GUJARATI_KIND = new Map<string, Kind>();
for (const kind of Object.keys(GUJARATI) as Kind[]) for (const n of GUJARATI[kind] ?? []) GUJARATI_KIND.set(n, kind);

/**
 * One Malayali name part, for one state. `asSurname` is for a given name standing where
 * a surname goes — after another name, as Malayali patronymics do ("Ravi Sudhakaran").
 */
export function voiceName(court: CourtId, name: string, asSurname: boolean): string {
  const pools = POOLS[court];
  const kind = KIND_OF.get(name) ?? (court === "gujarat" ? undefined : GUJARATI_KIND.get(name));
  if (!pools || !kind) return name;
  switch (kind) {
    case "suffix":
      return pools.suffix;
    case "trade":
      return pools.trade[name] ?? name;
    case "christianMan":
      return pick(name, asSurname ? pools.christian : CHRISTIAN_MEN);
    case "christianWoman":
      return pick(name, asSurname ? pools.christian : CHRISTIAN_WOMEN);
    case "man":
    case "woman":
      return pick(name, asSurname ? pools.surname : pools[kind]);
    case "muslimMan":
    case "muslimWoman":
      return pick(name, asSurname ? pools.muslimMan : pools[kind]);
    default:
      return pick(name, pools[kind]);
  }
}

/** Every Malayali name part, for the localiser's pattern and the review's detector. */
export const MALAYALI_NAMES: string[] = Object.values(KERALA).flat();

/** And the Gujarati ones, which only move outside Gujarat. */
const ALL_NAMES: string[] = [...MALAYALI_NAMES, ...Object.values(GUJARATI).flat()];

/**
 * The pattern the localiser uses: an optional preceding name (so a patronymic in
 * surname position can be told apart), then the Malayali name part.
 */
export const MALAYALI_NAME_PATTERN = new RegExp(
  `(\\b[A-Z][a-z]+\\.?\\s+)?\\b(${[...ALL_NAMES].sort((a, b) => b.length - a.length).join("|")})\\b`,
  "g",
);
