#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { Store } from '../src/store.js'
import {
  listFeedback,
  readFeedback,
  setFeedbackStatus,
} from '../src/feedback.js'

try {
  const {
    values,
    positionals: [command = 'list', id],
  } = parseArgs({
    options: { root: { type: 'string' } },
    allowPositionals: true,
  })
  const store = new Store(values.root)
  let result
  if (command === 'list') result = await listFeedback(store)
  else if (command === 'read') result = await readFeedback(store, id)
  else if (command === 'resolve' || command === 'reopen')
    result = await setFeedbackStatus(
      store,
      id,
      command === 'resolve' ? 'resolved' : 'open',
    )
  else
    throw new Error(
      '用法：feedback.mjs list|read <ID>|resolve <ID>|reopen <ID> [--root 工作台数据目录]',
    )
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
