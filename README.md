# recording-mode

Mod do [Claude Code](https://claude.com/claude-code): `/rec on` przed nagrywaniem ekranu. Maskuje sekrety, dane osobowe i kwoty w tym, co widać w terminalu, i nie pozwala Claude'owi otwierać prywatnych plików, dopóki nagrywasz.

*English summary below.*

## Użycie

| Komenda | Co robi |
|---|---|
| `/rec` | Pokazuje bieżący tryb i pomoc |
| `/rec on` | Włącza tryb nagrywania |
| `/rec strict` | Jak `on`, plus maskowanie procentów i wszystkich większych liczb |
| `/rec off` | Wyłącza tryb; pokazuje, ile prób dostępu do prywatnych plików zablokowano |
| `/rec config` | Tworzy / wczytuje plik konfiguracji (patrz niżej) |

Tryb jest wspólny dla wszystkich sesji Claude Code i przetrwa restart, więc wyłącz go po nagraniu.

## Co robi

Przy włączonym trybie (`/rec on`):

- **Maskuje na ekranie** wiersze narzędzi, wyniki i odpowiedzi Claude'a:
  - klucze API, tokeny, hasła, wartości z `.env` (czytane do pamięci, nigdzie nie zapisywane);
  - e-maile, telefony, PESEL, NIP, IBAN / NRB (z weryfikacją sum kontrolnych, więc zwykłe liczby zostają);
  - nazwiska z odmianą (Kowalski → Kowalskiego), także wyciągnięte z adresów e-mail;
  - kwoty i liczby przy słowach biznesowych (przychód, pensja, faktura, budżet…).
- **Zamyka prywatne pliki**: `.env`, `~/.ssh`, `~/.aws`, klucze, `credentials.json`, pliki i katalogi typu `faktury/`, `payroll.csv`, `budżet.xlsx`. Claude dostaje odmowę, zanim narzędzie ruszy (także przez dowiązania symboliczne i globy typu `cat .en*`).
- **Pokazuje wskaźnik** `● REC` w stopce przy polu wpisywania i (opcjonalnie) w statusline.
- Opcjonalnie dodaje do każdego promptu notkę, żeby Claude sam unikał danych wrażliwych w odpowiedziach.

Maskowanie dotyczy tylko tego, co widać na ekranie. Oryginał zostaje w historii sesji i trafia do modelu bez zmian.

## Instalacja

Wymagania: Claude Code w wersji obsługującej mody (pluginy z hookami w TypeScript), testowane na **2.1.288** i **2.1.295**; sprawdzisz przez `claude --version`.

Najprościej, wpisane w Claude Code (od 2.1.275):

```
/plugin install recording-mode --marketplace hugo88/claude-code-recording-mode
```

potwierdź dodanie marketplace (`y`) i wybierz zakres (Enter = użytkownik). Mod działa od razu. Aktualizacja: `claude plugin update recording-mode`.

### Instalacja z klonu repozytorium

Linux, macOS albo WSL (`install.sh` to skrypt bash; na samym Windowsie skopiuj ręcznie foldery `hooks`, `types` i `.claude-plugin`).

```sh
git clone https://github.com/hugo88/claude-code-recording-mode
cd claude-code-recording-mode
./install.sh            # testy, potem kopia do ~/.claude/mods/recording-mode
```

Aktualizacja: `git pull && ./install.sh`. Inny folder docelowy: `./install.sh <folder>`; bez testów: `SKIP_TESTS=1 ./install.sh`.

Przy pierwszej instalacji dopisz folder do `CLAUDE_CODE_PLUGIN_DIRS` w `~/.claude/settings.json` (kilka folderów oddzielasz `:`):

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/recording-mode"
  }
}
```

i uruchom Claude Code ponownie. Na próbę bez zmian w ustawieniach: `claude --plugin-dir ~/.claude/mods/recording-mode`.

**Sprawdzenie:** wpisz `/rec`: powinien pokazać tryb `off` i pomoc. Po `/rec on` w stopce przy polu wpisywania pojawi się `● REC ON`.

### Odinstalowanie

Zainstalowany przez `/plugin install`: `claude plugin uninstall recording-mode`, potem punkt 2 (tylko `mods-data`). Z klonu:

1. Usuń folder moda z `CLAUDE_CODE_PLUGIN_DIRS` w `~/.claude/settings.json`.
2. `rm -rf ~/.claude/mods/recording-mode ~/.claude/mods-data/recording-mode`
3. Jeśli dopisałeś wskaźnik do statusline, usuń ten fragment ze swojego skryptu.

### Wskaźnik w statusline (opcjonalnie)

Mod zapisuje stan w `~/.claude/mods-data/recording-mode/state.json`, więc własny skrypt statusline może go pokazać:

```sh
case "$(cat ~/.claude/mods-data/recording-mode/state.json 2>/dev/null)" in
  *'"mode":"strict"'*) printf '\033[1;31m● REC STRICT\033[0m ' ;;
  *'"mode":"on"'*)     printf '\033[1;31m● REC ON\033[0m ' ;;
