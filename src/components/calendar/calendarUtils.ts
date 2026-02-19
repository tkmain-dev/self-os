import type { ScheduleItem, GoalItem, CalendarEvent, GoalTreeNode, BandSegment } from './calendarTypes'

export const formatDate = (d: Date): string => d.toISOString().split('T')[0]

export const WEEKDAY_LABELS_SHORT = ['月', '火', '水', '木', '金', '土', '日']
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// ── Band layout constants ──
const LEAF_HEIGHT = 20      // px for leaf nodes (task/subtask with text)
const NEST_PAD_TOP = 13     // px top padding inside parent (room for title text)
const NEST_PAD_BOTTOM = 2   // px bottom padding inside parent
const BAND_GAP = 2          // px gap between sibling bands
const EDGE_INSET = 0.5      // % inset from cell edges for soft boundaries

/**
 * Returns a 6x7 grid of date strings for the given month (Monday-start).
 */
export function getMonthGrid(year: number, month: number): string[][] {
  const firstDay = new Date(year, month - 1, 1)
  const dow = (firstDay.getDay() + 6) % 7
  const startDate = new Date(year, month - 1, 1 - dow)

  const grid: string[][] = []
  for (let week = 0; week < 6; week++) {
    const row: string[] = []
    for (let day = 0; day < 7; day++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + week * 7 + day)
      row.push(formatDate(d))
    }
    grid.push(row)
  }
  return grid
}

/**
 * Returns 7 date strings for the week containing dateStr (Monday-start).
 */
export function getWeekDays(dateStr: string): string[] {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - dow)

  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    days.push(formatDate(day))
  }
  return days
}

export function getMonthRange(year: number, month: number): { from: string; to: string } {
  const grid = getMonthGrid(year, month)
  return { from: grid[0][0], to: grid[5][6] }
}

export function getWeekRange(dateStr: string): { from: string; to: string } {
  const days = getWeekDays(dateStr)
  return { from: days[0], to: days[6] }
}

export function getDayRange(dateStr: string): { from: string; to: string } {
  return { from: dateStr, to: dateStr }
}

export function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24))
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

/**
 * Merges schedules and goals into a unified CalendarEvent array.
 */
export function mergeEvents(schedules: ScheduleItem[] | null, goals: GoalItem[] | null): CalendarEvent[] {
  const events: CalendarEvent[] = []

  if (schedules) {
    for (const s of schedules) {
      events.push({
        type: 'schedule',
        id: s.id,
        title: s.title,
        date: s.date,
        startTime: s.start_time ?? undefined,
        endTime: s.end_time ?? undefined,
        color: 'amber',
        original: s,
      })
    }
  }

  if (goals) {
    for (const g of goals) {
      events.push({
        type: 'goal',
        id: g.id,
        title: g.title,
        date: g.start_date,
        endDate: g.end_date,
        color: g.color,
        status: g.status,
        issueType: g.issue_type,
        original: g,
      })
    }
  }

  return events
}

// ── Goal tree building ──

/**
 * Build a tree from flat GoalItem[] using parent_id relationships.
 * Goals whose parent is not in the array are treated as roots.
 */
export function buildGoalTree(goals: GoalItem[]): GoalTreeNode[] {
  const map = new Map<number, GoalTreeNode>()
  const roots: GoalTreeNode[] = []

  for (const g of goals) {
    map.set(g.id, { goal: g, children: [], depth: 0 })
  }

  for (const g of goals) {
    const node = map.get(g.id)!
    if (g.parent_id && map.has(g.parent_id)) {
      map.get(g.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function setDepth(node: GoalTreeNode, d: number) {
    node.depth = d
    node.children.sort((a, b) => a.goal.sort_order - b.goal.sort_order)
    for (const c of node.children) setDepth(c, d + 1)
  }
  for (const r of roots) setDepth(r, 0)

  roots.sort((a, b) => a.goal.sort_order - b.goal.sort_order)
  return roots
}

/**
 * Assign nodes to horizontal lanes based on date overlap.
 * Non-overlapping nodes share a lane to save vertical space.
 */
function assignLanes(nodes: GoalTreeNode[]): { laneMap: Map<number, number>; numLanes: number } {
  if (nodes.length === 0) return { laneMap: new Map(), numLanes: 0 }
  const sorted = [...nodes].sort((a, b) => a.goal.start_date.localeCompare(b.goal.start_date))
  const laneEnds: string[] = []
  const laneMap = new Map<number, number>()
  for (const node of sorted) {
    const start = node.goal.start_date
    let assigned = -1
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] < start) {
        assigned = i
        laneEnds[i] = node.goal.end_date
        break
      }
    }
    if (assigned === -1) {
      assigned = laneEnds.length
      laneEnds.push(node.goal.end_date)
    }
    laneMap.set(node.goal.id, assigned)
  }
  return { laneMap, numLanes: laneEnds.length }
}

