import test from 'node:test'
import assert from 'node:assert/strict'
import { selectInputEngine, selectOutputEngine } from '../lib/speech-policy'
import { validateApiBase } from '../lib/api-base.mjs'

const input = { engine: 'auto' as const, nativeAndroid: false, canRecord: true, cloudAvailable: true, cloudFailed: false, browserAvailable: true, browserFailed: false }
const output = { engine: 'auto' as const, nativeAndroid: false, cloudAvailable: true, cloudFailed: false, matchingVoice: true }

test('Android never depends on Web Speech even if the APIs appear present', () => {
  for (const engine of ['auto', 'browser', 'cloud'] as const) {
    assert.equal(selectInputEngine({ ...input, engine, nativeAndroid: true, cloudFailed: true }), 'cloud')
    assert.equal(selectOutputEngine({ ...output, engine, nativeAndroid: true, cloudFailed: true }), 'cloud')
  }
})

test('web keeps independent cloud-to-browser fallbacks', () => {
  assert.equal(selectInputEngine(input), 'cloud')
  assert.equal(selectInputEngine({ ...input, cloudFailed: true }), 'browser')
  assert.equal(selectOutputEngine({ ...output, cloudFailed: true }), 'browser')
  assert.equal(selectOutputEngine(output), 'cloud')
})

test('missing browser recognition or Tamil voice selects cloud rather than assuming support', () => {
  assert.equal(selectInputEngine({ ...input, browserAvailable: false, cloudAvailable: false }), 'cloud')
  assert.equal(selectOutputEngine({ ...output, matchingVoice: false, cloudAvailable: false }), 'cloud')
  assert.equal(selectInputEngine({ ...input, canRecord: false }), 'browser')
})

test('explicit web engine overrides are respected', () => {
  assert.equal(selectInputEngine({ ...input, engine: 'browser' }), 'browser')
  assert.equal(selectOutputEngine({ ...output, engine: 'cloud', cloudFailed: true }), 'cloud')
})

test('mobile export requires a remote HTTPS origin and strips trailing slash', () => {
  assert.equal(validateApiBase('https://mozhi.example/'), 'https://mozhi.example')
  for (const value of [undefined, '', 'relative', 'http://mozhi.example', 'https://localhost', 'https://user:secret@mozhi.example', 'https://mozhi.example/api', 'https://mozhi.example?key=value', 'https://mozhi.example#fragment']) {
    assert.throws(() => validateApiBase(value))
  }
})
