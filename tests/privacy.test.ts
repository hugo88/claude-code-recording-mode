// Wszystkie dane poniżej są fikcyjne (przykładowe numery z poprawnymi sumami kontrolnymi).
import { describe, expect, test } from 'claude-code/testing'

import { makeMasker, privatePathHit, secretValuesFromEnv, toolCallTargets, validIban, validNip, validPesel } from '../hooks/privacy'

const mask = makeMasker({ names: ['Jan Kowalski', 'Anna Nowak'], keepNames: ['Piotr Testowy'], hide: ['Projekt Kormoran', '/ZLEC-\\d+/'], allow: ['biuro@example.com'] })
const strict = makeMasker({ strict: true })

function hidden(text: string, secret: string, m = mask) {
  const out = m(text)
  expect(out.includes(secret)).toBe(false)
  return out
}

describe('sekrety', () => {
  test('klucze API i tokeny', () => {
    hidden('ANTHROPIC_API_KEY=sk-ant-api03-FAKEfakeFAKEfake1234567890', 'FAKEfakeFAKEfake')
    hidden('token ghp_FAKE0000000000000000000000000000', 'ghp_FAKE')
    hidden('Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345', 'abcdefghijklmnop')
    hidden('postgres://admin:SuperTajne123@db.example.com/app', 'SuperTajne123')
    hidden('hasło: Kot!Ala2024', 'Kot!Ala2024')
    hidden('"password": "nieZgadniesz99"', 'nieZgadniesz99')
    hidden('-----BEGIN OPENSSH PRIVATE KEY-----\nAAAAfake\n-----END OPENSSH PRIVATE KEY-----', 'AAAAfake')
  })

  test('wartości z .env są maskowane dosłownie', () => {
    const values = secretValuesFromEnv('DB_URL=postgres://u:p@h/db\nPORT=8080\nWEIRD=qwertyuiop-zxcv\nDEBUG=true')
    expect(values).toContain('qwertyuiop-zxcv')
    expect(values).not.toContain('8080')
    hidden('wartość qwertyuiop-zxcv w logu', 'qwertyuiop-zxcv', makeMasker({ values }))
  })
})

describe('dane osobowe (PL)', () => {
  test('walidatory', () => {
    expect(validPesel('44051401359')).toBe(true)
    expect(validPesel('44051401358')).toBe(false)
    expect(validNip('123-456-32-18')).toBe(true)
    expect(validNip('1234567890')).toBe(false)
    expect(validIban('PL61 1090 1014 0000 0712 1981 2874')).toBe(true)
  })

  test('PESEL, NIP, IBAN, NRB, karta', () => {
    hidden('PESEL 44051401359', '44051401359')
    hidden('klient 02070803628 zapisany', '02070803628')
    hidden('NIP: 123-456-32-18', '456-32')
    hidden('NIP PL5260250274', '5260250274')
    hidden('konto PL61 1090 1014 0000 0712 1981 2874', '1981 2874')
    hidden('przelew na 61 1090 1014 0000 0712 1981 2874', '1981 2874')
    hidden('karta 4111 1111 1111 1111', '1111 1111')
    hidden('nr dowodu ABC123456', 'ABC123456')
    // liczba bez poprawnej sumy kontrolnej zostaje
    expect(mask('id 90010112345')).toContain('90010112345')
  })

  test('telefony', () => {
    hidden('tel. +48 600 100 200', '600 100 200')
    hidden('dzwoń 600-100-200', '600-100-200')
    hidden('biuro (22) 123 45 67', '123 45 67')
    hidden('telefon: 501234567', '501234567')
    hidden('call +1 415 555 0100', '555 0100')
  })

  test('e-maile, nazwiska i odmiana', () => {
    hidden('Napisz do jan.kowalski@example.com', 'kowalski@example')
    const out = hidden('Spotkanie z Janem Kowalskim i Anną Nowak. Kowalskiego nie było.', 'Kowalsk')
    expect(out.includes('Now')).toBe(false)
    expect(out.includes('Ann')).toBe(false)
    // nazwisko wyuczone z adresu e-mail
    const m = makeMasker()
    hidden('Od: zofia.wisniewska@example.org', 'wisniewska', m)
    hidden('Rozmawiałem z Zofią Wiśniewską', 'Wiśniewsk', m)
    // własne imię zostaje
    expect(mask('Nagrywa Piotr Testowy')).toContain('Piotr Testowy')
    // wyjątek nie jest maskowany
    expect(mask('Pisz na biuro@example.com')).toContain('biuro@example.com')
  })

  test('adresy i etykiety', () => {
    hidden('Adres: ul. Przykładowa 12/3, 00-950 Warszawa', 'Przykładowa')
    hidden('mieszka przy al. Jerozolimskie 123A m. 4', 'Jerozolimskie')
    hidden('wysyłka: 31-123 Kraków', 'Kraków')
    hidden('Imię i nazwisko: Tomasz Zieliński', 'Zieliński')
    hidden('data urodzenia: 14.05.1944', '14.05.1944')
    hidden('Ships to 1600 Example Avenue, Springfield', 'Example Avenue')
  })

  test('etykiety nie przechodzą do następnej linii (regresja z CLI)', () => {
    const text = 'PESEL 44051401359, NIP 123-456-32-18\nKonto PL61 1090 1014 0000 0712 1981 2874\nul. Przykładowa 12/3, 00-950 Warszawa\nFaktura: 12 345,67 zł'
    const out = mask(text)
    expect(out.split('\n').length).toBe(4)
    expect(out.includes('1981')).toBe(false)
    expect(out.includes('Warszawa')).toBe(false)
    expect(out).toContain('Faktura:')
  })

  test('etykiety w komórkach tabeli markdown', () => {
    const out = hidden('| Zadanie | Osoba |\n|---|---|\n| backup | Owner: Tomasz Zieliński |', 'Zieliński')
    expect(out).toContain('| Owner: ••• |')
    expect(out).toContain('| Zadanie | Osoba |')
  })

  test('wartości z konfiguracji (tekst i regex)', () => {
    hidden('Status Projekt Kormoran: zielony', 'Kormoran')
    hidden('zlecenie ZLEC-4821 gotowe', 'ZLEC-4821')
  })
})

