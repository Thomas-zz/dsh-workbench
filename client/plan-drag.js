import React from 'react'
import { getDesk, setDesk } from './desk.js'
import { send, time, minutes } from './plan-shared.jsx'

const TYPE = 'application/x-workbench-task'
let highlighted = [],
  indicator,
  ghost,
  arrivalTimer,
  feedbackTimer
function clearTarget() {
  highlighted.forEach((el) =>
    el.classList.remove('is-drop-target', 'is-drop-before'),
  )
  highlighted = []
  indicator?.remove()
  indicator = null
}
export function endPlanDrag() {
  clearTarget()
  ghost?.remove()
  ghost = null
  if (getDesk().planDrag) setDesk({ planDrag: null, planDropMessage: '' })
}
export function drag(event, task) {
  if (getDesk().planMoving) {
    event.preventDefault()
    return
  }
  event.dataTransfer.setData(TYPE, task.id)
  event.dataTransfer.effectAllowed = 'move'
  const root = event.currentTarget.closest('.wb-root')
  ghost = document.createElement('div')
  ghost.className = 'wb-drag-ghost'
  const title = document.createElement('strong'),
    meta = document.createElement('span')
  title.textContent = task.title
  meta.textContent = `${minutes(task.estimateMinutes || 30)} · 拖到日期安排`
  ghost.append(title, meta)
  ;(root || document.body).appendChild(ghost)
  event.dataTransfer.setDragImage(ghost, 24, 20)
  setDesk({
    planDrag: { id: task.id, title: task.title },
    planDropMessage: '拖到日期安排，按 Esc 取消',
  })
}
export async function moveTask(id, date, beforeId, startMinute, week) {
  const state = getDesk().state,
    task = state.tasks.find((t) => t.id === id)
  endPlanDrag()
  if (
    !task ||
    id === beforeId ||
    getDesk().planMoving
  )
    return
  if (!date && !week && !beforeId && !task.plannedDate && !task.plannedWeek) return
  if (startMinute === undefined)
    startMinute = task.plannedDate === date ? task.startMinute : null
  if (
    task.kind === 'goal' &&
    date &&
    state.tasks.some(
      (t) =>
        t.parentId === id && t.plannedDate === date && t.title === task.title,
    )
  )
    return
  setDesk({ planMoving: id, planDropMessage: '正在保存安排…' })
  try {
    const result = await send(
      task.kind === 'goal' && date
        ? [
            {
              op: 'add_task',
              title: task.title,
              kind: 'action',
              parentId: id,
              project: task.project,
              plannedDate: date,
              startMinute,
              estimateMinutes: task.estimateMinutes,
              order: Date.now(),
            },
          ]
        : [
            {
              op: 'plan_move',
              id,
              date: date || null,
              week,
              beforeId,
              startMinute,
            },
          ],
      '拖动安排',
    )
    if (!result || result.errors?.length) {
      setDesk({ planDropMessage: '保存失败，事项留在原处，请重试' })
      return
    }
    const arrived = result.targets?.[0] || id
    setDesk({
      planArrived: arrived,
      planDropMessage: date
        ? `已安排到 ${date.slice(5)}${Number.isFinite(startMinute) ? ` ${time(startMinute)}` : ''}，可在顶部撤销`
        : week
          ? `已安排到 ${week.slice(5)} 所在周`
          : '已移回待安排',
    })
    clearTimeout(arrivalTimer)
    arrivalTimer = setTimeout(() => setDesk({ planArrived: null }), 900)
  } finally {
    setDesk({ planMoving: null })
    clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => setDesk({ planDropMessage: '' }), 4000)
  }
}
export function acceptDrop(event, date, beforeId, startMinute, week) {
  const id = event.dataTransfer.getData(TYPE)
  if (!id) return
  event.preventDefault()
  event.stopPropagation()
  void moveTask(id, date, beforeId, startMinute, week)
}

