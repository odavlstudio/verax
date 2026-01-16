import { extractExpectations } from '../src/cli/util/expectation-extractor.js';
import { resolve } from 'path';

console.log('=== Testing demo-react ===\n');
let projectProfile = {
  framework: 'react-cra',
  sourceRoot: resolve('./demos/demo-react')
};

let result = await extractExpectations(projectProfile, './demos/demo-react');
console.log('Total expectations:', result.expectations.length);
result.expectations.forEach((exp, i) => {
  console.log(`${i+1}. [${exp.category || exp.type}] ${exp.promise.kind}:${exp.promise.value}`);
  console.log(`   ${exp.source.file}:${exp.source.line}`);
});

console.log('\n=== Testing demo-nextjs ===\n');
projectProfile = {
  framework: 'nextjs',
  router: 'app',
  sourceRoot: resolve('./demos/demo-nextjs')
};

result = await extractExpectations(projectProfile, './demos/demo-nextjs');
console.log('Total expectations:', result.expectations.length);
result.expectations.forEach((exp, i) => {
  console.log(`${i+1}. [${exp.category || exp.type}] ${exp.promise.kind}:${exp.promise.value}`);
  console.log(`   ${exp.source.file}:${exp.source.line}`);
  if (exp.selector) console.log(`   selector: ${exp.selector}`);
});
