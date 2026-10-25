import assert from 'node:assert/strict'
import test from 'node:test'
import { moveItemToTarget } from '../src/lib/reorder.mjs'

const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (list) => list.map((item) => item.id).join('')

test('moveItemToTarget moves an item down into the target position', () => {
  assert.equal(ids(moveItemToTarget(items, 'a', 'c')), 'bcad')
})

test('moveItemToTarget moves an item up into the target position', () => {
  assert.equal(ids(moveItemToTarget(items, 'd', 'b')), 'adbc')
})

test('moveItemToTarget moves to the ends of the list', () => {
  assert.equal(ids(moveItemToTarget(items, 'b', 'd')), 'acdb')
  assert.equal(ids(moveItemToTarget(items, 'c', 'a')), 'cabd')
})

test('moveItemToTarget does not mutate the input', () => {
  const result = moveItemToTarget(items, 'a', 'd')
  assert.notEqual(result, items)
  assert.equal(ids(items), 'abcd')
})

test('moveItemToTarget returns the same list for no-op or unknown ids', () => {
  assert.equal(moveItemToTarget(items, 'b', 'b'), items)
  assert.equal(moveItemToTarget(items, 'x', 'b'), items)
  assert.equal(moveItemToTarget(items, 'b', 'x'), items)
})
