import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import numpy as np

try:
    import mlx.core as mx
    mx.set_default_device(mx.cpu)  # No GPU operations, including synthetic tests.
    import mlx.nn as nn
    MLX_ERROR = None
except ImportError as error:
    mx, nn, MLX_ERROR = None, None, str(error)

from bench.slm.neural import prompts, probes, steer, states, attention, drift, calibration, grid
from bench.slm.neural.common import Journal, jsonl
from bench.slm.neural.analysis import (root_samples, grid_associations, paired_contrasts, holm,
    monotone_mapping, mapped_equivalence, crossed_bootstrap, tau_b)

ROOT = Path(__file__).resolve().parents[4]
CONFIG = Path(__file__).parent/'fixtures/qwen3-0.6b-config.json'


class PromptTests(unittest.TestCase):
    def test_cached_qwen_tokenizer_100_prompts_without_weights(self):
        matches = list((Path.home()/'.cache/huggingface/hub').glob('models--mlx-community--Qwen3-0.6B-bf16/snapshots/*/tokenizer_config.json'))
        if not matches:
            self.skipTest('Local cached Qwen tokenizer absent; no download attempted')
        from transformers import AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(matches[0].parent, local_files_only=True)
        scenarios = {s['id']: s for s in jsonl(ROOT/'bench/slm/data/scenarios.jsonl')}
        all_probes = list(jsonl(ROOT/'bench/slm/data/probes.jsonl'))
        # Broad, deterministic sample spans history, distractors, revisions and all data splits.
        selected = [all_probes[i] for i in np.linspace(0, len(all_probes)-1, 100, dtype=int)]
        for p in selected:
            r = prompts.render(scenarios[p['scenarioId']], p, tokenizer)
            self.assertEqual(r['tokens'], tokenizer.apply_chat_template(r['messages'], return_dict=False,
                enable_thinking=False, add_generation_prompt=True))
            for span in r['spans'].values():
                for a, b in span['bytes']:
                    self.assertTrue(0 <= a <= b <= len(r['text'].encode()))

    def test_ten_probe_typescript_parity(self):
        fixture = subprocess.run(['node', '--experimental-strip-types', 'bench/slm/neural/fixture.ts'],
                                 cwd=ROOT, check=True, text=True, capture_output=True)
        rows = [json.loads(line) for line in fixture.stdout.splitlines()]
        scenarios = {s['id']: s for s in jsonl(ROOT/'bench/slm/data/scenarios.jsonl')}
        by_id = {p['id']: p for p in jsonl(ROOT/'bench/slm/data/probes.jsonl') if p['id'] in {r['probeId'] for r in rows}}
        self.assertEqual(len(rows), 10)
        for row in rows:
            p = by_id[row['probeId']]
            actual = prompts.messages_for(scenarios[p['scenarioId']], p)
            self.assertEqual(prompts.js_json(actual).encode(), prompts.js_json(row['messages']).encode())

    def example(self):
        s = next(jsonl(ROOT/'bench/slm/data/scenarios.jsonl'))
        p = next(jsonl(ROOT/'bench/slm/data/probes.jsonl'))
        p = {**p, 'facts': [], 'distractors': [{'speaker': 'é', 'text': 'quoted 雨'}],
             'history': [{'role': 'assistant', 'content': 'same'}, {'role': 'user', 'content': 'same'}],
             'revisions': [{'factId': 'a', 'oldText': 'old', 'newText': 'new'}]}
        return s, p

    def test_effective_ledger_and_evaluator_separation(self):
        s, p = self.example()
        text = prompts.messages_for(s, p)[0]['content']
        self.assertIn('Current beliefs: []', text)
        self.assertNotIn('trueInWorld', text)
        self.assertNotIn('unknownWorldFacts', text)
        self.assertEqual(prompts.sidecar(s, p)['labels']['known'], 0)
        p['facts'] = [{**s['facts'][0], 'trueInWorld': False}]
        self.assertEqual(prompts.sidecar(s, p)['labels']['known'], 1)

    def test_template_spans_unicode_repeats_and_suffix(self):
        class Tokenizer:
            def apply_chat_template(self, messages, tokenize=False, **kw):
                text = ''.join(f'<{m["role"]}>{m["content"]}</>' for m in messages)+'<assistant><no-think>'
                return list(text.encode()) if tokenize else text

            def __call__(self, text, **kw):
                return {'input_ids': list(text.encode()),
                        'offset_mapping': [(i, i+1) for i, c in enumerate(text) for _ in c.encode()]}
        s, p = self.example()
        result = prompts.render(s, p, Tokenizer())
        for name, span in result['spans'].items():
            for a, b in span['bytes']:
                self.assertLessEqual(a, b)
                self.assertLessEqual(b, len(result['text'].encode()))
            self.assertTrue(all(0 <= i < len(result['tokens']) for i in span['tokens']))
        self.assertEqual(len(result['spans']['history']['bytes']), 2)
        a, b = result['spans']['distractor:0']['bytes'][0]
        self.assertEqual(result['text'].encode()[a:b].decode(), prompts.js_json(p['distractors'][0]))
        self.assertTrue(result['text'].encode()[result['spans']['suffix']['bytes'][0][0]:].endswith(b'<assistant><no-think>'))

    def test_template_trim_preserves_visible_utterance_offsets(self):
        class Tokenizer:
            def apply_chat_template(self, messages, tokenize=False, **kw):
                text = ''.join(f'<{m["role"]}>{m["content"].strip()}</>' for m in messages)+'<assistant>'
                return list(text.encode()) if tokenize else text

            def __call__(self, text, **kw):
                return {'input_ids': list(text.encode()), 'offset_mapping': [(i, i+1) for i in range(len(text))]}
        s, p = self.example()
        s['persona'] = {'name': 'Pim', 'role': 'shopkeeper', 'voice': 'plain'}
        p['distractors'] = []
        p['utterance'] = '  question  '
        r = prompts.render(s, p, Tokenizer())
        a, b = r['spans']['utterance']['bytes'][0]
        self.assertEqual(r['text'].encode()[a:b], b'question')

    def test_js_number_format(self):
        self.assertEqual(prompts.js_json([1., 1e-6, 1e-7, -0., 1e20]), '[1,0.000001,1e-7,0,100000000000000000000]')

    def test_generated_claim_query_is_previous_position(self):
        class Tokenizer:
            def decode(self, tokens, **kw):
                return bytes(tokens).decode()

            def __call__(self, text, **kw):
                return {'input_ids': list(text.encode()), 'offset_mapping': [(i, i+1) for i in range(len(text))]}
        result = prompts.generated_claim_spans(Tokenizer(), list(b'a claim'), {'claim': [(2, 7)]}, 10)
        self.assertEqual(result['spans']['claim']['absolute_tokens'], [12, 13, 14, 15, 16])
        self.assertEqual(result['spans']['claim']['predicting_queries'], [11, 12, 13, 14, 15])


