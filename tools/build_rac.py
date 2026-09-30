"""ACFinder（macs-labo/macs）の acis.db・spec.db から、農薬の登録番号→RACコードの表（data/rac.json）を作る。

使い方: python tools/build_rac.py <acis.db> <spec.db> <出力 rac.json>

- 登録番号（m_kihon.bango）ごとに、有効成分（seibun.ippanmei）の RAC コードを集める。
- RAC コードは acis.db の m_dokusei.rac（例 I-4A, F-M4）を使い、無い成分は spec.db の rac_ai.sid（例 I:4A, F:M4a）で補う。
- 表記はアプリに合わせて「IRAC 4A」「FRAC M4・P7」「IRAC 4A／FRAC M4」の形にする。
- 生物農薬・植物成長調整剤などの「-」「-(生)」「-(植)」は RAC コードなしとして扱う。
- 生成日時は入れない（DBが変わらなければ出力も変わらず、Actions で余計なコミットが出ないようにするため）。
"""
import json
import re
import sqlite3
import sys

PREFIX = {'I': 'IRAC', 'F': 'FRAC', 'H': 'HRAC'}
CODE_RE = re.compile(r'^([IFH])[-:]\s*([0-9A-Z]+(?:\.[0-9]+)?)([a-z]?)$')


def norm(raw):
    """'I-4A' / 'F:M4a' → ('I', '4A') / ('F', 'M4')。RAC コードでないものは None"""
    if not raw:
        return None
    m = CODE_RE.match(str(raw).strip())
    if not m:
        return None
    kind, code, sub = m.groups()
    if kind == 'I' and sub:  # IRAC の小分類は大文字（1A 等）。小文字が付くことは想定外なので落とさず残す
        code += sub
    return kind, code


def main(acis_path, spec_path, out_path):
    a = sqlite3.connect(acis_path)
    a.execute('attach ? as s', (spec_path,))
    dok = {}
    for ip, rac in a.execute('select ippanmei, rac from m_dokusei'):
        c = norm(rac)
        if c:
            dok.setdefault(ip, []).append(c)
    spec = {}
    for sid, ip in a.execute('select sid, ippanmei from s.rac_ai'):
        c = norm(sid)
        if c:
            spec.setdefault(ip, []).append(c)

    ais = {}
    for bango, ip in a.execute('select bango, ippanmei from seibun order by rowid'):
        ais.setdefault(bango, [])
        if ip and ip not in ais[bango]:
            ais[bango].append(ip)

    items = {}
    for bango, meisho in a.execute('select bango, meisho from m_kihon order by bango'):
        codes = []
        for ip in ais.get(bango, []):
            for c in dok.get(ip) or spec.get(ip) or []:
                if c not in codes:
                    codes.append(c)
        if not codes:
            continue
        groups = {}
        for kind, code in codes:
            groups.setdefault(kind, []).append(code)
        rac = '／'.join(PREFIX[k] + ' ' + '・'.join(v) for k, v in groups.items())
        items[str(bango)] = [meisho, rac, '・'.join(ais.get(bango, []))]

    info = dict(a.execute('select Item, Value from info'))
    sinfo = dict(a.execute('select item, value from s.info'))
    out = {
        'source': 'ACFinder（macs-labo/macs）acis.db・spec.db',
        'acis': info.get('LastUpdate', ''),
        'dokusei': info.get('m_dokusei', ''),
        'irac': sinfo.get('irac', ''),
        'frac': sinfo.get('frac', ''),
        'hrac': sinfo.get('hrac', ''),
        'count': len(items),
        'items': items,
    }
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'), sort_keys=False)
        f.write('\n')
    print(f'{len(items)} products with RAC codes -> {out_path} ({info.get("LastUpdate", "")})')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit('usage: build_rac.py <acis.db> <spec.db> <out.json>')
    main(*sys.argv[1:])
