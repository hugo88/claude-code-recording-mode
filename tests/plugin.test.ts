// Hooki moda na silniku testowym; system plików i środowisko z pamięci, dane fikcyjne.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const HOME = '/home/test'
const CWD = HOME + '/proj'

function world(on: On, files: Record<string, string>, links: Record<string, string> = {}) {
  mock.env(on, { HOME })
  mock.clock(on, { now: 1_000 })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))
  // dno renderu: wiersz rysuje tekst, który dostał
  on('ui.render', (_$, e) => ({ type: 'Text', props: {}, children: [JSON.stringify(e.props)] }) as never)
  on('session.cwd', () => ({ value: CWD }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const abs = (p: string) => (p.startsWith('/') ? p : CWD + '/' + p)
  on('fs.exists', (_$, e) => ({ value: abs(e.path) in files }))
  on('fs.read', (_$, e) => {
    const p = abs(e.path)
    if (!(p in files)) throw new Error('ENOENT ' + p)
    return { value: files[p] ?? '' }
  })
  on('fs.write', (_$, e) => {
    files[abs(e.path)] = e.text
    return { value: undefined }
  })
  on('fs.stat', (_$, e) => {
    const p = abs(e.path)
    const real = links[p] ?? p
    if (!(real in files)) throw new Error('ENOENT ' + p)
    return { value: { kind: 'file' as const, size: 1, mtimeMs: 0, isLink: p in links, ...(e.resolve ? { realPath: real } : {}) } }
  })
  return files
}

const rec = ($: Engine, args: string) => $.command.run({ command: 'rec', args } as never)

const STATE = HOME + '/.claude/mods-data/recording-mode/state.json'

test('/rec on | strict | off zapisuje stan dla statusline i innych sesji', async ($, on) => {
  const files = world(on, {})
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  await rec($, 'on')
  expect(JSON.parse(files[STATE] ?? '{}').mode).toBe('on')
  await rec($, 'strict')
  expect(JSON.parse(files[STATE] ?? '{}').mode).toBe('strict')
  await rec($, 'off')
  expect(JSON.parse(files[STATE] ?? '{}').mode).toBe('off')
})

test('blokuje .env, dowiązanie do .env, glob i własne ścieżki; reszta przechodzi', async ($, on) => {
  world(
    on,
    {
      [CWD + '/.env']: 'API_KEY=fake-value-123456',
      [CWD + '/src/app.ts']: 'x',
      [HOME + '/.claude/mods-data/recording-mode/config.json']: JSON.stringify({ privatePaths: ['klienci/'] }),
    },
    { [CWD + '/notes.txt']: CWD + '/.env' },
  )
  on('tool.call', () => ({ result: { ok: true } }))
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  await rec($, 'on')

  const denied = async (input: Record<string, unknown>) => {
    const r = (await $.tool.call(input as never)) as { deny?: string }
    return /Recording mode is on/.test(r.deny ?? '')
  }
  expect(await denied({ tool: 'Read', file_path: CWD + '/.env' })).toBe(true)
  expect(await denied({ tool: 'Read', file_path: 'notes.txt' })).toBe(true)
  expect(await denied({ tool: 'Bash', command: 'cat .en*' })).toBe(true)
  expect(await denied({ tool: 'Bash', command: 'ls ~/firma/Klienci/' })).toBe(true)
  expect(await denied({ tool: 'Read', file_path: CWD + '/src/app.ts' })).toBe(false)

  await rec($, 'off')
  expect(await denied({ tool: 'Read', file_path: CWD + '/.env' })).toBe(false)
})

test('config.json zapisany w trakcie nagrywania działa od następnego wywołania, bez timera', async ($, on) => {
  const files = world(on, {})
  on('tool.call', () => ({ result: { ok: true } }))
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  await rec($, 'on')
  const denied = async (command: string) => {
    const r = (await $.tool.call({ tool: 'Bash', command } as never)) as { deny?: string }
    return /Recording mode is on/.test(r.deny ?? '')
  }
  expect(await denied('cd faktury')).toBe(false)
  files[HOME + '/.claude/mods-data/recording-mode/config.json'] = JSON.stringify({ privatePaths: ['faktury'] })
  expect(await denied('cd faktury')).toBe(true)
})

test('maskuje wiersze tylko przy włączonym trybie; wskaźnik w stopce', async ($, on) => {
  world(on, {})
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  const msg = { text: 'Jan: tel. +48 600 100 200, PESEL 44051401359, 12 345,67 zł', isFirstOfReply: true }

  let ui = await $.ui.mount({ plugin: 'recording-mode', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(await ui.find({ type: 'Text', text: '○ REC OFF' })).toBeDefined()
  await ui.unmount()

  await rec($, 'on')
  ui = await $.ui.mount({ plugin: 'recording-mode', surface: 'terminal', component: 'SessionMode', props: { modes: ['focus'] } })
  expect(await ui.find({ type: 'Text', text: '● REC ON' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /focus/ })).toBeDefined()
  await ui.unmount()

  const shown = JSON.stringify(await $.ui.render({ component: 'AssistantMessage', surface: 'terminal', requestId: 'm1', props: msg } as never))
  expect(shown.includes('600 100 200')).toBe(false)
  expect(shown.includes('44051401359')).toBe(false)
  expect(shown.includes('12 345,67')).toBe(false)

  await rec($, 'strict')
  const desk = await $.ui.mount({ plugin: 'recording-mode', surface: 'desktop', component: 'SessionMode', props: { modes: [] } })
  expect(await desk.find({ type: 'Text', text: '● REC STRICT' })).toBeDefined()
  await desk.unmount()
})

test('nazwisko wyuczone z e-maila maskuje też tekst narysowany wcześniej (bez starego cache)', async ($, on) => {
  world(on, {})
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  await rec($, 'on')
  const draw = async (text: string) =>
    JSON.stringify(await $.ui.render({ component: 'AssistantMessage', surface: 'terminal', requestId: 'm', props: { text, isFirstOfReply: true } } as never))
  const before = 'Rozmawiałem z Zofią Wiśniewską'
  expect(await draw(before)).toContain('Wiśniewsk') // jeszcze nieznana
  await draw('Od: zofia.wisniewska@example.org')
  expect(await draw(before)).not.toContain('Wiśniewsk')
})

test('zwinięta grupa narzędzi rozwija się podczas nagrywania, żeby jej wiersze przeszły przez maskowanie ToolUse', async ($, on) => {
  world(on, {})
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  const calls = [{ tool: 'Grep', input: { pattern: 'jan.kowalski@example.com' }, isRunning: false, isErrored: false, isInterrupted: false }]
  const group = async () =>
    JSON.parse(JSON.parse(JSON.stringify(await $.ui.render({ component: 'ToolGroup', surface: 'terminal', requestId: 'g', props: { calls, isActive: false, isExpanded: false } } as never))).children[0])
  expect((await group()).isExpanded).toBe(false)
  await rec($, 'on')
  expect((await group()).isExpanded).toBe(true)
})
