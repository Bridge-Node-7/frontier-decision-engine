import test from 'node:test';
import assert from 'node:assert/strict';
import { readOptionalNumber, readTrimmedText } from '../site/src/lib/input.js';
test('cleared text remains cleared',()=>assert.equal(readTrimmedText({value:'   '},'old'),''));
test('empty numeric input remains unset',()=>assert.equal(readOptionalNumber({value:''}),null));
test('finite numeric input is preserved',()=>assert.equal(readOptionalNumber({value:'42'}),42));
