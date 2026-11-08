"""Tiny stdlib HTTP helper: retries, timeouts, JSON/text, proxy + CA env honoured by urllib."""
import json, time, urllib.request, urllib.error, urllib.parse

UA = "lol-transfer-radar/0.1 (personal research tool)"


def get(url, headers=None, params=None, data=None, retries=3, timeout=20, as_json=False):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    h = {"User-Agent": UA, "Accept": "*/*"}
    h.update(headers or {})
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=h, data=data)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read().decode("utf-8", errors="replace")
                return json.loads(body) if as_json else body
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (403, 404, 401):      # policy / auth / missing: retrying won't help
                break
            time.sleep(1.5 * (attempt + 1))
        except Exception as e:                 # network blips
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"GET {url.split('?')[0]} failed: {last}")