class StorageTests(unittest.TestCase):
    def test_resume_repair_and_manifest_lock(self):
        with tempfile.TemporaryDirectory() as d:
            journal = Journal(d, {'shape': (2, 3)})
            self.assertTrue(journal.append({'key': 'a', 'x': 1}))
            self.assertFalse(journal.append({'key': 'a', 'x': 1}))
            with journal.path.open('ab') as f:
                f.write(b'{"key":')
            resumed = Journal(d, {'shape': (2, 3)})
            self.assertEqual(list(resumed.rows), ['a'])
            with self.assertRaises(ValueError):
                Journal(d, {'shape': [3, 3]})
            with self.assertRaises(ValueError):
                resumed.append({'key': 'a', 'x': 2})

    def test_pooling_and_memmap_missing_claim(self):
        p = states.Pooler(4, [1, 2])
        h = np.arange(24, dtype=np.float32).reshape(1, 4, 6)
        for label in ('embedding', 'block:1', 'final_norm'):
            p(label, h[:, :2], 0)
            p(label, h[:, 2:], 2)
        a = p.array(['embedding', 'block:1', 'final_norm'], 6)
        np.testing.assert_equal(a[0, 0], np.arange(18, 24))
        np.testing.assert_equal(a[0, 1], np.arange(9, 15))
        self.assertTrue(np.isnan(a[:, 2]).all())
        with tempfile.TemporaryDirectory() as d:
            store = states.StateStore(d, {'model': 'synthetic'}, 2, 1, 6)
            self.assertTrue(store.append('a', a, {'probeId': 'a'}))
            again = states.StateStore(d, {'model': 'synthetic'}, 2, 1, 6)
            self.assertFalse(again.append('a', a, {}))
            np.testing.assert_equal(again.data[0], a)
            again.data[0, 0, 0, 0] = -999
            again.data.flush()
            with self.assertRaises(ValueError):
                states.StateStore(d, {'model': 'synthetic'}, 2, 1, 6)


