// Recording Mode: /rec przed włączeniem nagrywania ekranu.
// Gdy jest włączony (we wszystkich sesjach Claude Code na tym komputerze):
// - klucze, wartości z .env, e-maile, nazwiska, telefony, adresy, PESEL, NIP, IBAN,
//   karty i kwoty są maskowane wszędzie, gdzie transkrypt rysuje tekst,
// - wyniki narzędzi biznesowych (poczta, czat, zadania, kalendarz, finanse) są ukryte,
// - Claude nie może otwierać prywatnych plików ani zamkniętych narzędzi,
// - stopka przy polu wpisywania i statusline pokazują ● REC ON / ● REC STRICT / ○ REC OFF.
// Maskowanie dotyczy tylko wyświetlania: kontekst modelu i historia sesji zostają nietknięte.
// Mod nie wysyła niczego poza komputer: używa tylko $.fs, $.env, $.clock i $.ui.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { RecMode } from '../types'
import {
  EMPTY_CONFIG,
  businessSource,
  closedTool,
  deepMask,
  hideText,
  makeMasker,
  privatePathHit,
  secretValuesFromEnv,
  toolCallPaths,
  toolCallTargets,
} from './privacy'
import type { Masker, RecConfig } from './privacy'

const modeAtom = atom({ plugin: 'recording-mode', key: 'mode' } as const, 'off' as RecMode)
const configVersion = atom({ plugin: 'recording-mode', key: 'configVersion' } as const, 0)

const DATA_DIR = '/.claude/mods-data/recording-mode'
const STATE_FILE = DATA_DIR + '/state.json' // czyta go też ~/.claude/statusline.sh
const CONFIG_FILE = DATA_DIR + '/config.json'

const REC_RED = '#e5484d'
const LABEL: Record<RecMode, string> = { on: '● REC ON', strict: '● REC STRICT', off: '○ REC OFF' }

const CONFIG_TEMPLATE = {
  _opis: [
    'keepNames: Twoje imię i nazwisko / marka: widoczne także podczas nagrywania.',
    'names: osoby zawsze maskowane (odmiana: Kowalski → Kowalskiego, Anna → Annie). Nietypową odmianę (Marek → Marka) dopisz osobno.',
    'hide: dowolne teksty do ukrycia; "/wzorzec/flagi" to wyrażenie regularne.',
    'allow: wyjątki: teksty, których nigdy nie maskować (np. publiczny adres firmy).',
    'privatePaths: fragmenty ścieżek, których Claude nie otworzy podczas nagrywania (bez rozróżniania wielkości liter).',
    'allowPaths: fragmenty ścieżek zwolnione z wbudowanej blokady (np. "contracts/" w projekcie Solidity).',
    'businessTools: fragmenty nazw narzędzi / komend, których wyniki są ukrywane w całości.',
    'closedTools: fragmenty nazw narzędzi, których Claude nie może wywołać podczas nagrywania.',
    'noteToClaude: true dodaje do każdego promptu notkę, by Claude sam unikał danych wrażliwych w odpowiedziach.',
    'Po zapisaniu pliku zmiany wczytują się same w ciągu kilku sekund (albo /rec config).',
  ],
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

function strings(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()).slice(0, 500)
    : []
}

function parentDirs(path: string, levels: number): string[] {
  const parts = String(path || '').split('/')
  const out: string[] = []
  for (let i = parts.length; i > 0 && out.length <= levels; i--) out.push(parts.slice(0, i).join('/'))
  return out.filter(Boolean)
}

function noteOn(config: RecConfig): string {
  const keep = config.keepNames.length ? ` (poza: ${config.keepNames.join(', ')})` : ''
  return (
    `Recording mode is on: the screen is being recorded for a public video. In replies and tool commands, leave out people's names${keep}, emails, phone numbers, addresses, PESEL/NIP/account numbers, amounts of money and business figures. ` +
    'Use placeholders like [name] or [amount]. Private files stay closed until recording stops.'
  )
}
const NOTE_OFF = 'Recording mode is off now. The earlier recording-mode note no longer applies.'

// Stan modułu: przeładowanie zaczyna go od nowa; tryb trzyma atom i plik stanu.
let home = ''
let cwd = ''
let mode: RecMode = 'off'
let config: RecConfig = { ...EMPTY_CONFIG }
let configRaw = ''
let envValues: string[] = []
let mask: Masker = (s) => s // makeMasker sam trzyma cache wyników
let blocked = 0
let noteSent = false
const businessCalls = new Set<string>()

const masked = (s: string): string => mask(s)

function rebuild() {
  mask =
    mode === 'off'
      ? (s) => s
      : makeMasker({
          strict: mode === 'strict',
          values: envValues,
          names: config.names,
          keepNames: config.keepNames,
          hide: config.hide,
          allow: config.allow,
        })
}

