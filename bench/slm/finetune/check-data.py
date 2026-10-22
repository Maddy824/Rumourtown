"""CPU-only validation shared by train.sh and the confirmation launch preflight."""
import json
from pathlib import Path
import sys


def check(directory):
    parts = {}
    for part in ('train', 'valid'):
        path = Path(directory) / (part + '.jsonl')
        if not path.is_file():
            raise ValueError(f'Missing arm data: {path}')
        rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        if len(rows) < 4:
            raise ValueError(f'{path}: at least one batch of four is required')
        if any('seed' not in r or not r.get('messages') for r in rows):
            raise ValueError(f'{path}: missing root seed or messages; rebuild Phase 0 data')
        parts[part] = rows
    if {r['seed'] for r in parts['train']} & {r['seed'] for r in parts['valid']}:
        raise ValueError('Training/validation root leakage')
    return len(parts['train'])


if __name__ == '__main__':
    print(check(sys.argv[1]))