class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.rng = np.random.default_rng(7)
        self.roots = np.repeat(np.arange(30), 8)
        self.y = np.tile([0, 1], 120)
        self.x = self.rng.normal(size=(240, 4))
        self.x[:, 0] += 5*self.y

    def test_nested_root_folds_and_known_separation(self):
        result = probes.nested_probe(self.x, self.y, self.roots)
        self.assertGreater(result['auroc'], .99)
        for fold in result['folds']:
            self.assertFalse(set(fold['fit_roots']) & set(fold['test_roots']))
        self.assertAlmostEqual(probes.auroc([0, 1], [.5, .5]), .5)
        with self.assertRaises(ValueError):
            probes.fit_logistic(self.x, np.zeros(len(self.x)))

    def test_multiclass_and_scaler_freeze(self):
        y = np.tile(np.arange(3), 80)
        x = np.eye(3)[y]*4+self.rng.normal(scale=.1, size=(240, 3))
        fit = probes.fit_logistic(x[:180], y[:180])
        self.assertGreater(fit.score(x[180:], y[180:])['auroc'], .99)
        binary = probes.fit_logistic(self.x, self.y)
        original = probes.transfer(binary, self.x, self.y)
        shifted = probes.transfer(binary, self.x+np.array([20, 0, 0, 0]), self.y)
        self.assertAlmostEqual(original['auroc'], shifted['auroc'])
        self.assertGreater(shifted['log_loss'], original['log_loss'])
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)/'fit.npz'
            binary.save(path)
            np.testing.assert_equal(probes.Fit.load(path).predict(self.x), binary.predict(self.x))

    def test_structured_permutations_and_bootstrap(self):
        y = np.repeat(np.arange(30) % 2, 8)
        shuffled, manifest = probes.structured_permutation(y, self.roots, np.tile(np.arange(8), 30))
        self.assertEqual(manifest['exchangeable_roots'], 30)
        self.assertTrue(all(len(set(shuffled[self.roots == r])) == 1 for r in np.unique(self.roots)))
        self.assertFalse(np.array_equal(y, shuffled))
        boot = probes.root_bootstrap(self.y, self.y, self.roots, replicates=100)
        self.assertEqual(boot['interval'], [1., 1.])

    def test_cka_controls(self):
        x = self.rng.normal(size=(2000, 8))
        rotation = np.linalg.qr(self.rng.normal(size=(8, 8)))[0]
        self.assertAlmostEqual(probes.linear_cka(x, x@rotation), 1.)
        self.assertAlmostEqual(probes.linear_cka(x, x@rotation, unbiased=True), 1.)
        self.assertLess(probes.linear_cka(x, self.rng.normal(size=x.shape)), .02)
        controls = probes.cka_controls(x[:80], x[:80], sizes=(32, 64))
        self.assertEqual(set(controls['sample_size']), {'32', '64'})

    def test_planted_emergence(self):
        scores = np.array([.51, .6, .82, .85, .87, .91, .92, .93])
        boots = scores+self.rng.normal(scale=.005, size=(200, 8))
        null = np.full(8, .5)
        result = probes.emergence(scores, boots, null, np.tile(null, (200, 1)))
        self.assertEqual(result['thresholds']['0.8']['layer'], 3)
        self.assertEqual(result['thresholds']['0.9']['layer'], 6)
        absent = probes.emergence(np.full(8, .5), np.tile(null, (200, 1)), null, np.tile(null, (200, 1)))
        self.assertIsNone(absent['thresholds']['0.8']['layer'])

    def test_transfer_held_out_roots_and_separate_refit_uncertainty(self):
        cv = probes.nested_probe(self.x, self.y, self.roots)
        moved = probes.nested_transfer(self.x, -self.x, self.y, self.roots, cv)
        self.assertLess(moved['auroc'], .02)
        refits = probes.refit_bootstrap(self.x[:160], self.y[:160], self.roots[:160],
                                        self.x[160:], self.y[160:], 1., replicates=20)
        self.assertEqual(refits['missing_class_refits'], 0)
        self.assertGreater(refits['intervals'][0][0], .95)


