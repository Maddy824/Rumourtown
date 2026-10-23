# Model size sensitivity with grounded prompts

Same strategy and exact probe IDs throughout each split. Types are exclusive. Failure shares condition on failure; task incidences use all requested tasks. These are descriptive comparisons of different checkpoints, not causal effects of parameter count. The two Qwen 4B variants have different thinking behavior. See the main CSV for the remaining categories.

| Model | Split | Failures/tasks | Wrong-act/failures | Over-refusal/failures | Invention/failures | Wrong-source/failures | Invention/tasks | Wrong-source/tasks |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| llama3-2-1b | test-seed | 47/77 | 28/47 | 9/47 | 2/47 | 2/47 | 2/77 | 2/77 |
| llama3-2-1b | test-mechanism | 36/66 | 9/36 | 0/36 | 15/36 | 8/36 | 15/66 | 8/66 |
| llama3-2-3b | test-seed | 59/77 | 49/59 | 1/59 | 6/59 | 0/59 | 6/77 | 0/77 |
| llama3-2-3b | test-mechanism | 42/66 | 20/42 | 0/42 | 10/42 | 10/42 | 10/66 | 10/66 |
| gemma3-1b | test-seed | 71/77 | 53/71 | 0/71 | 6/71 | 4/71 | 6/77 | 4/77 |
| gemma3-1b | test-mechanism | 57/66 | 28/57 | 0/57 | 22/57 | 3/57 | 22/66 | 3/66 |
| gemma3-4b | test-seed | 74/77 | 67/74 | 0/74 | 2/74 | 2/74 | 2/77 | 2/77 |
| gemma3-4b | test-mechanism | 62/66 | 25/62 | 0/62 | 32/62 | 3/62 | 32/66 | 3/66 |
| qwen3-0-6b | test-seed | 55/77 | 37/55 | 7/55 | 9/55 | 1/55 | 9/77 | 1/77 |
| qwen3-0-6b | test-mechanism | 34/66 | 16/34 | 0/34 | 3/34 | 0/34 | 3/66 | 0/66 |
| qwen3-1-7b | test-seed | 59/77 | 37/59 | 2/59 | 11/59 | 3/59 | 11/77 | 3/77 |
| qwen3-1-7b | test-mechanism | 36/66 | 13/36 | 0/36 | 15/36 | 5/36 | 15/66 | 5/66 |
| qwen3-4b-instruct | test-seed | 72/77 | 54/72 | 0/72 | 8/72 | 4/72 | 8/77 | 4/77 |
| qwen3-4b-instruct | test-mechanism | 56/66 | 8/56 | 0/56 | 20/56 | 24/56 | 20/66 | 24/66 |
| qwen3-4b | test-seed | 77/77 | 0/77 | 0/77 | 0/77 | 0/77 | 0/77 | 0/77 |
| qwen3-4b | test-mechanism | 66/66 | 0/66 | 0/66 | 0/66 | 0/66 | 0/66 | 0/66 |
| phi4-mini-latest | test-seed | 51/77 | 26/51 | 0/51 | 9/51 | 5/51 | 9/77 | 5/77 |
| phi4-mini-latest | test-mechanism | 43/66 | 12/43 | 0/43 | 23/43 | 1/43 | 23/66 | 1/66 |