async function loadConfig($: EngineInterface): Promise<boolean> {
  try {
    const path = home + CONFIG_FILE
    const raw = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
    if (raw === configRaw) return false
    configRaw = raw
    const j = raw ? JSON.parse(raw) : {}
    config = {
      keepNames: strings(j.keepNames),
      names: strings(j.names),
      hide: strings(j.hide),
      allow: strings(j.allow),
      privatePaths: strings(j.privatePaths),
      allowPaths: strings(j.allowPaths),
      businessTools: strings(j.businessTools),
      closedTools: strings(j.closedTools),
      noteToClaude: j.noteToClaude === true,
    }
    return true
  } catch {
    return false // uszkodzony plik: zostaje poprzednia konfiguracja, reguły wbudowane działają
  }
}

async function loadEnvValues($: EngineInterface) {
  const found: string[] = []
  for (const dir of parentDirs(cwd, 3)) {
    for (const name of ['.env', '.env.local', '.env.development', '.env.production']) {
      const p = dir + '/' + name
      try {
        if (await $.fs.exists(p)) found.push(...secretValuesFromEnv(await $.fs.read(p)))
      } catch {
        // nieczytelny: wzorce i tak łapią typowe formaty kluczy
      }
    }
  }
  envValues = [...new Set(found)] // tylko w pamięci, nigdzie nie zapisywane
}

async function readStateFile($: EngineInterface): Promise<RecMode> {
  try {
    const path = home + STATE_FILE
    if (!(await $.fs.exists(path))) return 'off'
    const j = JSON.parse(await $.fs.read(path))
    return j.mode === 'on' || j.mode === 'strict' ? j.mode : 'off'
  } catch {
    return 'off'
  }
}

async function applyMode($: EngineInterface, next: RecMode) {
  const was = mode
  mode = next
  if (mode !== 'off' && was === 'off') await loadEnvValues($)
  if (mode === 'off') {
    envValues = []
    businessCalls.clear()
  }
  rebuild()
  await update($, modeAtom, () => mode) // przerysowuje wiersze i wskaźnik od razu
}

// Inna sesja mogła zmienić tryb albo ktoś zapisał config.json
async function sync($: EngineInterface) {
  const fileMode = await readStateFile($)
  if (fileMode !== mode) await applyMode($, fileMode)
  await freshConfig($)
}

// Hooki, które decydują (blokada, notka), czytają config.json same: nie zależą od timera z sync()
async function freshConfig($: EngineInterface) {
  if (await loadConfig($)) {
    rebuild()
    await update($, configVersion, (n) => (n ?? 0) + 1)
  }
}

async function setMode($: EngineInterface, next: RecMode) {
  await $.fs.write(home + STATE_FILE, JSON.stringify({ mode: next, since: await $.clock.now() }) + '\n')
  await loadConfig($)
  await applyMode($, next)
}

