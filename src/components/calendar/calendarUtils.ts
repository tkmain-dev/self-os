import type { ScheduleItem, GoalItem, CalendarEvent, GoalTreeNode, BandSegment } from './calendarTypes'

export const formatDate = (d: Date): string => d.toISOString().split('T')[0]

export const WEEKDAY_LABELS_SHORT = ['月', '火', '水', '木', '金', '土', '日']
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// ── Band layout constants ──
const LEAF_HEIGHT = 20      // px for leaf nodes (task/subtask with text)
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
 * Collect leaf nodes (no children) from the goal tree with Epic/Story ancestor context.
 * Task/Subtask parents are ignored — only Epic and Story ancestors are tracked.
 */
export function collectLeaves(
  nodes: GoalTreeNode[],
  epicTitle: string | null = null,
  storyTitle: string | null = null,
): { node: GoalTreeNode; epicTitle: string | null; storyTitle: string | null }[] {
  const leaves: { node: GoalTreeNode; epicTitle: string | null; storyTitle: string | null }[] = []
  for (const n of nodes) {
    if (n.children.length === 0) {
      leaves.push({ node: n, epicTitle, storyTitle })
    } else {
      const nextEpic = n.goal.issue_type === 'epic' ? n.goal.title : epicTitle
      const nextStory = n.goal.issue_type === 'story' ? n.goal.title : storyTitle
      leaves.push(...collectLeaves(n.children, nextEpic, nextStory))
    }
  }
  return leaves
}

/**
 * Layout leaf-only goal bands for a given week.
 * Returns flat list of BandSegment with absolute positions (no nesting).
 */
export function layoutWeekBands(
  roots: GoalTreeNode[],
  weekStart: string,
  weekEnd: string,
): BandSegment[] {
  const allLeaves = collectLeaves(roots)
  const visible = allLeaves.filter(({ node }) =>
    node.goal.start_date <= weekEnd && node.goal.end_date >= weekStart
  )
  if (visible.length === 0) return []

  const visibleNodes = visible.map(v => v.node)
  const { laneMap, numLanes } = assignLanes(visibleNodes)

  const laneY: number[] = []
  let y = 0
  for (let i = 0; i < numLanes; i++) {
    laneY.push(y)
    y += LEAF_HEIGHT + BAND_GAP
  }

  const segments: BandSegment[] = []
  for (const { node, epicTitle, storyTitle } of visible) {
    const g = node.goal
    const lane = laneMap.get(g.id)!

    const colStart = Math.max(0, diffDays(weekStart, g.start_date))
    const colEnd = Math.min(6, diffDays(weekStart, g.end_date))

    const left = (colStart / 7) * 100 + EDGE_INSET
    const width = ((colEnd - colStart + 1) / 7) * 100 - EDGE_INSET * 2

    segments.push({
      id: g.id,
      left,
      width: Math.max(width, 2),
      top: laneY[lane],
      height: LEAF_HEIGHT,
      depth: node.depth,
      issueType: g.issue_type,
      title: g.title,
      hasChildren: false,
      epicTitle,
      storyTitle,
      goal: g,
    })
  }

  return segments
}

/**
 * Calculate total height of the leaf-only band overlay area for a week.
 */
export function calcWeekBandsHeight(roots: GoalTreeNode[], weekStart: string, weekEnd: string): number {
  const allLeaves = collectLeaves(roots)
  const visible = allLeaves.filter(({ node }) =>
    node.goal.start_date <= weekEnd && node.goal.end_date >= weekStart
  )
  if (visible.length === 0) return 0

  const visibleNodes = visible.map(v => v.node)
  const { numLanes } = assignLanes(visibleNodes)

  return numLanes * LEAF_HEIGHT + (numLanes - 1) * BAND_GAP
}
