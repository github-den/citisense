import { useState, useRef, useEffect } from 'react';
import { CalendarBlank, CaretLeft, CaretRight, Funnel, X } from '@phosphor-icons/react';
import styles from './DateRangePicker.module.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const YEAR_PAGE   = 12;

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }
function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isBetween(date, start, end) {
  if (!start || !end || !date) return false;
  const d = date.getTime(), s = Math.min(start.getTime(), end.getTime()), e = Math.max(start.getTime(), end.getTime());
  return d > s && d < e;
}
function formatLabel(start, end) {
  if (!start && !end) return null;
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (start && !end) return fmt(start);
  if (isSameDay(start, end)) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

// Returns true if the given date is strictly after today (calendar day comparison)
function isAfterToday(date) {
  const t = new Date();
  if (date.getFullYear() > t.getFullYear()) return true;
  if (date.getFullYear() < t.getFullYear()) return false;
  if (date.getMonth() > t.getMonth()) return true;
  if (date.getMonth() < t.getMonth()) return false;
  return date.getDate() > t.getDate();
}
function isMonthAfterToday(year, month) {
  const t = new Date();
  return year > t.getFullYear() || (year === t.getFullYear() && month > t.getMonth());
}
function isYearAfterToday(year) {
  return year > new Date().getFullYear();
}

// ─── YEAR GRID PANEL ──────────────────────────────────────────────────────────
function YearPicker({ currentYear, onSelect }) {
  const todayYear = new Date().getFullYear();
  const base = Math.floor(currentYear / YEAR_PAGE) * YEAR_PAGE;
  const [page, setPage] = useState(base);
  const years = Array.from({ length: YEAR_PAGE }, (_, i) => page + i);
  const canGoNext = page + YEAR_PAGE - 1 < todayYear; // only go next if some future page years are ≤ today

  return (
    <div>
      <div className={styles.header}>
        <button type="button" className={styles.navBtn} onClick={() => setPage(p => p - YEAR_PAGE)}>
          <CaretLeft size={14} weight="bold" />
        </button>
        <span className={styles.monthLabel}>{page} – {Math.min(page + YEAR_PAGE - 1, todayYear)}</span>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setPage(p => p + YEAR_PAGE)}
          disabled={!canGoNext}
          style={!canGoNext ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
      <div className={styles.pickGrid}>
        {years.map(y => {
          const future = isYearAfterToday(y);
          return (
            <button
              key={y}
              type="button"
              disabled={future}
              className={`${styles.pickCell} ${y === currentYear ? styles.pickCellActive : ''} ${y === todayYear ? styles.pickCellToday : ''} ${future ? styles.pickCellDisabled : ''}`}
              onClick={() => !future && onSelect(y)}
            >
              {y}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MONTH GRID PANEL ─────────────────────────────────────────────────────────
function MonthPicker({ currentMonth, currentYear, onSelect, onYearClick, onPrevYear, onNextYear }) {
  const today = new Date();
  const canGoNextYear = currentYear < today.getFullYear();

  return (
    <div>
      <div className={styles.header}>
        <button type="button" className={styles.navBtn} onClick={onPrevYear}>
          <CaretLeft size={14} weight="bold" />
        </button>
        <button type="button" className={styles.headerTextBtn} onClick={onYearClick} title="Pick year">
          {currentYear}
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={onNextYear}
          disabled={!canGoNextYear}
          style={!canGoNextYear ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
      <div className={styles.pickGrid}>
        {MONTH_SHORT.map((name, idx) => {
          const isActive  = idx === currentMonth;
          const isToday   = idx === today.getMonth() && currentYear === today.getFullYear();
          const future    = isMonthAfterToday(currentYear, idx);
          return (
            <button
              key={name}
              type="button"
              disabled={future}
              className={`${styles.pickCell} ${isActive ? styles.pickCellActive : ''} ${isToday && !isActive ? styles.pickCellToday : ''} ${future ? styles.pickCellDisabled : ''}`}
              onClick={() => !future && onSelect(idx)}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DateRangePicker({ value, onChange, placeholder = 'Date posted' }) {
  const today    = new Date();
  const [open,      setOpen]      = useState(false);
  const [view,      setView]      = useState('day');
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hovered,   setHovered]   = useState(null);
  const rootRef = useRef(null);

  const start    = value?.start ?? null;
  const end      = value?.end   ?? null;
  const hasValue = !!(start || end);
  const label    = formatLabel(start, end);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setView('day');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function handleDayClick(day) {
    const clicked = new Date(viewYear, viewMonth, day);
    if (isAfterToday(clicked)) return; // block future dates
    if (!start || (start && end)) {
      onChange({ start: clicked, end: null });
    } else {
      if (clicked < start) onChange({ start: clicked, end: start });
      else onChange({ start, end: clicked });
      setOpen(false);
      setView('day');
    }
  }

  function clearDates(e) {
    e.stopPropagation();
    onChange({ start: null, end: null });
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    // Block navigating to future months
    if (viewYear === today.getFullYear() && viewMonth >= today.getMonth()) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const isNextMonthFuture = viewYear === today.getFullYear() && viewMonth >= today.getMonth()
    || viewYear > today.getFullYear();

  // Build day grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay    = getFirstDayOfMonth(viewYear, viewMonth);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className={styles.root} ref={rootRef}>
      {/* TRIGGER */}
      <button
        type="button"
        className={`${styles.trigger} ${hasValue ? styles.triggerActive : ''}`}
        onClick={() => { setOpen(o => !o); setView('day'); }}
      >
        <CalendarBlank size={16} weight="bold" color={hasValue ? 'var(--brand)' : 'var(--text-3)'} />
        <span className={styles.triggerLabel}>{label ?? placeholder}</span>
        {hasValue ? (
          <span className={styles.clearBtn} onClick={clearDates} title="Clear dates">
            <X size={13} weight="bold" />
          </span>
        ) : (
          <Funnel size={14} weight="bold" color="var(--text-3)" />
        )}
      </button>

      {/* PANEL */}
      {open && (
        <div className={styles.panel}>

          {/* ── YEAR VIEW ─────────────────────────── */}
          {view === 'year' && (
            <YearPicker
              currentYear={viewYear}
              onSelect={y => { setViewYear(y); setView('month'); }}
            />
          )}

          {/* ── MONTH VIEW ────────────────────────── */}
          {view === 'month' && (
            <MonthPicker
              currentMonth={viewMonth}
              currentYear={viewYear}
              onSelect={m => { setViewMonth(m); setView('day'); }}
              onYearClick={() => setView('year')}
              onPrevYear={() => setViewYear(y => y - 1)}
              onNextYear={() => {
                if (viewYear < today.getFullYear()) setViewYear(y => y + 1);
              }}
            />
          )}

          {/* ── DAY VIEW ─────────────────────────── */}
          {view === 'day' && (
            <>
              <div className={styles.header}>
                <button type="button" className={styles.navBtn} onClick={prevMonth}>
                  <CaretLeft size={14} weight="bold" />
                </button>

                <div className={styles.headerLabels}>
                  <button type="button" className={styles.headerTextBtn} onClick={() => setView('month')} title="Pick month">
                    {MONTH_NAMES[viewMonth]}
                  </button>
                  <button type="button" className={styles.headerTextBtn} onClick={() => setView('year')} title="Pick year">
                    {viewYear}
                  </button>
                </div>

                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={nextMonth}
                  disabled={isNextMonthFuture}
                  style={isNextMonthFuture ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                >
                  <CaretRight size={14} weight="bold" />
                </button>
              </div>

              <div className={styles.dayHeaders}>
                {DAY_NAMES.map(d => <span key={d} className={styles.dayName}>{d}</span>)}
              </div>

              <div className={styles.grid}>
                {cells.map((day, idx) => {
                  if (!day) return <span key={`b-${idx}`} />;
                  const date    = new Date(viewYear, viewMonth, day);
                  const future  = isAfterToday(date);
                  const isStart = isSameDay(date, start);
                  const isEnd   = isSameDay(date, end);
                  // Only show hover range if hovered is not a future date
                  const hoveredSafe = hovered && !isAfterToday(hovered) ? hovered : null;
                  const inRange = isBetween(date, start, hoveredSafe ?? end);
                  const isToday = isSameDay(date, today);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={future}
                      className={[
                        styles.day,
                        isStart || isEnd ? styles.daySelected : '',
                        inRange          ? styles.dayInRange  : '',
                        isToday && !isStart && !isEnd ? styles.dayToday : '',
                        future           ? styles.dayDisabled : '',
                      ].filter(Boolean).join(' ')}
                      onMouseEnter={() => { if (!future && start && !end) setHovered(date); }}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => handleDayClick(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* FOOTER */}
          {view === 'day' && (start || end) && (
            <div className={styles.footer}>
              <span className={styles.footerRange}>
                {label ?? (start ? 'Select end date…' : '')}
              </span>
              {start && end && (
                <button type="button" className={styles.clearLink} onClick={clearDates}>Clear</button>
              )}
            </div>
          )}
          {view === 'day' && start && !end && (
            <div className={styles.footer}>
              <span className={styles.footerHint}>Select end date…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
