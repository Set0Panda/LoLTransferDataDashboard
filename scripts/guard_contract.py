#!/usr/bin/env python3
"""Sanity guard for the Contract Radar snapshot, ported from contract-radar/scripts/refresh.js.

usage: guard_contract.py OLD_data.js NEW_data.js [--force]    (also honours ALLOW_BIG_CHANGE=1)
Exit 0 = safe to replace OLD with NEW. Exit 1 = keep OLD (message explains why).

Per region: up to 15% change passes. Beyond that it is only believable if the sheet's own "last updated" stamp moved
(download time says nothing about the source), and even then a drop over 50% or growth over 100% needs a human:
re-run the workflow with "force" ticked. A stamp that goes backwards, a missing region or an e-mail address always fails.
"""
import json, os, re, sys

BAND, CAP_DROP, CAP_GROW = 0.15, 0.5, 1.0


def load(path):
    txt = open(path, encoding="utf-8").read()
    out = {}
    for key in ("META", "TEAMS", "ROWS"):
        m = re.search(r"window\.GCD_%s\s*=\s*" % key, txt)
        if not m:
            raise ValueError(f"window.GCD_{key} not found")
        out[key], _ = json.JSONDecoder().raw_decode(txt, m.end())
    out["raw"] = txt
    return out


def counts(d):
    c = {}
    for r in d["ROWS"]:
        t = d["TEAMS"][r[0]] if 0 <= r[0] < len(d["TEAMS"]) else None
        if t:
            c[t[0]] = c.get(t[0], 0) + 1
    return c


def check(old, new, force):
    errs, warns, over = [], [], []
    if re.search(r"@", new["raw"]):
        errs.append("an '@' (possible e-mail address) is in the new file")
    for r in new["ROWS"]:
        if not (0 <= r[0] < len(new["TEAMS"])):
            errs.append("a row references a missing team"); break
    cn = counts(new)
    if old is None:
        return errs, warns, over
    co = counts(old)
    so, sn = old["META"].get("updated", {}), new["META"].get("updated", {})
    for g, a in co.items():
        b = cn.get(g, 0)
        if not b:
            errs.append(f"{g}: region missing or no rows parsed (was {a})"); continue
        if not a:
            continue
        ch = (b - a) / a; pct = f"{round(ch * 100)}%"
        old_s, new_s = so.get(g), sn.get(g)
        if old_s and new_s and new_s < old_s:
            errs.append(f"{g}: the sheet's last-updated stamp went backwards ({old_s} -> {new_s})"); continue
        if abs(ch) <= BAND:
            continue
        moved = (not old_s) or (new_s and new_s > old_s)
        msg = None
        if not moved:
            msg = f"{g}: {a} -> {b} rows ({pct}) but the sheet's own stamp did not move ({new_s}). Looks like a partial or malformed fetch"
        elif ch < -CAP_DROP or ch > CAP_GROW:
            msg = f"{g}: {a} -> {b} rows ({pct}) is beyond what is accepted automatically even though the stamp moved ({old_s} -> {new_s}). Needs a human look"
        if msg:
            (warns if force else over).append(("FORCED, accepted anyway: " if force else "") + msg)
        else:
            warns.append(f"{g}: {a} -> {b} rows ({pct}); accepted because the sheet stamp moved ({old_s} -> {new_s})")
    return errs, warns, over


def main(argv):
    force = "--force" in argv or os.environ.get("ALLOW_BIG_CHANGE") == "1"
    args = [a for a in argv if not a.startswith("--")]
    old_p, new_p = args[0], args[1]
    try:
        new = load(new_p)
    except Exception as e:
        print(f"GUARD: new file unreadable ({e}); keeping the existing snapshot"); return 1
    try:
        old = load(old_p) if os.path.exists(old_p) else None
    except Exception:
        old = None
    errs, warns, over = check(old, new, force)
    for w in warns:
        print("warning: " + w)
    if errs or over:
        print("GUARD: contract snapshot NOT replaced, the last good data stays live.\n - " + "\n - ".join(errs + over))
        if over and not errs:
            print('If the change is real, re-run the workflow with "force" ticked.')
        return 1
    print("GUARD: contract snapshot looks sane")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