class InterventionTests(unittest.TestCase):
    @unittest.skipIf(mx is None, MLX_ERROR or '')
    def test_two_layer_residual_injection_exact_positions(self):
        # Two synthetic affine residual blocks: no tokenizer, vocabulary or language model.
        class Block(nn.Module):
            def __call__(self, x):
                return x+mx.ones_like(x)
        blocks = [Block(), Block()]
        x = mx.zeros((1, 5, 4))
        direction = steer.Direction(np.array([1., 0, 0, 0]), 2., 1.)
        injection = steer.Injection(1, direction, .5, 4)
        baseline, altered = x, x
        for layer, block in enumerate(blocks, 1):
            baseline = block(baseline)
            altered = injection(layer, block(altered), 0)
        expected = np.zeros((1, 5, 4))
        expected[0, 3:, 0] = 1.
        np.testing.assert_equal(np.array(altered-baseline), expected)
        first = steer.Injection(1, direction, .5, 4, first_only=True)
        expected[0, 4, 0] = 0
        np.testing.assert_equal(np.array(first(1, x, 0)), expected)
        np.testing.assert_equal(np.array(first(1, x[:, :1], 4)), 0.)
        decode = injection(1, x[:, :1], 4)
        self.assertEqual(float(decode[0, 0, 0].item()), 1.)
        np.testing.assert_equal(np.array(steer.Injection(1, direction, 0, 4)(1, x, 0)), np.array(x))
        replacement = steer.Injection(1, direction, 0, 4, replacement=np.ones(4)*9)
        np.testing.assert_equal(np.array(replacement(1, x, 0))[0, 3:], 9.)

    def test_direction_orientation_mapping_and_random_norm(self):
        known = np.array([[2., 1], [4., 2]])
        absent = known-1
        d = steer.direction(known, absent, weights=np.array([-2., -1.]), scales=np.array([2., 1.]))
        self.assertGreater(np.dot(d.vector, (known-absent).mean(0)), 0)
        self.assertAlmostEqual(np.linalg.norm(d.vector), 1)
        for control in steer.random_directions(d):
            self.assertAlmostEqual(np.linalg.norm(control.vector), 1)
            self.assertEqual(control.sd, d.sd)
        self.assertIsNone(steer.direction(known, known))

    def test_output_schema_and_fail_closed_placeholder(self):
        s = next(jsonl(ROOT/'bench/slm/data/scenarios.jsonl'))
        p = next(jsonl(ROOT/'bench/slm/data/probes.jsonl'))
        row = steer.output_row(s, p, 'synthetic', {'alpha': 0}, 'reply')
        self.assertEqual(row['strategy'], 'grounded')
        self.assertTrue(row['neural']['needsRescore'])
        self.assertFalse(row['result']['accepted'])


class AttentionTests(unittest.TestCase):
    def tiny_attention(self, architecture):
        from mlx_lm.models import qwen3, llama
        mx.random.seed(7)
        args = dict(model_type=architecture, hidden_size=8, intermediate_size=12, num_hidden_layers=2,
                    num_attention_heads=4, num_key_value_heads=2, head_dim=4, vocab_size=16,
                    rms_norm_eps=1e-6, max_position_embeddings=128, rope_theta=10000., tie_word_embeddings=True)
        module = qwen3 if architecture == 'qwen3' else llama
        return module.Attention(module.ModelArgs(**args))

    @unittest.skipIf(mx is None, MLX_ERROR or '')
    def test_fused_parity_prefill_cached_decode_gqa(self):
        from mlx_lm.models.cache import KVCache
        x = mx.array(np.random.default_rng(7).normal(size=(1, 5, 8)), mx.float32)
        for architecture in ('qwen3', 'llama'):
            module = self.tiny_attention(architecture)
            c1, c2 = KVCache(), KVCache()
            fused = module(x[:, :4], 'causal', c1)
            slow = attention.slow_attention(module, x[:, :4], 'causal', c2)
            np.testing.assert_allclose(np.array(fused), np.array(slow), atol=2e-5, rtol=2e-5)
            fused = module(x[:, 4:], None, c1)
            slow = attention.slow_attention(module, x[:, 4:], None, c2)
            np.testing.assert_allclose(np.array(fused), np.array(slow), atol=2e-5, rtol=2e-5)
            # Same readout and greedy decision, without constructing a language model.
            readout = mx.array(np.random.default_rng(9).normal(size=(8, 10)), mx.float32)
            np.testing.assert_equal(np.array(mx.argmax(fused@readout, axis=-1)), np.array(mx.argmax(slow@readout, axis=-1)))

    @unittest.skipIf(mx is None, MLX_ERROR or '')
    def test_masks_online_query_alignment_and_ablation(self):
        module = self.tiny_attention('qwen3')
        x = mx.array(np.random.default_rng(7).normal(size=(1, 5, 8)), mx.float32)
        masses = attention.SpanMass([4])
        attention.slow_attention(module, x, block_spans=[(1, 3)], spans={'D': [1, 2], 'L': [0]}, reducer=masses)
        self.assertEqual(masses.rows[0]['queries'], [3])
        np.testing.assert_equal(np.array(masses.rows[0]['masses']['D']), 0.)  # per layer, head and query
        zero = attention.slow_attention(module, x, ablate_heads=[0, 1, 2, 3])
        np.testing.assert_equal(np.array(zero), 0.)
        normal = attention.slow_attention(module, x)
        decode_only = attention.slow_attention(module, x, block_spans=[(1, 3)], decode_only=True, prompt_length=5)
        np.testing.assert_equal(np.array(normal), np.array(decode_only))

    def test_random_spans_swaps_and_statistic(self):
        controls = attention.random_spans(30, 3, [(2, 20)], excluded=range(5, 10))
        self.assertEqual(len(controls), 20)
        self.assertTrue(all(b-a == 3 and not set(range(a, b)) & set(range(5, 10)) for a, b in controls))
        self.assertEqual(attention.content_swap([0, 1, 2, 3], 1, 3, [9, 8]), [0, 9, 8, 3])
        with self.assertRaises(ValueError):
            attention.content_swap([0, 1], 0, 2, [9])
        self.assertAlmostEqual(attention.causal_statistic([1, 0], [0, 0], [[1, 1], [0, 0]], [1, 1]), -.5)


