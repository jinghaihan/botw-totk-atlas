"""Build short multilingual names only; no game descriptions/dialogue are bundled."""
import concurrent.futures
import html
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

CACHE = Path('.local/game-text')
CACHE.mkdir(parents=True, exist_ok=True)
LANGUAGES = {'CNzh': 'zh-CN', 'TWzh': 'zh-TW', 'USen': 'en-US'}


def fetch(repo, path):
    target = CACHE / repo / path
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        req = Request(f'https://raw.githubusercontent.com/sh0wer1ee/{repo}/main/{path}', headers={'User-Agent': 'WildsAtlas metadata builder'})
        target.write_bytes(urlopen(req, timeout=40).read())
    return target.read_text()


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.table = ''
        self.row = []
        self.cell = None
        self.caption = False

    def handle_starttag(self, tag, attrs):
        if tag == 'caption':
            self.caption = True
            self.table = ''
        elif tag == 'tr':
            self.row = []
        elif tag == 'td':
            self.cell = ''

    def handle_data(self, data):
        if self.caption:
            self.table += data
        if self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if tag == 'caption':
            self.caption = False
        elif tag == 'td':
            self.row.append(self.cell.strip())
            self.cell = None
        elif tag == 'tr' and len(self.row) == 5 and self.row[0] != 'label':
            self.rows.append((self.table, self.row))


def clean(text):
    import re
    return html.unescape(re.sub(r'<[^>]+>', '', text)).strip()


def build(game):
    repo = 'BotwText' if game == 'botw' else 'TotkText'
    rows = []
    if game == 'botw':
        paths = ['page/ActorType.html', 'page/StaticMsg.html', 'page/QuestMsg.html']
        for path in paths:
            parser = Tables()
            parser.feed(fetch(repo, path))
            for table, values in parser.rows:
                key, cn, jp, tw, en = values
                if key.endswith(('_Name', '_name')) or table in ['Dungeon', 'LocationMarker']:
                    rows.append((key.removesuffix('_Name').removesuffix('_name'), {'CNzh': cn, 'TWzh': tw, 'USen': en}))
    else:
        tree = json.loads(urlopen(Request(f'https://api.github.com/repos/sh0wer1ee/{repo}/git/trees/main?recursive=1', headers={'User-Agent': 'WildsAtlas'}), timeout=40).read())
        paths = [p['path'] for p in tree['tree'] if p['path'].endswith('.json') and any(p['path'].startswith(prefix) for prefix in ['data/chunks/ActorMsg/PouchContent/', 'data/chunks/ActorMsg/Horse/', 'data/chunks/LocationMsg/', 'data/chunks/ChallengeMsg/'])]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            for data in pool.map(lambda path: json.loads(fetch(repo, path)), paths):
                folder, table = data['meta']['folder'], data['meta']['file']
                for row in data['rows']:
                    key = row['key']
                    if folder == 'ChallengeMsg':
                        if key not in ['Name', 'Title']: continue
                        key = table.removeprefix('Info_')
                    elif folder == 'ActorMsg':
                        if not key.endswith('_Name'): continue
                        key = key.removesuffix('_Name')
                    rows.append((key, row))
    result = {locale: {'ids': {}, 'english': {}} for locale in LANGUAGES.values()}
    for key, row in rows:
        en = clean(row.get('USen', ''))
        # Drop suffix templates/control-code references, keep direct names.
        for lang, locale in LANGUAGES.items():
            value = clean(row.get(lang, ''))
            if value and '<' not in value and len(value) <= 120:
                result[locale]['ids'][key] = value
                if en:
                    result[locale]['english'].setdefault(en, value)
    for locale, data in result.items():
        Path(f'public/labels/{game}-{locale}.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    digests = {path: hashlib.sha256((CACHE / repo / path).read_bytes()).hexdigest() for path in paths}
    return {'sha256': digests, 'game': game, 'source': f'https://github.com/sh0wer1ee/{repo}', 'version': '1.6.0' if game == 'botw' else '1.2.1', 'sourceFiles': paths, 'names': {locale: len(data['ids']) for locale, data in result.items()}, 'note': 'Only short names, no dialogue or descriptions. Original game text © Nintendo.'}


Path('public/labels').mkdir(parents=True, exist_ok=True)
manifest = [build(game) for game in ['botw', 'totk']]
Path('public/labels/sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print([(m['game'], m['names']) for m in manifest])
