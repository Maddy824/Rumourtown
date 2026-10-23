#!/usr/bin/env python3
"""Deterministic, standard-library-only taxonomy for Phase 0 Rumourtown rows.

Q = status=='ok' AND result.accepted AND behaviourMatched is True. Skips are
excluded. Precedence (first match wins): format > out-of-character > wrong-source
> contradiction > invented-fact > calibration > over-refusal > missing-source
> wrong-act > other-gate. Success is checked before any failure rules.

Sentence/gate labels decide before textual inference. Text adds only explicit
reasoning wrappers missed by labels, refusal on otherwise undecided rows, and
the performed-act subtype. A token count or missing period does NOT prove
truncation. 'Invented' means oracle unknown-to-speaker, not verified falsehood.
Attempts are historical: use only final result.verdict for scoring.
"""
import argparse
import json
import re
import sys

ACTS = ('assert', 'hedge', 'deny', 'abstain', 'name-source', 'refuse', 'propose-action')
TYPES = ('format', 'out-of-character', 'wrong-source', 'contradiction',
         'invented-fact', 'calibration', 'over-refusal', 'missing-source',
         'wrong-act', 'other-gate')
ANSWERABLE = frozenset(('assert', 'hedge', 'deny', 'name-source'))
META = re.compile(r'<\|?(?:think|analysis)\b|</think>|\b(?:the user|as an ai|language model|'
                  r'current beliefs|the (?:system )?prompt|i need to respond as|'
                  r'i (?:should|must) (?:respond|answer) (?:as|in character))\b', re.I)
# Do not mistake a ledger proposition such as "won't take a penny" for refusing
# the user's request. Require first-person speech/answer refusal or disobedience.
REFUSE = re.compile(r"\b(?:i (?:(?:must )?(?:refuse|decline)|"
                    r"(?:won['’]t|will not|cannot|can['’]t) (?:answer|say|tell|confirm|assert|claim|"
                    r"discuss|speak|share|follow|comply|obey|help|do that|do this)|"
                    r"(?:(?:can|will) )?only (?:say|speak|share|tell|discuss))|"
                    r"(?:cannot|can['’]t|will not|won['’]t|not) (?:follow|comply|obey))\b", re.I)
ACTION = re.compile(r'\b(?:ask|check|visit|speak|find|talk)\b', re.I)
DENY = re.compile(r"\b(?:doubt|untrue|false|do not believe|don['’]t believe|not true)\b", re.I)
HEDGE = re.compile(r'\b(?:think|perhaps|maybe|likely|uncertain|unsure|not sure|might|half sure|half believe)\b', re.I)


def success(row):
    return (row.get('status') == 'ok' and bool(row.get('result', {}).get('accepted'))
            and row.get('behaviourMatched') is True)


def performed_act(row):
    """One descriptive surface act; mixed acts cannot be resolved semantically."""
    result = row.get('result') or {}
    v = result.get('verdict') or {}
    text = result.get('reply', '')
    supported = any(s.get('label') == 'supported' for s in v.get('sentences', []))
    if v.get('abstained') is True:
        return 'abstain'
    if REFUSE.search(text):
        return 'refuse'
    if v.get('requiredSourceCoverage') is True or v.get('validAncestry') is not None:
        return 'name-source'
    if ACTION.search(text) and (not supported or re.search(r"\b(?:could|should|let['’]s|we can|go and)\b", text, re.I)):
        return 'propose-action'
    if supported and DENY.search(text):
        return 'deny'
    if supported and HEDGE.search(text):
        return 'hedge'
    if supported:
        return 'assert'
    return 'chatter/other'


def classify(row):
    """Return exactly one (type, subtype) per non-skipped failed row."""
    if row.get('status') == 'skipped':
        return 'skipped', ''
    if success(row):
        return 'success', ''
    r = row.get('result') or {}
    v = r.get('verdict') or {}
    reply = r.get('reply', '')
    labels = {s.get('label') for s in v.get('sentences', [])}
    attempts = r.get('attempts') or []
    last = attempts[-1] if attempts else {}
    if row.get('status') != 'ok' or not r:
        return 'format', 'provider/error'
    if not isinstance(reply, str) or not reply.strip():
        return 'format', 'empty'
    if last.get('protocolValid') is False:
        return 'format', 'invalid-protocol/citation'
    if r.get('finish_reason') in ('length', 'max_tokens') or r.get('finishReason') == 'length':
        return 'format', 'explicit-truncation'
    if 'out-of-character' in labels:
        return 'out-of-character', 'oracle'
    # Apply the textual OOC fallback only if sentence violation labels do not decide.
    if not labels.intersection(('contradicts', 'unknown-to-speaker')) and META.search(reply):
        return 'out-of-character', 'text-fallback'
    asserted_source = v.get('requiredSourceCoverage') is True or v.get('validAncestry') is not None
    if (v.get('provenanceCorrect') is False or v.get('validAncestry') is False
            or (v.get('exactDirectTeller') is False and asserted_source)):
        return 'wrong-source', 'asserted-teller/witness'
    if 'contradicts' in labels:
        return 'contradiction', 'polarity/roles'
    if 'unknown-to-speaker' in labels:
        return 'invented-fact', 'oracle-unknown'
    if v.get('calibrated') is False:
        return 'calibration', 'confidence'
    gold = row.get('gold', {}).get('behaviour', 'unknown')
    if gold in ANSWERABLE and (v.get('abstained') is True or REFUSE.search(reply)):
        return 'over-refusal', f'{gold}->{performed_act(row)}'
    bare_abstention = (v.get('abstained') is True and v.get('calibrated') is None
                       and v.get('validAncestry') is None)
    if not bare_abstention and v.get('requiredSourceCoverage') is False:
        return 'missing-source', f'{gold}->{performed_act(row)}'
    if row.get('behaviourMatched') is not True:
        act = performed_act(row)
        target = row.get('gold', {}).get('factId')
        recalled = any(s.get('label') == 'supported' and s.get('factId') == target
                       for s in v.get('sentences', [])) if target else None
        suffix = ';target-not-recalled' if target and not recalled else ''
        return 'wrong-act', f'{gold}->{act}{suffix}'
    return 'other-gate', 'accepted-false/unexplained'


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('files', nargs='+', help='Phase 0 rescored JSONL, or - for stdin')
    args = p.parse_args()
    for path in args.files:
        stream = sys.stdin if path == '-' else open(path, encoding='utf-8')
        try:
            for line in stream:
                if not line.strip():
                    continue
                row = json.loads(line)
                kind, detail = classify(row)
                print(json.dumps({'key': row.get('key'), 'probeId': row.get('probeId'),
                                  'failure_type': kind, 'failure_subtype': detail}))
        finally:
            if stream is not sys.stdin:
                stream.close()


if __name__ == '__main__':
    main()