class DriftCalibrationTests(unittest.TestCase):
    def test_full_vocab_kl_chunking_known_value(self):
        b = np.log([[.2, .3, .5], [.4, .1, .5]])
        t = np.log([[.1, .4, .5], [.2, .2, .6]])
        expected = np.sum(np.exp(b)*(b-t), axis=1)
        for size in (1, 2, 99):
            result = drift.conditional_kl(lambda a, z: b[:, a:z], lambda a, z: t[:, a:z], 2, 3, size)
            np.testing.assert_allclose(result['per_token'], expected, atol=2e-7)
        self.assertAlmostEqual(drift.conditional_kl(lambda a, z: b[:, a:z], lambda a, z: b[:, a:z], 2, 3)['conditional_kl'], 0)

    def test_cached_continuation_keeps_eos_cap_and_resumes(self):
        with tempfile.TemporaryDirectory() as d:
            cache = drift.Continuations(d, {'cap': 2})
            row = cache.get_or_generate('a', lambda: {'tokens': [3, 9], 'eos': True, 'truncated': False})
            self.assertEqual(row['tokens'], [3, 9])
            again = drift.Continuations(d, {'cap': 2}).get_or_generate('a', lambda: self.fail('must resume'))
            self.assertEqual(row, again)

    def test_first_tokens_and_trie_shared_prefix(self):
        masses = calibration.first_token_masses([.1, .2, .3, .4], {'assert': [0], 'hedge': [1], 'deny': [2]})
        self.assertAlmostEqual(masses['uncovered'], .4)
        with self.assertRaises(ValueError):
            calibration.first_token_masses([.5, .5], {'A': [0], 'H': [0]})
        calls = []
        def distribution(prefix):
            calls.append(prefix)
            return np.array([.2, .3, .5])
        masses = calibration.trie_masses({'A': [[0, 1], [0, 2], [0, 2]], 'H': [[1]], 'D': [[2, 0]]}, distribution)
        self.assertEqual(calls.count((0,)), 1)
        self.assertAlmostEqual(masses['A'], .16)
        self.assertAlmostEqual(masses['uncovered'], .44)
        with self.assertRaises(ValueError):
            calibration.trie_masses({'A': [[0]], 'H': [[0, 1]]}, distribution)

    def test_policy_ece_known_answer(self):
        result = calibration.policy_ece([[.8, .1, .1], [.2, .4, .4]], [1, 0])
        self.assertAlmostEqual(result['ece_policy'], .2)
        self.assertAlmostEqual(result['brier'], .04)
        self.assertEqual(sum(result['bin_counts']), 2)