async function configText($: EngineInterface): Promise<string> {
  const path = home + CONFIG_FILE
  let made = false
  try {
    if (!(await $.fs.exists(path))) {
      await $.fs.write(path, JSON.stringify(CONFIG_TEMPLATE, null, 2) + '\n')
      made = true
    }
  } catch {
    return `Nie udało się zapisać ${path}. Utwórz go ręcznie:\n${JSON.stringify(CONFIG_TEMPLATE, null, 2)}`
  }
  configRaw = ''
  await loadConfig($)
  rebuild()
  await update($, configVersion, (n) => (n ?? 0) + 1)
  return [
    `${made ? 'Utworzono' : 'Konfiguracja'}: ${path}`,
    `Wczytano: ${config.keepNames.length} widocznych nazwisk, ${config.names.length} ukrywanych, ${config.hide.length} wartości do ukrycia, ${config.allow.length} wyjątków, ${config.privatePaths.length} prywatnych ścieżek, ${config.businessTools.length} narzędzi biznesowych, ${config.closedTools.length} zamkniętych narzędzi; notka dla Claude’a: ${config.noteToClaude ? 'tak' : 'nie'}.`,
    'Opis pól jest w kluczu "_opis" w pliku. Edytuj plik przy wyłączonym nagrywaniu: jego treść nie jest maskowana w edytorze.',
  ].join('\n')
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    home = (await $.env.get('HOME')) || ''
    cwd = await $.session.cwd()
    await $.command.register({
      name: 'rec',
      description: 'Tryb nagrywania: maskuje sekrety, dane osobowe i kwoty na ekranie (/rec on | strict | off | config)',
      argumentHint: '[on|strict|off|config]',
      immediate: true,
    })
    await loadConfig($)
    mode = 'off'
    await applyMode($, await readStateFile($))
    $.clock.every(2000, () => {
      sync($).catch(() => {})
    })
    return next(e)
  })

  on('command.run', { command: 'rec' }, async ($, e) => {
    const arg = String(e.args || '').trim().toLowerCase()
    if (arg === 'config' || arg === 'konfiguracja') return { text: await configText($) }
    if (arg === 'off' || arg === 'wyłącz' || arg === 'wylacz') {
      await setMode($, 'off')
      $.ui.toast('○ REC OFF: maskowanie wyłączone.' + (blocked ? ` Zablokowano ${blocked} prób dostępu do prywatnych plików.` : ''))
      blocked = 0
      return {}
    }
    if (arg === 'on' || arg === 'włącz' || arg === 'wlacz' || arg === 'strict') {
      const next: RecMode = arg === 'strict' ? 'strict' : 'on'
      await setMode($, next)
      $.ui.toast(next === 'strict' ? '● REC STRICT: maskowanie rozszerzone (procenty i duże liczby).' : '● REC ON: maskowanie włączone.', { timeoutMs: 3000 })
      return {}
    }
    return {
      text: [
        `Stan: ${LABEL[mode]}`,
        '/rec on: maskowanie sekretów, danych osobowych i kwot; blokada prywatnych plików',
        '/rec strict: jak on, plus wszystkie procenty i duże liczby',
        '/rec off: wyłącza',
        '/rec config: tworzy / pokazuje plik konfiguracji',
      ].join('\n'),
    }
  })

  // Notka dla Claude’a: tylko gdy włączona w konfiguracji (domyślnie nie, żeby nie zmieniać kontekstu)
  on('prompt.submit', async ($, e, next) => {
    await freshConfig($)
    const note = mode !== 'off' && config.noteToClaude ? noteOn(config) : noteSent ? NOTE_OFF : null
    if (!note) return next(e)
    noteSent = mode !== 'off' && config.noteToClaude
    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  // Prywatne pliki i zamknięte narzędzia: odmowa, zanim narzędzie ruszy
  on('tool.call', async ($, e, next) => {
    if (mode === 'off') return next(e)
    await freshConfig($)
    const args = e as unknown as Record<string, unknown>
    let hit: string | null = closedTool(e.tool, config.closedTools) ? `narzędzie ${e.tool}` : null
    if (!hit) hit = privatePathHit(toolCallTargets(args).join('\n'), config.privatePaths, config.allowPaths)
    if (!hit) {
      // dowiązania symboliczne, ../ i ścieżki względne: sprawdzamy, dokąd ścieżka naprawdę prowadzi
      for (const p of toolCallPaths(args)) {
        const full = p.startsWith('/') ? p : p.startsWith('~/') ? home + p.slice(1) : cwd + '/' + p
        const stat = await $.fs.stat(full, { resolve: true }).catch(() => undefined)
        const real = stat?.realPath
        if (real && real !== full) {
          const realHit = privatePathHit(real, config.privatePaths, config.allowPaths)
          if (realHit) {
            hit = `${realHit} (przez dowiązanie lub ścieżkę względną)`
            break
          }
        }
      }
    }
    if (hit) {
      blocked += 1
      return {
        deny: `Recording mode is on, so "${hit}" stays closed while the screen is being recorded. Continue without it, or ask the user to run /rec off first.`,
      }
    }
    if (businessSource(e.tool, args, config.businessTools)) businessCalls.add(e.tool_use_id)
    return next(e)
  })

  // Wiersze tekstowe: prompty, odpowiedzi, wyjście komend
  on('ui.render', { component: ['UserMessage', 'AssistantMessage', 'CommandOutput'] }, async ($, e, next) => {
    const m = await read($, modeAtom)
    await read($, configVersion)
    if (m === 'off' || typeof e.props.text !== 'string') return next(e)
    return next({ ...e, props: { ...e.props, text: masked(e.props.text) } } as typeof e)
  })

  // Wiersz narzędzia: argumenty maskowane; wynik narzędzia biznesowego ukryty w całości
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const m = await read($, modeAtom)
    await read($, configVersion)
    if (m === 'off') return next(e)
    const business = businessSource(e.props.tool, e.props.input, config.businessTools) || businessCalls.has(e.props.tool_use_id)
    if (business) businessCalls.add(e.props.tool_use_id)
    const props = { ...e.props, input: deepMask(e.props.input, masked) }
    if (e.props.output !== undefined) props.output = deepMask(e.props.output, business ? hideText : masked)
    return next({ ...e, props })
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const m = await read($, modeAtom)
    await read($, configVersion)
    if (m === 'off') return next(e)
    const business = businessSource(e.props.tool, null, config.businessTools) || businessCalls.has(e.props.tool_use_id)
    return next({ ...e, props: { ...e.props, output: deepMask(e.props.output, business ? hideText : masked) } })
  })

  // Pytania Claude’a (AskUserQuestion) też mogą zawierać dane
  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const m = await read($, modeAtom)
    if (m === 'off') return next(e)
    return next({ ...e, props: { ...e.props, questions: deepMask(e.props.questions, masked) as unknown[] } })
  })

  // Wskaźnik w stopce przy polu wpisywania: widoczny zawsze, także w trakcie pracy Claude’a
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const m = await read($, modeAtom)
    const { Box, Text } = $.ui.resolve(e)
    const modes = Array.isArray(e.props.modes) ? e.props.modes : []
    return (
      <Box flexDirection="row">
        {m === 'off' ? <Text color="gray">{LABEL.off}</Text> : <Text color={REC_RED} bold>{LABEL[m]}</Text>}
        {modes.length > 0 ? <Text dimColor>{' · ' + modes.join(' & ')}</Text> : null}
      </Box>
    )
  })
}
