// Maskowanie sekretów, danych osobowych i kwot na potrzeby nagrywania ekranu.
// Czyste funkcje bez wywołań $: testowalne i bez dostępu do sieci.
// To heurystyka wyświetlania, nie granica bezpieczeństwa: regex przepuści
// nietypowy zapis, a model i tak widzi oryginał w kontekście.

export const DOTS = '••••••••'
export const HIDE = '•••'
export const HIDDEN_OUTPUT = '••• ukryte podczas nagrywania'

export type Mode = 'off' | 'on' | 'strict'

export type RecConfig = {
  keepNames: string[]
  names: string[]
  hide: string[]
  allow: string[]
  privatePaths: string[]
  allowPaths: string[]
  businessTools: string[]
  closedTools: string[]
  noteToClaude: boolean
}

export const EMPTY_CONFIG: RecConfig = {
  keepNames: [],
  names: [],
  hide: [],
  allow: [],
  privatePaths: [],
  allowPaths: [],
  businessTools: [],
  closedTools: [],
  noteToClaude: false,
}

// ---------------------------------------------------------------- sekrety

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
  /sk-ant-[A-Za-z0-9_-]{16,}/g,
  /\bsk-(?:proj-|live-|test-|svcacct-|or-v1-)?[A-Za-z0-9_-]{20,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bnpm_[A-Za-z0-9]{30,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:hf|r8|pk_live|sk_live|rk_live|pk_test|sk_test|whsec|pat|key|gsk|xai|dop_v1|shpat|shpss)_[A-Za-z0-9]{20,}/g,
  /\bxai-[A-Za-z0-9]{20,}/g,
  /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g,
  /\b(?:Bearer|Basic|Token)\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
]

// hasło w URL-u: scheme://user:HASŁO@host
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)([^\s@/]{3,})(@)/gi

// NAZWA=wartość, "nazwa": "wartość", hasło: wartość
const ASSIGNMENT =
  /((?<![\p{L}])[\p{L}0-9_.-]*(?:API[_-]?KEY|APIKEY|SECRET|TOKEN|PASSWORD|PASSWD|PASSPHRASE|HAS[ŁL]O|HAS[ŁL]A|PWD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY|CLIENT[_-]?SECRET|CREDENTIALS?|COOKIE|SESSION[_-]?ID|AUTH)[\p{L}0-9_.-]*)(["']?\s*[=:]\s*["']?)([^\s"'`,;}{]{4,})/giu

const PIN = /((?<![\p{L}])(?:PIN|CVV2?|CVC2?|kod PIN|kod CVV)[ \t]*[:=][ \t]*)(\d{3,8})(?!\d)/giu

// ---------------------------------------------------------------- osoby

const EMAIL_SRC = '[\\p{L}0-9._%+-]+@[\\p{L}0-9.-]+\\.[A-Za-z]{2,}'
const EMAIL = new RegExp(`(?<![\\p{L}0-9._%+-])${EMAIL_SRC}`, 'gu')

const NAME_WORD = "\\p{Lu}[\\p{L}'’.-]*"
const DISPLAY_NAME = new RegExp(
  `(["']?)(${NAME_WORD}(?:[ \\t]+${NAME_WORD}){0,3})\\1([ \\t]*<[ \\t]*${EMAIL_SRC}[ \\t]*>)`,
  'gu',
)
const PERSON_KEY =
  /("(?:displayName|display_name|fullName|full_name|firstName|first_name|lastName|last_name|givenName|given_name|familyName|family_name|real_name|realName|senderName|sender_name|authorName|author_name|username|user_name|imie|imię|nazwisko|imie_nazwisko)"\s*:\s*")([^"]{1,80})(")/gu
const PERSON_LINE = new RegExp(
  '^([ \\t>*-]*(?:From|To|Cc|Bcc|Reply-To|Attendees?|Organizer|Invitees?|Guests?|Assignees?|Sender|Owner|Full name|Contact|Customer|' +
    'Od|Do|DW|UDW|Nadawca|Odbiorca|Adresat|Klient|Kontrahent|Właściciel|Uczestnicy|Uczestnik|Organizator|Zaproszeni|Przypisan[ya]|' +
    'Imię i nazwisko|Imie i nazwisko|Imię|Nazwisko|Adres(?: zamieszkania| zameldowania| do korespondencji)?|Osoba kontaktowa|Kontakt|Pracownik|Pacjent)' +
    '[ \\t]*:[ \\t]*)(\\S.*)$',
  'gmu',
)

// ---------------------------------------------------------------- dane osobowe

const PHONE_US = /(?<![\w.])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w.])/g
const PHONE_INTL = /(?<![\w.+])(?:\+|00)\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?![\w.])/g
// polskie komórki bez prefiksu: 600 100 200, 600-100-200 (pierwsza cyfra 4-8)
const PHONE_PL = /(?<![\w.,])[4-8]\d{2}([\s-])\d{3}\1\d{3}(?![\w.,])/g
// stacjonarne: (22) 123 45 67, 22 123-45-67
const PHONE_PL_LANDLINE = /(?<![\w.,])\(?\d{2}\)?\s\d{3}[\s-]\d{2}[\s-]\d{2}(?![\w.,])/g
const PHONE_LABEL =
  /((?<![\p{L}])(?:tel(?:efon)?|tel\.|kom(?:órka|orka)?\.?|nr tel\.?|phone|mobile|cell|fax)[ \t]*[.:]?[ \t]*)(\+?[\d \t().-]{7,20}\d)/giu

