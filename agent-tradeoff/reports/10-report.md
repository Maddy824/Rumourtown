# Task 10: readable conversations and player-written stories

STATUS: DONE

The map shows at most two ambient speech bubbles on desktop and one on phones or while inspecting someone. Lines stay readable for longer. Following a rumor hides ambient bubbles and shows one actual transmission with named endpoints, a reached count, Previous/Next controls and Watch live. History is collected from dawn rather than from belief updates, which also include corrections. Rewinding reconstructs the trail. The map leaves room for the panel on desktop and phones.

The whisper sheet starts with a writing field. Players can write up to 100 characters and explicitly choose subject, category and weight, or expand the existing suggestions. This works locally without credentials or external requests. Player prose travels in bounded, validated claim ids and survives replay links and research exports. It is rendered as text. Written claims do not receive authored evidence simply for sharing a broad category. The optional interpreter Worker remains separate; the current form does not call it. README, architecture, deployment and research notes describe the distinction.

Validation:

- Root typechecking, 546 tests in 35 files, production build and asset gate passed. Assets: 307,580 gzip bytes against 400,000.
- Chrome: typed a new story, followed it through 294 tellings and 23 recipients in seed 731 by tick 801, reopened its link, stepped backward, resumed, and rewound to the first telling. These counts are a scenario check, not empirical evidence.
- Keyboard writing focus, modal focus containment, close focus restoration, subject/listener rejection, literal markup text, 360-pixel layout, and bubble caps checked. No browser errors or external requests.
- Existing 900-tick raw replay is identical on Node 22, Node 25 and Chrome: 4,307 events, SHA-256 `2b87d54c36d5823230d99b58eb1f296c40b024de93e5681e41a87e061a81e020`.
- Generated build-info files remain unstaged.

Limits: category and subject are user choices, not language understanding. Trail endpoints show current positions; historical speech coordinates remain in the research export. The reached count measures transmission recipients, not belief. Existing share size caps can retain only a recent suffix in a very long run. Public hosting remains a separate launch action.

Next: task 11 expands the world and its population, as requested during final verification.
