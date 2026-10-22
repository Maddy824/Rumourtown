"""Content-addressed manifests and durable, duplicate-free result journals (§0, §8)."""
import hashlib
import json
import os
import importlib.metadata
from pathlib import Path


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def file_hash(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def hashes(paths):
    return {str(p): file_hash(p) for p in sorted(map(Path, paths))}


def checkpoint_manifest(model_dir, adapter_dir=None, data_paths=(), config=None):
    model_dir = Path(model_dir)
    repo = Path(__file__).resolve().parents[3]
    distribution = importlib.metadata.distribution('mlx-lm')
    mlx_sources = [distribution.locate_file('mlx_lm/'+p) for p in
                   ('models/qwen3.py', 'models/llama.py', 'tuner/utils.py', 'tuner/lora.py', 'generate.py')]
    # Hash checkpoint files as bytes only; never deserialize weights here.
    return {"model": hashes(model_dir.glob("*.safetensors")),
            "adapter": hashes(p for p in Path(adapter_dir).rglob("*") if p.is_file()) if adapter_dir else {},
            "tokenizer": hashes(p for p in model_dir.glob("*") if p.is_file() and
                                ("token" in p.name or "template" in p.name)),
            "model_config": file_hash(model_dir / "config.json"),
            "data": hashes(data_paths), "config": config or {},
            "mlx_lm_version": distribution.version, "mlx_lm_source": hashes(mlx_sources),
            "source": hashes([*Path(__file__).parent.rglob("*.py"),
                              *Path(__file__).parent.rglob("*.ts"),
                              repo/'docs/research/neural-track.md', repo/'docs/research/methods-formal.md',
                              repo/'apps/rumortown/src/agentic/verifier.ts',
                              *[Path(__file__).parent.parent/p for p in
                                ('types.ts', 'strategies.ts', 'run.ts', 'rescore.ts', 'verifier.ts')]])}


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w") as f:
        f.write(canonical(value) + "\n")
        f.flush()
        os.fsync(f.fileno())
    tmp.replace(path)


def jsonl(path):
    with Path(path).open() as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


class Journal:
    """Single-writer journal. Truncated final writes are repaired, conflicts fail closed."""
    def __init__(self, directory, manifest, filename="outputs.jsonl"):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        mp = self.directory / "manifest.json"
        if mp.exists() and canonical(json.loads(mp.read_text())) != canonical(manifest):
            raise ValueError("Resume manifest mismatch")
        atomic_json(mp, manifest)
        self.path = self.directory / filename
        self.rows = {}
        if self.path.exists():
            with self.path.open("r+b") as f:
                while True:
                    start = f.tell()
                    line = f.readline()
                    if not line:
                        break
                    if not line.endswith(b"\n"):
                        f.truncate(start)
                        break
                    row = json.loads(line)
                    if row["key"] in self.rows:
                        raise ValueError("Duplicate journal key")
                    self.rows[row["key"]] = row

    def append(self, row):
        key = row["key"]
        if key in self.rows:
            if json.loads(canonical(self.rows[key])) != json.loads(canonical(row)):
                raise ValueError("Conflicting journal row")
            return False
        with self.path.open("a") as f:
            f.write(canonical(row) + "\n")
            f.flush()
            os.fsync(f.fileno())
        self.rows[key] = row
        return True