describe('kwoty', () => {
  test('PLN, zł i inne waluty, przecinki dziesiętne, spacje w liczbach', () => {
    hidden('Do zapłaty 12 345,67 zł', '12 345,67')
    hidden('Saldo: 1.234,56 PLN', '1.234,56')
    hidden('kwota PLN 999,00', '999,00')
    hidden('budżet 250 tys. zł', '250')
    hidden('wycena 3,5 mln PLN', '3,5')
    hidden('price $1,234.56', '1,234.56')
    hidden('kosztuje €1 250', '1 250')
    hidden('to 99 USD miesięcznie', '99 USD')
    hidden('100 złotych', '100')
    hidden('1 200,- zł', '1 200')
    hidden('£40k ARR', '40k')
  })

  test('liczby obok słów biznesowych', () => {
    hidden('Przychód w tym miesiącu: 84 000', '84 000')
    hidden('marża 40%', '40%')
    hidden('MRR is 84k', '84k')
  })

  test('zwykłe liczby zostają poza trybem strict', () => {
    expect(mask('Mam 3 pliki i 1 250 linii, wzrost 12,5%')).toContain('1 250')
    expect(mask('wzrost 12,5%')).toContain('12,5%')
    expect(mask('w roku 2024 zrobiliśmy 15 commitów')).toContain('2024')
    expect(mask('port 8080 na localhost')).toContain('8080')
  })

  test('strict maskuje procenty i duże liczby', () => {
    hidden('wzrost 12,5%', '12,5', strict)
    hidden('konwersja 15 proc.', '15', strict)
    hidden('mamy 1 250 000 użytkowników', '1 250 000', strict)
    hidden('rekordów: 48213', '48213', strict)
    hidden('ok. 2,5 mln odsłon', '2,5', strict)
    expect(strict('w roku 2024')).toContain('2024')
    expect(strict('sha a1b2c3d4e5f6')).toContain('a1b2c3d4e5f6')
  })
})

describe('prywatne ścieżki', () => {
  test('wbudowane', () => {
    expect(privatePathHit('/home/u/proj/.env')).not.toBeNull()
    expect(privatePathHit('cat .env.local')).not.toBeNull()
    expect(privatePathHit('cat ~/.ssh/id_ed25519')).not.toBeNull()
    expect(privatePathHit('/home/u/firma/faktury/2024-01.pdf')).not.toBeNull()
    expect(privatePathHit('cp .env.example .env.test')).not.toBeNull()
    expect(privatePathHit('cat .env.example')).toBeNull()
    expect(privatePathHit('ls src/components')).toBeNull()
  })

  test('słowa biznesowe tylko jako ścieżka', () => {
    expect(privatePathHit('cat ~/docs/budżet.xlsx')).not.toBeNull()
    expect(privatePathHit('open budżet.xlsx')).not.toBeNull()
    expect(privatePathHit('ls faktury/')).not.toBeNull()
    expect(privatePathHit('cat payroll_2026.csv')).not.toBeNull()
    expect(privatePathHit('cp taxes-2024.pdf /tmp')).not.toBeNull()
    expect(privatePathHit('print("Pensja brutto, budżet projektu 250 000 zł")')).toBeNull()
    expect(privatePathHit('echo "faktury i umowy" | wc -w')).toBeNull()
    expect(privatePathHit('git commit -m "Poprawka budżetu."')).toBeNull()
    expect(privatePathHit('echo taxes 2024')).toBeNull()
  })

  test('glob w komendzie', () => {
    expect(privatePathHit('cat .en*')).not.toBeNull()
    expect(privatePathHit('head ~/.ss?/id_*')).not.toBeNull()
    expect(privatePathHit('ls *.ts')).toBeNull()
  })

  test('własne ścieżki i wyjątki', () => {
    expect(privatePathHit('/home/u/Klienci/umowa.txt', ['klienci/'])).not.toBeNull()
    expect(privatePathHit('src/contracts/Token.sol')).not.toBeNull()
    expect(privatePathHit('src/contracts/Token.sol', [], ['src/contracts/'])).toBeNull()
  })

  test('argumenty narzędzi: ścieżki, nie treść', () => {
    expect(toolCallTargets({ tool: 'Write', file_path: 'README.md', content: 'skopiuj .env' })).toEqual(['README.md'])
    expect(toolCallTargets({ tool: 'Agent', prompt: 'przeczytaj .env' })).toEqual([])
    expect(toolCallTargets({ tool: 'mcp__srv__exec', srv: 'x', cmd: 'cat .env' })).toContain('cat .env')
  })
})