/**
 * Calculate the pixel height a tree node needs (including all descendants).
 * Optionally scoped to a date range so only visible children are considered.
 */
export function calcNodeHeight(node: GoalTreeNode, weekStart?: string, weekEnd?: string): number {
  if (node.children.length === 0) return LEAF_HEIGHT
  const children = (weekStart && weekEnd)
    ? node.children.filter(c => c.goal.start_date <= weekEnd && c.goal.end_date >= weekStart)
    : node.children
  if (children.length === 0) return LEAF_HEIGHT
  const { laneMap, numLanes } = assignLanes(children)
  const laneHeights = new Array(numLanes).fill(0)
  for (const child of children) {
    const lane = laneMap.get(child.goal.id)!
    laneHeights[lane] = Math.max(laneHeights[lane], calcNodeHeight(child, weekStart, weekEnd))
  }
  let total = NEST_PAD_TOP + NEST_PAD_BOTTOM
  for (let i = 0; i < numLanes; i++) {
    if (i > 0) total += BAND_GAP
    total += laneHeights[i]
  }
  return Math.max(LEAF_HEIGHT, total)
}

/**
 * Layout goal tree nodes as positioned band segments for a given week.
 * Returns flat list of BandSegment with absolute positions.
 */
export function layoutWeekBands(
  roots: GoalTreeNode[],
  weekStart: string,
  weekEnd: string,
): BandSegment[] {
  const segments: BandSegment[] = []

  function layoutLevel(nodes: GoalTreeNode[], topOffset: number) {
    const visible = nodes.filter(n =>
      n.goal.start_date <= weekEnd && n.goal.end_date >= weekStart
    )
    if (visible.length === 0) return

    const { laneMap, numLanes } = assignLanes(visible)

    const laneHeights = new Array(numLanes).fill(0)
    for (const node of visible) {
      const lane = laneMap.get(node.goal.id)!
      laneHeights[lane] = Math.max(laneHeights[lane], calcNodeHeight(node, weekStart, weekEnd))
    }

    const laneY: number[] = []
    let y = topOffset
    for (let i = 0; i < numLanes; i++) {
      laneY.push(y)
      y += laneHeights[i] + BAND_GAP
    }

    for (const node of visible) {
      const g = node.goal
      const lane = laneMap.get(g.id)!
      const nodeY = laneY[lane]
      const height = calcNodeHeight(node, weekStart, weekEnd)

      const colStart = Math.max(0, diffDays(weekStart, g.start_date))
      const colEnd = Math.min(6, diffDays(weekStart, g.end_date))

      const left = (colStart / 7) * 100 + EDGE_INSET
      const width = ((colEnd - colStart + 1) / 7) * 100 - EDGE_INSET * 2

      segments.push({
        id: g.id,
        left,
        width: Math.max(width, 2),
        top: nodeY,
        height,
        depth: node.depth,
        issueType: g.issue_type,
        title: g.title,
        hasChildren: node.children.length > 0,
        goal: g,
      })

      if (node.children.length > 0) {
        layoutLevel(node.children, nodeY + NEST_PAD_TOP)
      }
    }
  }

  layoutLevel(roots, 0)
  return segments
}

/**
 * Calculate total height of the band overlay area for a week.
 */
export function calcWeekBandsHeight(roots: GoalTreeNode[], weekStart: string, weekEnd: string): number {
  const visible = roots.filter(r =>
    r.goal.start_date <= weekEnd && r.goal.end_date >= weekStart
  )
  if (visible.length === 0) return 0

  const { laneMap, numLanes } = assignLanes(visible)
  const laneHeights = new Array(numLanes).fill(0)
  for (const node of visible) {
    const lane = laneMap.get(node.goal.id)!
    laneHeights[lane] = Math.max(laneHeights[lane], calcNodeHeight(node, weekStart, weekEnd))
  }

  let total = 0
  for (let i = 0; i < numLanes; i++) {
    if (i > 0) total += BAND_GAP
    total += laneHeights[i]
  }
  return total
}
