"""CPU-only utilities shared with the opt-in GPU server."""
import copy
import hashlib
import json
import os
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n')
    os.replace(temp, path)


def messages_for_model(messages, gemma=False):
    """Gemma: losslessly prepend the system instruction to the first user turn."""
    messages = copy.deepcopy(messages)
    if gemma and messages and messages[0]['role'] == 'system':
        system = messages.pop(0)['content']
        if not messages or messages[0]['role'] != 'user':
            raise ValueError('Gemma requires a user turn after the system instruction')
        messages[0]['content'] = system + '\n\n' + messages[0]['content']
    return messages


def common_prefix(a, b):
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def latest_jsonl(path):
    """Recover only a torn final append; malformed complete records are fatal."""
    path = Path(path)
    if not path.exists():
        return []
    raw = path.read_bytes()
    boundary = raw.rfind(b'\n') + 1
    if boundary < len(raw):
        with path.open('r+b') as f:
            f.truncate(boundary)
    rows = [json.loads(line) for line in raw[:boundary].splitlines() if line]
    return list({r['key']: r for r in rows}.values())
