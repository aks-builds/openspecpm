const SECTIONS = [
  {
    title: 'Setup',
    rows: [
      ['init', 'Interactive wizard to pick a PM tool and write .openspecpm/config.json'],
      ['doctor [adapter]', 'Diagnose auth + tooling; English remediation hints'],
    ],
  },
  {
    title: 'Plan',
    rows: [
      ['propose <feature>', 'Author proposal.md, design.md, tasks.md, specs/ via OpenSpec'],
      ['decompose <feature>', 'Extract tasks from proposal + BDD scenarios into tasks.md'],
    ],
  },
  {
    title: 'Sync',
    rows: [
      ['sync <feature>', 'Push to PM tool (idempotent, BDD-linted)'],
      ['comment <feature> <task>', 'Broadcast progress.md (or --message) to the PM tool'],
      ['reconcile <feature>', 'Pull remote state back into local frontmatter'],
      ['bug-report <feature> <task>', 'File a regression against a shipped task'],
    ],
  },
  {
    title: 'Track',
    rows: [
      ['status', 'Per-change task counts'],
      ['standup [--since 24h]', 'Recent progress.md updates, newest first'],
      ['next [-l 5]', 'Tasks ready to start (no unmet deps)'],
      ['blocked', 'Tasks waiting on unmet deps'],
      ['validate', 'Schema + dependency + BDD-lint sweep across every change'],
      ['search <query>', 'Grep across changes, specs, progress notes'],
    ],
  },
  {
    title: 'Execute / Ship',
    rows: [
      ['fan-out <feature>', 'Emit parallel-agent prompts for parallel:true tasks'],
      ['ship <feature>', 'Close every task + epic + archive the OpenSpec change'],
    ],
  },
];

export function runHelp({ topic } = {}) {
  if (topic) {
    const section = SECTIONS.find((s) => s.title.toLowerCase() === topic.toLowerCase());
    if (!section) {
      process.stdout.write(`Unknown topic "${topic}". Try: ${SECTIONS.map((s) => s.title.toLowerCase()).join(', ')}\n`);
      return;
    }
    print([section]);
    return;
  }
  process.stdout.write('OpenSpecPM — command reference by phase\n\n');
  print(SECTIONS);
  process.stdout.write('\nDetails: `openspecpm <command> --help` (Commander auto-help).\n');
  process.stdout.write('Skill docs: skill/openspecpm/references/{plan,structure,sync,execute,track}.md\n');
}

function print(sections) {
  const w = Math.max(...sections.flatMap((s) => s.rows.map((r) => r[0].length))) + 2;
  for (const s of sections) {
    process.stdout.write(`\n[${s.title}]\n`);
    for (const [cmd, desc] of s.rows) {
      process.stdout.write(`  ${cmd.padEnd(w)} ${desc}\n`);
    }
  }
}