export function usePlanDrag(root, state) {
  const previous = React.useRef(new Map())
  React.useLayoutEffect(() => {
    const next = new Map()
    root.current?.querySelectorAll('[data-plan-id]').forEach((el) => {
      const key = el.dataset.planId,
        rect = el.getBoundingClientRect(),
        old = previous.current.get(key)
      next.set(key, rect)
      if (
        old &&
        getDesk().planArrived &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        const x = old.x - rect.x,
          y = old.y - rect.y
        if ((x || y) && Math.abs(x) < innerWidth && Math.abs(y) < innerHeight)
          el.animate(
            [
              { transform: `translate(${x}px,${y}px)` },
              { transform: 'translate(0,0)' },
            ],
            { duration: 200, easing: 'cubic-bezier(.22,1,.36,1)' },
          )
      }
    })
    previous.current = next
  }, [state.tasks])
  React.useEffect(() => {
    let frame, point
    const tick = () => {
      if (!getDesk().planDrag) {
        frame = null
        return
      }
      if (point) {
        const surface = point.target.closest(
          '.wb-backlog-items,.wb-plan-surface,.pd-pool-items',
        )
        if (surface && root.current?.contains(surface)) {
          const r = surface.getBoundingClientRect(),
            edge = 44
          const velocity = (p, a, b) =>
            p < a + edge
              ? -Math.ceil((a + edge - p) / 5)
              : p > b - edge
                ? Math.ceil((p - b + edge) / 5)
                : 0
          surface.scrollLeft += velocity(point.x, r.left, r.right)
          surface.scrollTop += velocity(point.y, r.top, r.bottom)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    const over = (e) => {
      if (!getDesk().planDrag || !root.current?.contains(e.target)) {
        clearTarget()
        point = null
        return
      }
      point = { x: e.clientX, y: e.clientY, target: e.target }
      if (!frame) frame = requestAnimationFrame(tick)
      const target = e.target.closest(
        '[data-drop-date],[data-drop-week],[data-drop-backlog]',
      )
      clearTarget()
      if (!target || target.dataset.dropDisabled === 'true') {
        e.dataTransfer.dropEffect = 'none'
        return
      }
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      target.classList.add('is-drop-target')
      highlighted.push(target)
      const before = e.target.closest('[data-drop-before]')
      if (before && before.dataset.planId !== getDesk().planDrag.id) {
        before.classList.add('is-drop-before')
        highlighted.push(before)
      }
      const lane = e.target.closest('.wb-plan-time-lane')
      const date = target.dataset.dropDate
      indicator = document.createElement('div')
      indicator.className = 'wb-drop-indicator'
      if (lane) {
        const at = Math.max(
          0,
          Math.min(
            1425,
            Math.round((e.clientY - lane.getBoundingClientRect().top) / 15) *
              15,
          ),
        )
        indicator.classList.add('is-time')
        indicator.style.top = `${at}px`
        indicator.textContent = `放到 ${date?.slice(5)} · ${time(at)}`
        lane.appendChild(indicator)
      } else {
        indicator.textContent = target.hasAttribute('data-drop-backlog')
          ? '移回待安排'
          : date
            ? `放到 ${date.slice(5)}${before ? ' · 插入此项之前' : ''}`
            : '安排到这一周'
        target.appendChild(indicator)
      }
    }
    const stop = () => {
      point = null
      cancelAnimationFrame(frame)
      frame = null
      endPlanDrag()
    }
    const key = (e) => {
      if (e.key === 'Escape') stop()
    }
    document.addEventListener('dragover', over)
    document.addEventListener('dragend', stop)
    document.addEventListener('drop', stop)
    document.addEventListener('keydown', key)
    window.addEventListener('blur', stop)
    return () => {
      stop()
      document.removeEventListener('dragover', over)
      document.removeEventListener('dragend', stop)
      document.removeEventListener('drop', stop)
      document.removeEventListener('keydown', key)
      window.removeEventListener('blur', stop)
    }
  }, [])
}
