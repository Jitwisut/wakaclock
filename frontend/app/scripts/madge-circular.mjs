import madge from 'madge';

const roots = ['app', 'components', 'lib', 'hooks'];

const graph = await madge(roots, {
  fileExtensions: ['ts', 'tsx'],
  tsConfig: 'tsconfig.json',
});

const circular = graph.circular();

if (circular.length === 0) {
  console.log('OK No circular dependency found.');
} else {
  console.error(`ERROR Found ${circular.length} circular dependencies.\n`);
  circular
    .map((cycle) => cycle.join(' > '))
    .sort((a, b) => a.localeCompare(b))
    .forEach((cycle, index) => {
      console.error(`${index + 1}) ${cycle}`);
    });

  process.exitCode = 1;
}

if (process.env.MADGE_SHOW_SKIPPED === '1') {
  const { skipped } = graph.warnings();
  if (skipped.length > 0) {
    const localPrefixes = ['app/', 'components/', 'hooks/', 'lib/', './', '../'];
    const localSkipped = skipped.filter((entry) =>
      localPrefixes.some((prefix) => entry.startsWith(prefix))
    );
    const externalSkipped = skipped.filter((entry) => !localSkipped.includes(entry));

    console.error(`\n== Madge Skipped ==\n`);

    if (localSkipped.length > 0) {
      console.error(`ERROR Skipped local files: ${localSkipped.length}\n`);
      console.error(localSkipped.join('\n'));
      process.exitCode ??= 1;
    }

    if (externalSkipped.length > 0) {
      console.error(`\nWARN Skipped external modules: ${externalSkipped.length}\n`);
      console.error(externalSkipped.join('\n'));
    }
  }
}