class GridAnalysisTests(unittest.TestCase):
    def test_error_inclusive_formal_denominators_and_joint_success(self):
        from bench.slm.neural.analysis.metrics import outcomes
        result = outcomes({'M': [1, 1, 0, 1], 'F': [1, 0, 1, 1], 'P': [1]*4, 'G': [1]*4,
                           'A': [1, 1, 1, 0], 'H': [0, 0, 1, 1], 'J_K': [0, 1, 1, 0], 'R_k': [1]*4},
                          ['assert', 'assert', 'assert', 'abstain'], [1, 1, 1, 0], [0, 1, 1, 0])
        self.assertAlmostEqual(result['leakage']['value'], .5)
        self.assertEqual(result['leakage']['denominator'], 2)
        self.assertEqual(result['O']['value'], 0)
        self.assertAlmostEqual(result['Q'], 1/6)
        self.assertNotEqual(result['Q'], result['F']*result['U'])

    def test_stage_cli_refuses_implicit_checkpoint_loading(self):
        result = subprocess.run([str(Path.home()/'.venvs/rt-mlx/bin/python'), '-m', 'bench.slm.neural.run',
            'states', '--model', '/does-not-exist', '--prompts', '/does-not-exist', '--out', '/does-not-exist'],
            cwd=ROOT, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('--execute required', result.stderr)
        self.assertNotIn('metal::load_device', result.stderr)

    def test_partition_leakage_rejected(self):
        from bench.slm.neural.analyze import lock_partitions
        with self.assertRaises(ValueError):
            lock_partitions({'fit': [1, 2], 'selection': [2, 3], 'confirmation': [4]})
        self.assertEqual(lock_partitions({'fit': [1], 'selection': [2], 'confirmation': [3]})['fit'], {1})

    def test_all_22_manifests_against_saved_config(self):
        config = json.loads(CONFIG.read_text())
        self.assertEqual(len(grid.cells()), 22)
        for cell in grid.cells():
            manifest = grid.module_manifest(config, cell['placement'], cell['depth'], cell['rank'])
            self.assertEqual(manifest['count'], manifest['expected_count'])
            self.assertNotIn('model.embed_tokens.weight', manifest['tensors'])
            indices = manifest['block_indices_zero_based']
            if cell['depth'] == 'bottom':
                self.assertEqual(indices, list(range(14)))
            if cell['depth'] == 'top':
                self.assertEqual(indices, list(range(14, 28)))
        with self.assertRaises(ValueError):
            grid.module_manifest({**config, 'hidden_size': 512}, 'both', 'all', 4)

    def test_grid_associations_shared_resample_known_order(self):
        counts = np.arange(1, 19)
        outcomes = np.ones((40, 18))-counts[None, :]/100
        result = grid_associations(counts, outcomes, np.ones(40), np.repeat(np.arange(20), 2), replicates=100)
        self.assertAlmostEqual(result['spearman'], 1)
        self.assertAlmostEqual(result['tau_b'], 1)
        np.testing.assert_allclose(result['bootstrap'], 1.)
        self.assertEqual(tau_b([1, 1, 2], [0, 0, 1]), 1.)

    def test_paired_holm_and_root_multiplicity(self):
        roots = np.repeat(np.arange(20), 2)
        result = paired_contrasts(np.ones((40, 2))*.2, roots, replicates=100)
        np.testing.assert_allclose(result['estimate'], .2)
        self.assertTrue((result['holm_p'] < .05).all())
        np.testing.assert_allclose(holm([.01, .04, .03]), [.03, .06, .06])
        for sample in root_samples(roots, replicates=10):
            for r in np.unique(roots):
                n = np.sum(roots[sample] == r)
                self.assertEqual(n % 2, 0)

    def test_monotone_mapping_and_joint_equivalence(self):
        mapping = monotone_mapping([0, .5, 1], [.8, .5, .2], [-1, 0, 1], [.2, .5, .8])
        self.assertEqual(mapping['alpha'], [1, 0, -1])
        steering = np.tile(np.array([.2, .5, .8])[None, :, None], (40, 1, 4))
        training = steering[:, mapping['indices']].copy()
        roots = np.repeat(np.arange(20), 2)
        yes = mapped_equivalence(steering, training, mapping, roots, replicates=100)
        self.assertTrue(yes['equivalent'])
        no = mapped_equivalence(steering, training+.04, mapping, roots, replicates=100)
        self.assertFalse(no['equivalent'])

    def test_crossed_run_and_root_resampling(self):
        values = np.tile(np.array([0., 1.])[None, None, :], (3, 40, 1))
        for paired in (True, False):
            boot = crossed_bootstrap(values, np.repeat(np.arange(20), 2), lambda a: np.mean(a[:, 1]-a[:, 0]),
                                     replicates=30, paired_runs=paired)
            np.testing.assert_equal(boot, 1.)


if __name__ == '__main__':
    unittest.main()
