/**
 * Japanese public holidays (祝日) utility.
 * Supports calculation-based and fixed holidays, including substitute holidays (振替休日).
 */

// Fixed-date holidays: [month, day, name]
const FIXED_HOLIDAYS: [number, number, string][] = [
  [1, 1, '元日'],
  [2, 11, '建国記念の日'],
  [2, 23, '天皇誕生日'],
  [4, 29, '昭和の日'],
  [5, 3, '憲法記念日'],
  [5, 4, 'みどりの日'],
  [5, 5, 'こどもの日'],
  [8, 11, '山の日'],
  [11, 3, '文化の日'],
  [11, 23, '勤労感謝の日'],
]

// Happy Monday holidays: [month, weekNumber (1-indexed), name]
const HAPPY_MONDAY_HOLIDAYS: [number, number, string][] = [
  [1, 2, '成人の日'],    // 1月第2月曜
  [7, 3, '海の日'],      // 7月第3月曜
  [9, 3, '敬老の日'],    // 9月第3月曜
  [10, 2, 'スポーツの日'], // 10月第2月曜
]

// Spring/Autumn equinox dates by year (approximate formula-based)
function getVernalEquinox(year: number): number {
  // 春分の日 calculation (valid ~1900-2099)
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

function getAutumnalEquinox(year: number): number {
  // 秋分の日 calculation (valid ~1900-2099)
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

/** Get the Nth Monday of a given month/year (1-indexed) */
function getNthMonday(year: number, month: number, n: number): number {
  const first = new Date(year, month - 1, 1)
  const firstDay = first.getDay() // 0=Sun
  // Days until the first Monday
  const daysToMonday = (8 - firstDay) % 7 || 7
  return daysToMonday + (n - 1) * 7
}

/** Build holiday map for a given year: Map<"MM-DD", holidayName> */
function buildYearHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>()
  const key = (m: number, d: number) => `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Fixed holidays
  for (const [m, d, name] of FIXED_HOLIDAYS) {
    holidays.set(key(m, d), name)
  }

  // Happy Monday holidays
  for (const [m, n, name] of HAPPY_MONDAY_HOLIDAYS) {
    const day = getNthMonday(year, m, n)
    holidays.set(key(m, day), name)
  }

  // Equinox holidays
  const vernal = getVernalEquinox(year)
  holidays.set(key(3, vernal), '春分の日')

  const autumnal = getAutumnalEquinox(year)
  holidays.set(key(9, autumnal), '秋分の日')

  // 振替休日 (substitute holiday): if a holiday falls on Sunday, next non-holiday weekday is a holiday
  const allDates = [...holidays.entries()].map(([md, name]) => {
    const [m, d] = md.split('-').map(Number)
    return { m, d, name }
  })

  for (const { m, d } of allDates) {
    const date = new Date(year, m - 1, d)
    if (date.getDay() === 0) { // Sunday
      // Find next day that's not already a holiday
      let subDay = d + 1
      while (holidays.has(key(m, subDay))) {
        subDay++
      }
      holidays.set(key(m, subDay), '振替休日')
    }
  }

  // 国民の休日: a day sandwiched between two holidays becomes a holiday
  // Main case: Sep equinox week (敬老の日 and 秋分の日 can sandwich a day)
  const keirouDay = getNthMonday(year, 9, 3)
  if (autumnal - keirouDay === 2) {
    const between = keirouDay + 1
    if (!holidays.has(key(9, between))) {
      holidays.set(key(9, between), '国民の休日')
    }
  }

  return holidays
}

// Cache holiday maps per year
const cache = new Map<number, Map<string, string>>()

function getYearHolidays(year: number): Map<string, string> {
  if (!cache.has(year)) {
    cache.set(year, buildYearHolidays(year))
  }
  return cache.get(year)!
}

/**
 * Get the holiday name for a given date string (YYYY-MM-DD), or null if not a holiday.
 */
export function getHolidayName(dateStr: string): string | null {
  const year = parseInt(dateStr.slice(0, 4), 10)
  const md = dateStr.slice(5) // "MM-DD"
  return getYearHolidays(year).get(md) ?? null
}
