import gsap from "gsap";
import { EASE } from "./motion.js";

// A month calendar in the site's own vocabulary rather than the browser's date picker, which
// paints its own chrome and cannot be styled. It is built from buttons, so it is reachable by
// keyboard, readable by a screen reader, and it wears the same cream, coral and paw marks as
// the rest of Pawtopia.

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Monday-first, so the grid matches how the week reads here
const leadingBlanks = (date) => (date.getDay() + 6) % 7;

export function formatDate(date) {
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function shortDate(date) {
  return `${DAY_NAMES[date.getDay()].slice(0, 3)} ${date.getDate()}`;
}

export function buildCalendar(root, { onSelect, today = new Date(), months = 6 } = {}) {
  if (!root) return null;
  const first = startOfDay(today);
  // a booking cannot be made for a day that has passed, and six months out is as far as the
  // clinic takes appointments
  const last = new Date(first.getFullYear(), first.getMonth() + months, 0);
  let view = new Date(first.getFullYear(), first.getMonth(), 1);
  let selected = null;

  root.innerHTML = `<div class="calendar-head">
      <button class="calendar-step" type="button" data-step="-1" aria-label="Previous month">&#8592;</button>
      <p class="calendar-month" aria-live="polite"></p>
      <button class="calendar-step" type="button" data-step="1" aria-label="Next month">&#8594;</button>
    </div>
    <div class="calendar-week" aria-hidden="true">${WEEKDAYS.map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="calendar-grid" role="grid" aria-label="Choose a day"></div>
    <p class="calendar-note">Appointments run 9am to 6pm. We confirm by email.</p>`;

  const monthLabel = root.querySelector(".calendar-month");
  const grid = root.querySelector(".calendar-grid");

  function render({ animate = true } = {}) {
    const year = view.getFullYear();
    const month = view.getMonth();
    monthLabel.textContent = `${MONTHS[month]} ${year}`;

    const days = new Date(year, month + 1, 0).getDate();
    const blanks = leadingBlanks(new Date(year, month, 1));
    let markup = "";
    for (let blank = 0; blank < blanks; blank += 1) markup += '<span class="calendar-day is-empty" role="none"></span>';
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(year, month, day);
      const past = date < first;
      const beyond = date > last;
      const state = [
        sameDay(date, first) ? "is-today" : "",
        sameDay(date, selected) ? "is-selected" : "",
      ].join(" ").trim();
      markup += `<button class="calendar-day ${state}" type="button" role="gridcell" data-day="${day}"${past || beyond ? " disabled" : ""} aria-label="${formatDate(date)}" aria-selected="${sameDay(date, selected)}">${day}</button>`;
    }
    grid.innerHTML = markup;

    // the first and last months of the range have nowhere further to step
    root.querySelector('[data-step="-1"]').disabled = year === first.getFullYear() && month === first.getMonth();
    root.querySelector('[data-step="1"]').disabled = year === last.getFullYear() && month === last.getMonth();

    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(grid.querySelectorAll(".calendar-day:not(.is-empty)"), { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: .3, stagger: .008, ease: EASE.art, overwrite: true });
  }

  root.addEventListener("click", (event) => {
    const step = event.target.closest("[data-step]");
    if (step) {
      view = new Date(view.getFullYear(), view.getMonth() + Number(step.dataset.step), 1);
      render();
      return;
    }
    const cell = event.target.closest("[data-day]");
    if (!cell || cell.disabled) return;
    selected = new Date(view.getFullYear(), view.getMonth(), Number(cell.dataset.day));
    render({ animate: false });
    onSelect?.(selected);
  });

  // arrow keys walk the grid the way a date picker should, a week at a time up and down
  grid.addEventListener("keydown", (event) => {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const move = steps[event.key];
    if (!move) return;
    event.preventDefault();
    const cells = [...grid.querySelectorAll("[data-day]")];
    const index = cells.indexOf(document.activeElement);
    if (index < 0) { cells.find((cell) => !cell.disabled)?.focus(); return; }
    const next = cells[index + move];
    if (next && !next.disabled) { next.focus(); return; }
    // walking off the edge turns the month, and focus lands on the same weekday beyond it
    const forward = move > 0;
    const stepButton = root.querySelector(`[data-step="${forward ? 1 : -1}"]`);
    if (stepButton?.disabled) return;
    view = new Date(view.getFullYear(), view.getMonth() + (forward ? 1 : -1), 1);
    render({ animate: false });
    const after = [...grid.querySelectorAll("[data-day]:not([disabled])")];
    (forward ? after[0] : after[after.length - 1])?.focus();
  });

  render({ animate: false });

  return {
    // reopening lands on the month the reader last chose in, not wherever they browsed to
    show(date) {
      const target = date && date >= first && date <= last ? date : first;
      view = new Date(target.getFullYear(), target.getMonth(), 1);
      render({ animate: false });
    },
    focusFirst() {
      (grid.querySelector(".is-selected") || grid.querySelector("[data-day]:not([disabled])"))?.focus();
    },
    reset() {
      selected = null;
      view = new Date(first.getFullYear(), first.getMonth(), 1);
      render({ animate: false });
    },
  };
}
