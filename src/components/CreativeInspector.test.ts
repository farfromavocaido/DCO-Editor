import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

test('initializes component inspector geometry before its component return path', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/CreativeInspector.tsx'), 'utf8');
  const geometry = source.indexOf('const actualGeometry=renderedGeometry(selectedTarget.id);');
  const motion = source.indexOf('const motionOwner=motionGeometry(document,size,selectedTarget.id,activeScopes,playhead);');
  const componentReturn = source.indexOf("if (selectedTarget.kind === 'component' || componentLink) {");

  expect(geometry).toBeGreaterThan(-1);
  expect(motion).toBeGreaterThan(-1);
  expect(componentReturn).toBeGreaterThan(-1);
  expect(geometry).toBeLessThan(componentReturn);
  expect(motion).toBeLessThan(componentReturn);
});