const SSN = /(?<![\w-])\d{3}-\d{2}-\d{4}(?![\w-])/g
const EIN = /(?<![\w-])\d{2}-\d{7}(?![\w-])/g
const CARD = /(?<![\w-])[2-6]\d{3}(?:[ -]?\d){9,15}(?![\w-])/g
const IBAN = /(?<![A-Z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?(?![A-Z0-9])/g
// polski NRB bez "PL": 26 cyfr, zwykle 2 + 6×4
const NRB = /(?<![\d])\d{2}(?: ?\d{4}){6}(?![\d])/g
const PESEL = /(?<![\d])\d{11}(?![\d])/g
const NIP = /(?<![\w-])(?:PL ?)?(?:\d{3}-\d{3}-\d{2}-\d{2}|\d{3}-\d{2}-\d{2}-\d{3})(?![\w-])/g
const NIP_PL_PREFIX = /(?<![\w])PL ?\d{10}(?![\d])/g
const ID_LABEL =
  /((?<![\p{L}])(?:PESEL|NIP|REGON|KRS|BDO|nr\.?[ \t]+dowodu(?:[ \t]+osobistego)?|dow[oó]d(?:[ \t]+osobisty)?|seria[ \t]+i[ \t]+n(?:ume)?r|nr\.?[ \t]+paszportu|paszport|passport(?:[ \t]+(?:no\.?|number))?|nr\.?[ \t]+rachunku|numer[ \t]+rachunku|nr\.?[ \t]+konta|numer[ \t]+konta|rachunek(?:[ \t]+bankowy)?|konto(?:[ \t]+bankowe)?|routing|account|acct|a\/c|aba|swift|bic|iban|driver'?s[ \t]+license|prawo[ \t]+jazdy|tax[ \t]+id|vat[ \t]+(?:id|no\.?)|SSN|EIN)(?:[ \t]*(?:number|no\.?|num|nr\.?|#))?[ \t]*[:#№.-]?[ \t]*)([A-Z]{0,3}[ \t-]?\d[\dA-Z \t-]{3,40}[\dA-Z])/giu
const CARD_ENDING = /((?:ending(?:[ \t]+in)?|last[ \t]+(?:4|four)(?:[ \t]+digits)?|końcówk[aąi]|kończąc[aąej]+[ \t]+się[ \t]+na)[ \t]*[:#]?[ \t]*)(\d{4})(?!\d)/giu
const BIRTH =
  /((?<![\p{L}])(?:DOB|D\.O\.B\.|date of birth|birth[ \t]?date|birthday|born(?: on)?|data urodzenia|ur\.|urodzon[ya](?: dnia)?)[ \t]*[:-]?[ \t]*)([\p{L}0-9 ,/.-]{4,20}\d)/giu

const STREET_EN =
  /\b\d{1,6}[ \t]+(?:[NSEW]\.?[ \t]+)?(?:\p{Lu}[\p{L}'.-]*[ \t]+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Parkway|Pkwy|Highway|Hwy|Circle|Cir|Terrace|Ter|Trail|Trl|Square|Sq)\b\.?(?:,?[ \t]+(?:Apt|Apartment|Suite|Ste|Unit|#)\.?[ \t]*[\w-]+)?/gu
const STREET_PL =
  /(?<![\p{L}])(?:[Uu]l\.|[Aa]l\.|[Pp]l\.|[Oo]s\.|[Uu]lica|[Aa]leja|[Aa]leje|[Pp]lac|[Oo]siedle)[ \t]*(?:[\p{Lu}0-9][\p{L}0-9.'-]*[ \t]+){1,4}\d{1,4}[A-Za-z]?(?:[ \t]?\/[ \t]?\d{1,4}[A-Za-z]?)?(?:[ \t]*(?:m\.|lok\.|lokal|m)[ \t]*\d{1,4})?/gu
const POSTAL_PL = /(?<![\d-])\d{2}-\d{3}(?![\d-])([ \t]+\p{Lu}[\p{L}-]+(?:[ \t]+\p{Lu}[\p{L}-]+)?)/gu
const PO_BOX = /\bP\.?\s?O\.?\s+Box\s+\d+/gi
const SKRYTKA = /(?<![\p{L}])skr(?:ytka|\.)[ \t]+poczt(?:owa|\.)[ \t]+(?:nr[ \t]+)?\d+/giu
const STATE_ZIP =
  /(,\s*(?:A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY]))\s+\d{5}(?:-\d{4})?\b/g
const IPV4 = /(?<![\w.])((?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3})(?![\w.])/g

// ---------------------------------------------------------------- kwoty

// 1 234 567,89 | 1.234.567,89 | 1,234,567.89 | 1234,5 | 1234.5 (spacje: zwykła, twarda, wąska)
const NUM = "(?:\\d{1,3}(?:[ \\u00a0\\u202f.,']\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)"
const MULT =
  '(?:\\s?(?:tys\\.|mln\\.?|mld\\.?|bln\\.?|tys|tysi(?:ąc|ące|ęcy)|milion(?:y|ów|a)?|miliard(?:y|ów|a)?|million|millions|billion|billions|thousand|bn|mio|k|K|M|B)(?![\\p{L}]))?'
const CUR_SYM = '(?:US\\$|C\\$|A\\$|[$€£¥₴₽₹₩₺¢₿]|zł|zl|Kč)'
const CUR_CODE = '(?:PLN|USD|EUR|GBP|CHF|JPY|CNY|CZK|SEK|NOK|DKK|HUF|UAH|CAD|AUD|NZD|RUB|INR|BTC|ETH|USDT|USDC)'
const CUR_WORD =
  '(?:zł|zl|złotych|złote|złoty|zlotych|groszy|gr|dolarów|dolary|dolar|dolara|euro|funtów|funty|franków|koron|hrywien|jenów|dollars?|bucks|pounds|euros|cents?)'
const MONEY_PRE = new RegExp(`(?<![\\p{L}\\d])${CUR_SYM}\\s?-?${NUM}${MULT}|(?<![\\p{L}\\d])${CUR_CODE}\\s?-?${NUM}${MULT}`, 'gu')
const MONEY_POST = new RegExp(
  `(?<![\\p{L}\\d.,])-?${NUM}(?:,-|,–)?${MULT}\\s?(?:${CUR_SYM}|${CUR_CODE}|${CUR_WORD})(?![\\p{L}])`,
  'gu',
)

// Liczby obok słów biznesowych: "przychód 84 tys.", "marża 40%", "MRR is 84k"
const FIN_WORD = new RegExp(
  '(?<![\\p{L}])(?:' +
    'revenues?|mrr|arr|gmv|profits?|profit share|margins?|ebitda|income|earnings|payroll|salar(?:y|ies)|wages?|compensation|comp|bonus(?:es)?|equity|stakes?|ownership|valuation|runway|burn(?: rate)?|cash(?:flow)?|balances?|budgets?|spend(?:ing)?|pric(?:e|es|ing)|fees?|invoices?|payouts?|distributions?|dividends?|tax(?:es)?|sales|ltv|cac|aov|sponsor(?:s|ships?)?|cpm|rpm|retainers?|commissions?|royalt(?:y|ies)|refunds?|expenses?|debts?|loans?|funding|investments?|deals?|net|gross|paid|pays?|owed?|costs?|' +
    'przych[oó]d\\p{L}*|obr[oó]t\\p{L}*|obrot\\p{L}*|zysk\\p{L}*|strat[aęy]?|marż\\p{L}*|marz[ay]|doch[oó]d\\p{L}*|wynagrodze\\p{L}*|pensj\\p{L}*|płac\\p{L}*|wypłat\\p{L}*|budżet\\p{L}*|budzet\\p{L}*|koszt\\p{L}*|cen[aęyi]?|cenni\\p{L}*|faktur\\p{L}*|kwot\\p{L}*|sald[oa]|stan konta|kredyt\\p{L}*|pożyczk\\p{L}*|dług\\p{L}*|zadłużen\\p{L}*|inwestycj\\p{L}*|wycen\\p{L}*|premi\\p{L}*|prowizj\\p{L}*|podat\\p{L}*|vat|netto|brutto|sprzedaż\\p{L}*|sprzedaz\\p{L}*|wydatk\\p{L}*|wydatek|opłat\\p{L}*|rabat\\p{L}*|stawk\\p{L}*|dywidend\\p{L}*|udział\\p{L}*|kapitał\\p{L}*|oszczędnoś\\p{L}*|należnoś\\p{L}*|zobowiąza\\p{L}*' +
    ')(?![\\p{L}])',
  'giu',
)
const FIGURE = new RegExp(
  `(?<![\\p{L}\\d.,])${NUM}(?:\\s?(?:%|‰|proc\\.|procent\\p{L}*|percent(?![\\p{L}])|x(?![\\p{L}])))?${MULT}`,
  'gu',
)
// tryb strict: procenty i duże liczby wszędzie
const PERCENT = new RegExp(
  `(?<![\\p{L}\\d.,])-?\\d+(?:[.,]\\d+)?\\s?(?:%|‰|proc\\.|procent\\p{L}*|percent(?![\\p{L}])|p\\.p\\.|pp(?![\\p{L}]))`,
  'gu',
)
const BIG_FIGURE = new RegExp(
  "(?<![\\p{L}\\d.,/:#_-])(?:" +
    "\\d{1,3}(?:[ \\u00a0\\u202f.,']\\d{3})+(?:[.,]\\d+)?" + // pogrupowane
    '|\\d{4,}[.,]\\d+' + // 1234,56
    '|\\d{5,}' + // 12345
    `|\\d+(?:[.,]\\d+)?(?:\\s?(?:tys\\.|mln\\.?|mld\\.?|tys|tysi(?:ąc|ące|ęcy)|milion(?:y|ów|a)?|miliard(?:y|ów|a)?|million|billion|thousand|bn|k|K|M|B)(?![\\p{L}]))` +
    ')(?![\\p{L}\\d_-])',
  'gu',
)

// ---------------------------------------------------------------- imiona i nazwiska

// Pojedyncze imiona będące zwykłymi słowami: nie są uczone z adresów e-mail.
const COMMON_WORDS = new Set(
  'Will Mark Grant Bill Rich Art Hope Faith Joy May June April August Summer Rose Page Chase Hunter Max Ray Dawn Sky Brook Lane Dean Gene Guy Frank Sterling Major Price Young King Long Little Wood Hill Stone Field Ford Hall Bell Rice Banks Case Cook Fox Gray Green Brown White Black Day Lee West North South Love Church Park Street Bishop Mason Miller Baker Carter Cole Wells Hart Moon Star Van Von De Del La Le Da Di St Mr Mrs Ms Dr Jr Sr Claude Code Team Support Admin Info Hello The And Ai Slack Gmail Google Calendar Meeting Sync Notes Update Review Weekly Daily Monday Tuesday Wednesday Thursday Friday Saturday Sunday Pan Pani Biuro Kontakt Zespół Dział Lato Wiosna Zima Jesień Róża Wiktoria Maj Lipiec Sierpień Kwiecień Marzec Luty Styczeń'.split(
    ' ',
  ),
)
const ROLE_LOCAL_PARTS =
  /^(?:info|hello|hi|team|support|help|admin|noreply|no-reply|donotreply|contact|sales|billing|accounts?|notifications?|news|newsletter|marketing|office|mail|security|privacy|legal|press|jobs|careers|hr|ops|dev|bot|alerts?|updates?|calendar|invites?|biuro|kontakt|sekretariat|faktury|ksiegowosc|kadry|rekrutacja|sklep|zamowienia|pomoc|obsluga)$/i

// Polska fleksja: końcówki doklejane do tematu (Kowalsk-iego, Ann-ie, Nowak-iem).
const PL_SUFFIX = '(?:iego|iemu|owie|owi|owej|ową|owa|ami|ach|iej|iem|imi|ich|em|om|ów|ie|im|a|ą|ę|e|i|y|o|u)?'
const FOLD: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z', Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z' }

export function foldPl(s: string): string {
  return s.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c) => FOLD[c] ?? c)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Wzorzec niewrażliwy na polskie znaki: Wisniewska z e-maila łapie też Wiśniewską
const PL_CLASS: Record<string, string> = { a: 'aą', c: 'cć', e: 'eę', l: 'lł', n: 'nń', o: 'oó', s: 'sś', z: 'zźż' }
function plPattern(s: string): string {
  let out = ''
  for (const ch of foldPl(s)) {
    const lower = ch.toLowerCase()
    const cls = PL_CLASS[lower]
    out += cls ? '[' + (ch === lower ? cls : cls.toUpperCase()) + ']' : escapeRegExp(ch)
  }
  return out
}

// Temat nazwiska/imienia, do którego dokleja się końcówki: Kowalski -> Kowalsk, Anna -> Ann
function stem(word: string): string {
  if (word.length >= 5 && /(?:sk|ck|dzk)[iaą]$/i.test(word)) return word.slice(0, -1)
  if (word.length >= 4 && /[aeiouyąęó]$/i.test(word)) return word.slice(0, -1)
  return word
}

type NameForm = { text: string; inflect: boolean }

function keepSet(keepNames: string[]): Set<string> {
  const keep = new Set<string>()
  for (const n of keepNames) {
    const clean = String(n || '').replace(/\s+/g, ' ').trim()
    if (!clean) continue
    for (const v of [clean, foldPl(clean)]) {
      keep.add(v)
      keep.add(v.toLowerCase())
      keep.add(v.toLowerCase().replace(/ /g, '-'))
      for (const part of v.split(/[ -]/)) if (part) keep.add(part)
    }
  }
  return keep
}

// explicit: imię z konfiguracji (maskowane zawsze); inaczej wyuczone z e-maila
function nameForms(full: string, keep: Set<string>, explicit: boolean): NameForm[] {
  const clean = String(full || '').replace(/\s+/g, ' ').trim()
  if (!clean || clean.length > 60 || keep.has(clean)) return []
  const forms: NameForm[] = []
  const parts = clean.split(/[ -]/).filter((p) => /^\p{Lu}[\p{L}'’.]*$/u.test(p) && p.length >= 2)
  if (parts.length >= 2) {
    for (const v of [clean]) {
      forms.push({ text: v.toLowerCase(), inflect: false })
      forms.push({ text: v.toLowerCase().replace(/ /g, '-'), inflect: false })
      forms.push({ text: v.toLowerCase().replace(/ /g, '_'), inflect: false })
      forms.push({ text: v.toLowerCase().replace(/ /g, '.'), inflect: false })
    }
  }
  for (const p of parts) {
    if (keep.has(p)) continue
    if (!explicit && COMMON_WORDS.has(p)) continue
    for (const v of [p]) {
      forms.push({ text: v, inflect: true })
      forms.push({ text: v.toUpperCase(), inflect: false })
    }
  }
  return forms
}

function namesFromEmail(email: string): string | null {
  const local = email.split('@')[0] ?? ''
  if (ROLE_LOCAL_PARTS.test(local)) return null
  const parts = local.split(/[._+-]/).filter((p) => /^\p{L}{2,}$/u.test(p))
  if (parts.length < 2 || parts.length > 4) return null
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
}

// ---------------------------------------------------------------- walidatory

function luhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function validPesel(s: string): boolean {
  if (!/^\d{11}$/.test(s)) return false
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
  const d = s.split('').map(Number) as [number, number, number, number, number, number, number, number, number, number, number]
  const sum = w.reduce((acc, x, i) => acc + x * (d[i] ?? 0), 0)
  if ((10 - (sum % 10)) % 10 !== d[10]) return false
  const month = d[2] * 10 + d[3]
  const day = d[4] * 10 + d[5]
  return month % 20 >= 1 && month % 20 <= 12 && day >= 1 && day <= 31
}

export function validNip(s: string): boolean {
  const d = s.replace(/\D/g, '')
  if (d.length !== 10) return false
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = w.reduce((acc, x, i) => acc + x * Number(d[i]), 0) % 11
  return sum !== 10 && sum === Number(d[9])
}

export function validIban(s: string): boolean {
  const c = s.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(c)) return false
  const moved = c.slice(4) + c.slice(0, 4)
  let rem = 0
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55)
    for (const digit of v) rem = (rem * 10 + Number(digit)) % 97
  }
  return rem === 1
}

function publicIp(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number)
  if (a === 10 || a === 127 || a === 0 || ip === '255.255.255.255') return false
  if (a === 192 && b === 168) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 169 && b === 254) return false
  return true
}

// Liczby w zdaniu ze słowem biznesowym ("marża 40%", "przychód: 1 234 567")
function maskFigures(text: string): string {
  const ranges: Array<[number, number]> = []
  for (const m of text.matchAll(FIN_WORD)) {
    const s = m.index ?? 0
    const e = s + m[0].length
    let a = Math.max(0, s - 30)
    let b = Math.min(text.length, e + 45)
    const before = text.slice(a, s)
    const stop = Math.max(before.lastIndexOf('\n'), before.lastIndexOf(';'), before.search(/[.!?]\s[^.!?]*$/))
    if (stop >= 0) a += stop + 1
    const after = text.slice(e, b)
    const end = after.search(/\n|;|[.!?](?:\s|$)/)
    if (end >= 0) b = e + end
    ranges.push([a, b])
  }
  if (!ranges.length) return text
  return text.replace(FIGURE, (fig: string, offset: number) => {
    if (/^(?:19|20)\d\d$/.test(fig)) return fig // rok
    return ranges.some(([a, b]) => offset >= a && offset < b) ? HIDE : fig
  })
}

// "/wzorzec/flagi" w konfiguracji to regex, wszystko inne to dosłowny tekst (bez rozróżniania wielkości liter)
function userPattern(item: string): RegExp | null {
  const m = item.match(/^\/(.+)\/([a-z]*)$/)
  try {
    if (m) return new RegExp(m[1] ?? '', [...new Set(((m[2] ?? '') + 'g').split(''))].join(''))
    return new RegExp(escapeRegExp(item), 'giu')
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- maskowanie

export type MaskerOptions = {
  strict?: boolean
  values?: string[] // wartości z .env: tylko w pamięci
  names?: string[]
  keepNames?: string[]
  hide?: string[]
  allow?: string[]
}

export type Masker = (text: string) => string

export function makeMasker(opts: MaskerOptions = {}): Masker {
  const strict = !!opts.strict
  const KEEP = keepSet(opts.keepNames ?? [])
  const values = (opts.values ?? []).filter((v) => v.length >= 6).sort((a, b) => b.length - a.length)
  const valueRe = values.length ? new RegExp(values.map(escapeRegExp).join('|'), 'g') : null
  const hideRes = (opts.hide ?? []).map(userPattern).filter((r): r is RegExp => r !== null)
  const allow = (opts.allow ?? []).filter((a) => a.trim()).sort((a, b) => b.length - a.length)
  const allowRe = allow.length ? new RegExp(allow.map(escapeRegExp).join('|'), 'giu') : null

  const plain = new Set<string>()
  const inflected = new Set<string>()
  let nameRe: RegExp | null = null
  let dirty = false
  const learn = (full: string, explicit = false) => {
    if (plain.size + inflected.size > 4000) return
    for (const f of nameForms(full, KEEP, explicit)) {
      const set = f.inflect ? inflected : plain
      if (!set.has(f.text)) {
        set.add(f.text)
        dirty = true
      }
    }
  }
  for (const n of opts.names ?? []) learn(n, true)
  const nameRegex = () => {
    if (dirty) {
      const alts: string[] = []
      for (const t of [...plain].sort((a, b) => b.length - a.length)) alts.push(plPattern(t))
      for (const t of [...inflected].sort((a, b) => b.length - a.length)) {
        const s = stem(t)
        alts.push(s.length >= 3 ? plPattern(s) + PL_SUFFIX : plPattern(t) + PL_SUFFIX)
        if (s !== t) alts.push(plPattern(t))
      }
      nameRe = alts.length
        ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alts.join('|')})(?:['’]s)?(?![\\p{L}\\p{N}_])`, 'gu')
        : null
      dirty = false
    }
    return nameRe
  }

  return function mask(text: string): string {
    if (typeof text !== 'string' || text.length === 0) return text
    let out = text

    // wyjątki: zamieniane na znaczniki z prywatnego obszaru Unicode, przywracane na końcu
    const kept: string[] = []
    if (allowRe) {
      out = out.replace(allowRe, (m) => {
        kept.push(m)
        return '\uE000' + String.fromCharCode(0xe100 + kept.length - 1) + '\uE001'
      })
    }

    if (valueRe) out = out.replace(valueRe, DOTS)
    for (const re of hideRes) out = out.replace(re, HIDE)
    for (const re of SECRET_PATTERNS) out = out.replace(re, DOTS)
    out = out.replace(URL_CREDENTIALS, (_m, head: string, _p: string, at: string) => head + DOTS + at)
    out = out.replace(ASSIGNMENT, (_m, name: string, sep: string) => name + sep + DOTS)
    out = out.replace(PIN, (_m, head: string) => head + '••••')

    // osoby: uczone z e-maili i pól kontaktowych, zanim e-maile znikną
    for (const m of out.matchAll(EMAIL)) {
      const n = namesFromEmail(m[0])
      if (n) learn(n)
    }
    out = out.replace(DISPLAY_NAME, (_m, q: string, name: string, addr: string) => {
      learn(name)
      return KEEP.has(name) ? q + name + q + addr : HIDE + addr
    })
    out = out.replace(PERSON_KEY, (_m, head: string, value: string, tail: string) => {
      learn(value)
      return head + (KEEP.has(value) ? value : HIDE) + tail
    })
    out = out.replace(PERSON_LINE, (line: string, label: string, value: string) =>
      KEEP.has(value.trim()) ? line : label + HIDE,
    )
    out = out.replace(EMAIL, '•••@•••')
    const re = nameRegex()
    if (re) out = out.replace(re, HIDE)

    // identyfikatory i numery kont: przed kwotami i telefonami, bo to też ciągi cyfr
    out = out.replace(ID_LABEL, (m: string, head: string, value: string) =>
      (value.match(/\d/g) ?? []).length >= 5 ? head + HIDE : m,
    )
    out = out.replace(IBAN, (m) => (validIban(m) || /^PL\d{2}(?: ?\d{4}){6}$/.test(m) ? HIDE : m))
    out = out.replace(NRB, (m) => (validIban('PL' + m) ? HIDE : m))
    out = out.replace(CARD, (m) => {
      const digits = m.replace(/\D/g, '')
      return digits.length >= 13 && digits.length <= 19 && luhn(digits) ? '•••• •••• •••• ••••' : m
    })
    out = out.replace(PESEL, (m) => (validPesel(m) ? '•••••••••••' : m))
    out = out.replace(NIP, (m) => (validNip(m) ? '•••-•••-••-••' : m))
    out = out.replace(NIP_PL_PREFIX, (m) => (validNip(m) ? 'PL••••••••••' : m))
    out = out.replace(SSN, '•••-••-••••')
    out = out.replace(EIN, '••-•••••••')
    out = out.replace(CARD_ENDING, (_m, head: string) => head + '••••')
    out = out.replace(BIRTH, (_m, head: string) => head + HIDE)

    // adresy
    out = out.replace(STREET_PL, HIDE)
    out = out.replace(STREET_EN, HIDE)
    out = out.replace(POSTAL_PL, '••-••• •••')
    out = out.replace(PO_BOX, HIDE)
    out = out.replace(SKRYTKA, HIDE)
    out = out.replace(STATE_ZIP, (_m, head: string) => head + ' •••••')

    // kwoty: przed telefonami, żeby "600 000 000 zł" było kwotą
    out = out.replace(MONEY_PRE, HIDE)
    out = out.replace(MONEY_POST, HIDE)

    // telefony
    out = out.replace(PHONE_LABEL, (_m, head: string) => head + '••• ••• •••')
    out = out.replace(PHONE_INTL, '+•• ••• ••• •••')
    out = out.replace(PHONE_US, '•••-•••-••••')
    out = out.replace(PHONE_PL, '••• ••• •••')
    out = out.replace(PHONE_PL_LANDLINE, '(••) ••• •• ••')
    out = out.replace(IPV4, (ip) => (publicIp(ip) ? '•••.•••.•••.•••' : ip))

    // liczby biznesowe
    if (strict) {
      out = out.replace(PERCENT, HIDE)
      out = out.replace(BIG_FIGURE, (m) => (/^(?:19|20)\d\d$/.test(m) ? m : HIDE))
    }
    out = maskFigures(out)

    if (kept.length) out = out.replace(/\uE000([\uE100-\uEFFF])\uE001/g, (_m, c: string) => kept[c.charCodeAt(0) - 0xe100] ?? '')
    return out
  }
}

// Wartości z plików .env: dość długie, by być sekretem, i nie zwykłe słowa czy liczby.
export function secretValuesFromEnv(text: string): string[] {
  const values: string[] = []
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = (m[1] ?? '').trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (v.length < 8) continue
    if (/^(true|false|null|none|yes|no)$/i.test(v)) continue
    if (/^\d+(\.\d+)?$/.test(v)) continue
    if (/^https?:\/\/[^@]*$/i.test(v)) continue // adres bez danych logowania
    if (/your[-_ ]?(key|token|secret)|here$|^<.*>$|^xxx|^changeme$/i.test(v)) continue
    values.push(v)
  }
  return [...new Set(values)].sort((a, b) => b.length - a.length)
}

// Maskuje każdy napis w zwykłych danych, zachowując kształt.
export function deepMask(value: unknown, mask: Masker, depth = 0): unknown {
  if (depth > 12) return value
  if (typeof value === 'string') return mask(value)
  if (Array.isArray(value)) return value.map((v) => deepMask(v, mask, depth + 1))
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) return value
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = deepMask(v, mask, depth + 1)
    return out
  }
  return value
}

// Wynik narzędzia biznesowego: czytelny tekst znika, krótkie znaczniki (type: 'text') zostają.
export function hideText(s: string): string {
  if (typeof s !== 'string' || s.length === 0) return s
  return s.length > 24 || /\s/.test(s) ? HIDDEN_OUTPUT : s
}

// ---------------------------------------------------------------- prywatne pliki

// Wbudowane prywatne ścieżki. Własne foldery i pliki: "privatePaths" w config.json.
const PRIVATE_PATHS: RegExp[] = [
  /(^|[\\/\s"'`=])\.env(?!\.(?:example|sample|template|dist|defaults)\b)(\.[A-Za-z0-9_-]+)?(?=$|[\s"'`;|&)<>])/i,
  /(^|[\\/\s"'`=])\.envrc(?=$|[\s"'`;|&)<>])/i,
  /\.credentials\.json/i,
  /\.git-credentials/i,
  /[\\/]\.claude\.json\b/i,
  /\.claude[\\/]projects[\\/][^\\/\s"'`]+[\\/]memory/i,
  /(^|[\\/\s"'`=~])\.(?:ssh|aws|gnupg|password-store|kube|docker)(?=$|[\\/\s"'`;|&)])/i,
  /\.config[\\/](?:gh|rclone|op|gcloud|doctl)(?=$|[\\/])/i,
  /\bid_(?:rsa|ed25519|ecdsa|dsa)\b/i,
  /(^|[\\/\s"'`=])\.(?:netrc|npmrc|pypirc|pgpass|my\.cnf)\b/i,
  /\.(?:pem|p12|pfx|key|kdbx|keystore|jks|asc|gpg)(?=$|[\s"'`;|&)<>])/i,
  /(^|[\\/\s"'`=_-])secrets?\.(?:json|ya?ml|toml|env|txt)\b/i,
]

// Słowa biznesowe to też zwykłe słowa ("echo budżet"), więc liczą się tylko w tokenach,
// które wyglądają na ścieżkę: zawierają / albo \ albo kończą się rozszerzeniem.
const BUSINESS_PATHS: RegExp[] = [
  /taxes?[-_]?20\d\d/i,
  /(?:^|[\\/_-])(?:payroll|invoices?|contracts?|financials?|finances?|budgets?|forecasts?|cap[-_ ]?table|term[-_ ]?sheets?|offer[-_ ]?letters?|business[-_ ]?plans?|faktur[ayi]?|umowy|umowa|wynagrodzeni[ae]|płace|place|lista[-_ ]?płac|budżet|budzet|biznesplan|zeznani[ae]|pit[-_ ]?\d{1,2}|kadry|ksiegowosc|księgowość)(?=$|[\\/._-])/i,
]

const looksLikePath = (tok: string) => /[\\/]/.test(tok) || /\.[\p{L}\d]{1,5}$/u.test(tok)

function businessPathHit(text: string): string | null {
  for (const tok of text.split(/[\s"'`;|&()<>=,]+/)) {
    if (!tok || !looksLikePath(tok)) continue
    for (const re of BUSINESS_PATHS) {
      const m = tok.match(re)
      if (m) return m[0].replace(/^[\\/_-]/, '')
    }
  }
  return null
}

// Nazwy, do których rozwija się glob w komendzie (cat .en*, cat ~/.ss?/id_*)
const CANONICAL_PRIVATE = ['.env', '.env.local', '.env.production', '.envrc', 'id_rsa', 'id_ed25519', '.netrc', '.npmrc', '.pypirc', '.pgpass', 'credentials.json', '.credentials.json', '.git-credentials', '.ssh', '.aws', '.gnupg', 'secrets.json', 'secret.yaml']

function globToRegExp(glob: string): RegExp | null {
  let src = ''
  for (const ch of glob) {
    if (ch === '*') src += '[^/]*'
    else if (ch === '?') src += '[^/]'
    else src += escapeRegExp(ch)
  }
  try {
    return new RegExp('^' + src + '$', 'i')
  } catch {
    return null
  }
}

function globHit(text: string): string | null {
  for (const raw of text.split(/[\s"'`;|&()<>=]+/)) {
    if (!/[*?[]/.test(raw)) continue
    for (const seg of raw.split('/')) {
      if (!/[*?[]/.test(seg) || seg.replace(/[*?[\]]/g, '').length < 2) continue
      const re = globToRegExp(seg.replace(/\[[^\]]*\]/g, '?'))
      const hit = re && CANONICAL_PRIVATE.find((n) => re.test(n))
      if (hit) return `${raw} (→ ${hit})`
    }
  }
  return null
}

export function privatePathHit(text: string, extra: string[] = [], allowPaths: string[] = []): string | null {
  let s = String(text || '')
  if (!s) return null
  for (const a of allowPaths) if (a.trim()) s = s.split(a.trim()).join(' ')
  for (const re of PRIVATE_PATHS) {
    const m = s.match(re)
    if (m) return m[0].trim().replace(/^["'`\\/_=-]/, '')
  }
  const biz = businessPathHit(s)
  if (biz) return biz
  const flat = s.replace(/\\/g, '/').toLowerCase()
  for (const item of extra) {
    const needle = String(item || '').replace(/\\/g, '/').toLowerCase().trim()
    if (needle && flat.includes(needle)) return String(item)
  }
  return globHit(s)
}

// Narzędzia, których argumenty to treść albo polecenia dla innych agentów, a nie ścieżki.
const NO_PATH_TOOLS = new Set(['Agent', 'Task', 'TodoWrite', 'AskUserQuestion', 'SendMessage', 'ExitPlanMode', 'EnterPlanMode', 'Skill', 'ToolSearch', 'WebSearch'])
const PATH_KEYS = ['file_path', 'path', 'notebook_path', 'command', 'cwd', 'url', 'glob']

// Napisy z argumentów wywołania, które mogą wskazywać plik albo nieść polecenie.
// Wbudowane narzędzia: tylko pola ze ścieżkami; MCP: wszystkie napisy (best effort).
export function toolCallTargets(e: Record<string, unknown>): string[] {
  const tool = String(e.tool ?? '')
  if (NO_PATH_TOOLS.has(tool)) return []
  const out: string[] = []
  if (tool.startsWith('mcp__')) {
    const walk = (v: unknown, depth: number) => {
      if (depth > 6) return
      if (typeof v === 'string') out.push(v)
      else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1))
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'tool' && k !== 'tool_use_id' && k !== 'agentId') walk(x, depth + 1)
    }
    walk(e, 0)
    return out
  }
  for (const k of PATH_KEYS) if (typeof e[k] === 'string') out.push(e[k] as string)
  if (tool === 'Glob' && typeof e.pattern === 'string') out.push(e.pattern)
  return out
}

// Pola, które warto rozwiązać przez realpath (dowiązania symboliczne, ../, ścieżki względne)
export function toolCallPaths(e: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const k of ['file_path', 'path', 'notebook_path']) if (typeof e[k] === 'string' && e[k]) out.push(e[k] as string)
  return out
}

// ---------------------------------------------------------------- narzędzia biznesowe

const BUSINESS_TOOL =
  /(?:^|__|_)(?:clickup|slack|gmail|outlook|notion|asana|linear|jira|clay|qbo|quickbooks|xero|fireflies|hubspot|salesforce|pipedrive|stripe|calendar|gcal|google_drive|drive|sheets|fakturownia|ifirma|wfirma|infakt|ksef)|search_threads|get_thread|get_message|list_drafts|get_draft|read_file_content|download_file_content|search_files|list_recent_files|get_file_metadata|profit_loss|cash_flow|balance_sheet|payroll|session_transcripts|export_transcript/i
const BUSINESS_COMMAND = /\bgws(?:\.cmd|\.exe)?\b|fireflies|quickbooks/i
const FINANCE_TOOL = /__(?:qbo_|quickbooks|profit_loss|cash_flow|balance_sheet|benchmarking_quickbooks|money_onboarding|company_info)/i

export function businessSource(tool: unknown, input: unknown, extra: string[] = []): boolean {
  const name = String(tool || '')
  if (BUSINESS_TOOL.test(name)) return true
  const command = input && typeof input === 'object' && typeof (input as Record<string, unknown>).command === 'string' ? ((input as Record<string, unknown>).command as string) : ''
  const hay = (name + ' ' + command).toLowerCase()
  if (extra.some((x) => x && hay.includes(String(x).toLowerCase()))) return true
  return command ? BUSINESS_COMMAND.test(command) : false
}

export function closedTool(tool: unknown, extra: string[] = []): boolean {
  const name = String(tool || '')
  return FINANCE_TOOL.test(name) || extra.some((x) => x && name.toLowerCase().includes(String(x).toLowerCase()))
}
