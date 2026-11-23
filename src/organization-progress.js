// Track material delivered by the workbench, not the Agent's arguments or its claims.
// Result order, pagination tokens, readAt and randomly generated batch IDs are not work.
export function organizationProgress() {
  const seen = new Set(),
    ends = new Map()
  return function observe(exec, value, review) {
    let advanced = false
    const remember = (kind, id, version = '') => {
      if (id == null || id === '') return
      const key = JSON.stringify([kind, id, version])
      if (!seen.has(key)) {
        seen.add(key)
        advanced = true
      }
    }
    const action =
      exec.name === 'workbench_organize_inspect'
        ? exec.arguments?.action
        : exec.name
    // The first empty directory/search is information; another empty search isn't.
    remember('operation', action)
    for (const group of [
      'tasks',
      'collaborations',
      'inbox',
      'knowledge',
      'sessions',
      'hits',
    ]) {
      for (const row of value?.[group] || []) {
        const id = row.id ?? row.ref ?? row.key ?? row.sessionId
        // A search hit identifies a message, not its containing chat or its snippet.
        if (group === 'hits') remember(group, row.key)
        else remember(group, id, row.updatedAt || '')
      }
    }
    const page = value?.page || value
    const messages = page?.message ? [page.message] : page?.messages || []
    for (const row of messages) {
      if (!row.key || typeof row.text !== 'string' || !row.text.length) continue
      const id = row.key,
        end = (row.textOffset ?? row.offset ?? 0) + row.text.length
      // Both readers deliver long messages sequentially before allowing look-back.
      if (end > (ends.get(id) || 0)) {
        ends.set(id, end)
        advanced = true
      }
    }
    if (exec.name === 'workbench_learn_write' && value?.ok) {
      for (const session of review?.sessions || [])
        remember(
          'saved position',
          [session.source, session.sessionId],
          [session.index, session.offset],
        )
      for (const item of value.created || []) remember('saved entry', item.id)
    }
    return advanced
  }
}