esac
```

Żeby wskaźnik zmieniał się od razu, ustaw `"statusLine": { ..., "refreshInterval": 1 }`.

## Konfiguracja

`/rec config` tworzy `~/.claude/mods-data/recording-mode/config.json` z opisem pól w kluczu `_opis`. Zmiany wczytują się same.

| Pole | Do czego |
|---|---|
| `keepNames` | Twoje imię i nazwisko / marka: widoczne także podczas nagrywania |
| `names` | Osoby zawsze maskowane (z odmianą) |
| `hide` | Dowolne teksty do ukrycia; `"/wzorzec/flagi"` to wyrażenie regularne |
| `allow` | Teksty, których nigdy nie maskować |
| `privatePaths` | Fragmenty ścieżek, których Claude nie otworzy (dopasowanie w całym poleceniu) |
| `allowPaths` | Ścieżki zwolnione z wbudowanej blokady (np. `contracts/` w projekcie Solidity) |
| `businessTools` | Narzędzia / komendy, których wyniki są ukrywane w całości |
| `closedTools` | Narzędzia, których Claude nie może wywołać podczas nagrywania |
| `noteToClaude` | `true`: notka w każdym prompcie, żeby Claude sam unikał danych wrażliwych |

Edytuj ten plik przy wyłączonym nagrywaniu: jego treść nie jest maskowana w edytorze.

## Ograniczenia

To pomoc przy nagrywaniu, nie zabezpieczenie. Przed publikacją nagrania i tak je obejrzyj.

- Wynik komend `!` (bash wpisany przez użytkownika) nie jest maskowany.
- Nie są maskowane: pole wpisywania, okna zgody na komendy, panele innych modów.
- Blokada ścieżek to deny-lista: `grep -r` po katalogu, twarde dowiązania czy skrypty ją obejdą. Twarda ochrona to `permissions.deny` w ustawieniach Claude Code.
- Słowa biznesowe blokują tylko tokeny wyglądające na ścieżkę (`/`, `\` albo rozszerzenie); katalog wpisany bez ukośnika dopisz do `privatePaths`.
- Wiersze, które terminal już wypisał przed `/rec on`, mogą zostać na ekranie bez maskowania (poza trybem fullscreen terminal ich nie przerysowuje). Włącz tryb przed sesją albo zrób `/clear`.
- Blokada `.env` patrzy na całe polecenie, więc odmówi też np. `git commit -m "fix .env loading"`.
- Podczas nagrywania Claude nie czyta też swojej pamięci (`~/.claude/projects/*/memory`).
- Nazwiska w tabelach są maskowane tylko z etykietą w tej samej komórce (`| Owner: Jan |`), nie po nagłówku kolumny.
- Nietypową odmianę imion (Marek → Marka) trzeba dopisać ręcznie w `names`.

## Rozwój

```sh
claude plugin validate .
claude plugin test .
tsc -p .   # typy generuje Claude Code przy pierwszym załadowaniu moda
```

Wszystkie dane w testach są fikcyjne.

---

## English

A [Claude Code](https://claude.com/claude-code) mod for screen recording. `/rec on` masks secrets, personal data (with Polish identifiers: PESEL, NIP, IBAN/NRB, name declension) and money amounts in what the terminal shows, and denies Claude access to private files (`.env`, `~/.ssh`, keys, invoices, payroll…) until you run `/rec off`. Masking is display-only; the session history keeps the original. Messages and docs are in Polish.

Install: `/plugin install recording-mode --marketplace hugo88/claude-code-recording-mode` in Claude Code, or clone the repo and run `./install.sh` (runs the tests, then copies the mod to `~/.claude/mods/recording-mode`), add that folder to `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` (`env`), restart Claude Code. Configure with `/rec config`.

It is a recording aid, not a security boundary: review your recording before publishing.

## Licencja

MIT
