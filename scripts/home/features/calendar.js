(() => {
const {
  byId,
} = window.homeDom;
const {
  padTwoDigits,
} = window.homeUtil;
const {
  getActiveRandomEventKey,
  closeRandomEventWindow,
  openRandomEventWindow,
  randomEventWindow,
} = window.homeEventRuntime;
const {
  closeFelizJuevesWindow,
  isFelizJuevesVisible,
  showFelizJuevesWindow,
} = window.homeEventNotes;
const {
  runAfterHomeActivation,
} = window.homeActivation;
const {
  notifyActivity,
} = window.homeActivity;
const {
  registerCloseAllHook,
} = window.homeWindows;

const calendarButton = byId("taskbar-clock-button");
const calendarPopout = byId("calendar-popout");
const calendarSection = byId("calendar-section");
const calendarHeader = byId("calendar-header");
const calendarGrid = byId("calendar-grid");
const calendarPrev = byId("calendar-prev");
const calendarNext = byId("calendar-next");
const calendarClose = byId("calendar-close");
const calendarClock = byId("calendar-clock");
const clockImage = byId("clock-image");
const clockQuote = byId("clock-quote");

let calendarDate = new Date();

const updateCalendarClock = () => {
  if (!calendarClock || !calendarPopout.classList.contains("is-open")) return;
  const now = new Date();
  const hours = calendarClock.querySelector("[data-calendar-clock-hours]");
  const minutes = calendarClock.querySelector("[data-calendar-clock-minutes]");
  const seconds = calendarClock.querySelector("[data-calendar-clock-seconds]");
  if (hours) hours.textContent = padTwoDigits(now.getHours());
  if (minutes) minutes.textContent = padTwoDigits(now.getMinutes());
  if (seconds) seconds.textContent = padTwoDigits(now.getSeconds());
  const blinkOn = Math.floor(Date.now() / 500) % 2 === 0;
  calendarClock.querySelectorAll(".clock-colon").forEach((colon) => {
    colon.classList.toggle("is-off", !blinkOn);
  });
  updateClockImage(now);
};

const updateClockImage = (now) => {
  if (!clockImage || !calendarPopout.classList.contains("is-open")) return;
  const hour = now.getHours();
  let src = "assets/night.png";
  let label = "Night scene";

  if (hour >= 5 && hour < 7) {
    src = "assets/sunrise.png";
    label = "Sunrise scene";
  } else if (hour >= 7 && hour < 18) {
    src = "assets/day.png";
    label = "Day scene";
  } else if (hour >= 18 && hour < 20) {
    src = "assets/sunset.png";
    label = "Sunset scene";
  }

  if (clockImage.getAttribute("src") !== src) {
    clockImage.setAttribute("src", src);
    clockImage.setAttribute("alt", label);
  }
};

const calendarImages = {
  0: "assets/calendar-pics/jan.jpg",
  1: "assets/modeling/fast-devotion-lb-nov2023/IMG_0330.jpg",
  2: "assets/calendar-pics/mar-standstill.jpg",
  3: "assets/calendar-pics/apr-sonder-lb2.jpg",
  4: "assets/modeling/fast-reverie-lb-mar2024/02-reverie-photo.jpg",
  5: "assets/modeling/fast-crescendo-lb-oct2024/01-crescendo-photo.jpg",
  6: "assets/modeling/xoxo510-brainscramble/01-brainscramble-photo.jpg",
  7: "assets/modeling/club-rambutan-runway-show/01-rambutan-photo.jpg",
  8: "assets/modeling/garb-means-business-jan2025/1.jpg",
  9: "assets/modeling/vampire-shoot-jan2025/01-vampire-photo.jpg",
  10: "assets/modeling/saturn-LA-oct2023/IMG_9696.jpg",
  11: "assets/modeling/garb-garbage-rnwy-apr2025/1.JPEG",
};

const calendarImagePositions = {
  2: "center top",
  3: "center top",
  4: "center calc(100% + 30px)",
  5: "center top",
  7: "center top",
  9: "left center",
  10: "center top",
};

const calendarImageSizes = {
  9: "contain",
};

const calendarImageBackgrounds = {
  9: "#000",
};

const calendarQuotes = {
  0: `"Perhaps you were made for this moment, to walk through blazing fire and come forth as gold"<br>—Morgan Harper Nichols`,
  1: `"The gentle yield of water will cut obstinate stone"<br>—Lao Tzu`,
  2:
    `"Man will not merely endure: he will prevail. He is immortal, not because he alone among creatures has an inexhaustible voice, but because he has a soul, a spirit capable of compassion and sacrifice and endurance."<br>` +
    `—William Faulkner`,
  3:
    `"Happiness, like success, cannot be pursued; it must ensue, and it only does so as the unintended side-effect of dedication to a cause greater than oneself"<br>` +
    `—Viktor E. Frankl`,
  4: `"To plant a garden is to believe in tomorrow."<br>—Audrey Hepburn`,
  5:
    `"I took a deep breath and listened to the old brag of my heart. I am, I am, I am." ` +
    `—Sylvia Plath`,
  6: `"It takes great courage to see the world in all its tainted glory, and still to love it." —Oscar Wilde`,
  7: `"In the depth of winter, I finally learned that within me there lay an invincible summer. —Albert Camus`,
  8:
    `A human being should be able to change a diaper, plan an invasion, butcher a hog, conn a ship, ` +
    `design a building, write a sonnet, balance accounts, build a wall, set a bone, ` +
    `comfort the dying, take orders, give orders, cooperate, act alone, solve equations, ` +
    `analyze a new problem, pitch manure, program a computer, cook a tasty meal, ` +
    `fight efficiently, die gallantly. Specialization is for insects.<br>—Robert A. Heinlein`,
  9: `“I have no special talents. I am only passionately curious.”<br>—Albert Einstein`,
  10: `"Our life is shaped by our mind, for we become what we think."<br>—Buddha`,
  11: `"To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment"<br>—Ralph Waldo Emerson`,
};

const calendarEvents = {
  "0-1": {
    title: "New Year's Day",
    image: "assets/random%20events/newyear.gif",
  },
  "1-4": {
    title: "Cancer Awareness Day",
    image: "assets/random%20events/fcancer.gif",
  },
  "1-11": {
    title: "February 11",
    image: "assets/optimized/random-events/birthday.webp",
  },
  "1-14": {
    title: "Valentine's Day",
    image: "assets/optimized/random-events/valentine.webp",
  },
  "2-4": {
    title: "Where did she go?",
    image: "assets/random%20events/nana.gif",
  },
  "2-8": {
    title: "International Women's Day",
    image: "assets/random%20events/iwd.gif",
  },
  "2-31": {
    title: "Transgender Day of Visibility",
    image: "assets/optimized/random-events/trans.webp",
  },
  "3-20": {
    title: "April 20",
    image: "assets/random%20events/swed.gif",
  },
  "4-5": {
    title: "Cinco de Mayo",
    image: "assets/random%20events/cincodemayo.gif",
  },
  "5-1": {
    title: "Pride Month",
    image: "assets/random%20events/pridemonth.gif",
  },
  "5-19": {
    title: "Juneteenth",
    image: "assets/random%20events/juneteenth.gif",
  },
  "6-4": {
    title: "Fourth of July",
    image: "assets/optimized/random-events/4thofjuly.webp",
  },
  "6-5": {
    title: "July 5th",
    image: "assets/random%20events/jul5.png",
  },
  "8-11": {
    title: "September 11",
    image: "assets/random%20events/remembering911.gif",
  },
  "8-23": {
    title: "Bisexual Visibility Day",
    image:
      "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXRreml3ZDZodnJwZmVkYmIyaHY4bjBoOHkyc2ozdDR0cTJjZHpnOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/fJzFpWBj82lk1tW5RY/giphy.gif",
  },
  "9-31": {
    title: "Halloween",
    image: "assets/optimized/random-events/halloween.webp",
  },
  "10-2": {
    title: "Dia de los Muertos",
    image: "assets/random%20events/diadelosmuertos.gif",
  },
  "11-25": {
    title: "Christmas Day",
    image: "assets/random%20events/christmas.gif",
  },
};

const eidAlFitrEvent = {
  title: "Eid Mubarak",
  image: "assets/random%20events/eidmubarak.gif",
};

const chineseNewYearEvent = {
  title: "Chinese New Year",
  image: "assets/random%20events/chinesenewyear.gif",
};

const easterEvent = {
  title: "Easter Day",
  image: "assets/optimized/random-events/easter.webp",
};

const diwaliEvent = {
  title: "Diwali",
  image: "assets/random%20events/diwali.gif",
};

const ramadanEvent = {
  title: "Ramadan Starts",
  image: "assets/optimized/random-events/ramadan.webp",
};

const holiEvent = {
  title: "Holi",
  image: "assets/optimized/random-events/holi.webp",
};

const hanukkahEvent = {
  title: "Hanukkah",
  image: "assets/random%20events/hanukkah.gif",
};

const vesakEvent = {
  title: "Vesak Day",
  image: "assets/optimized/random-events/buddha.webp",
};

const thanksgivingEvent = {
  title: "Thanksgiving Day",
  image: "assets/random%20events/thanksgiving.gif",
};

const laborDayEvent = {
  title: "Labor Day",
  image: "assets/random%20events/laborday.gif",
};

const mothersDayEvent = {
  title: "Mother's Day",
  image: "assets/optimized/random-events/mothersday.webp",
};

const fathersDayEvent = {
  title: "Father's Day",
  image: "assets/optimized/random-events/fathersday.webp",
};

const onamEvent = {
  title: "Onam",
  image:
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjRoeGk1ZW51MGxuYjd1aDQxb3RlMmZodTBnOWlsYTA1cTFuZGZoOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XGLBlMvhA0PO9MEDmv/giphy.gif",
};

const pongalEvent = {
  title: "Pongal",
  image:
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMDVnNmphdHYxbTJoMDJjNXNmZHg3eW5pcHF1MDNkMWVjOGw3dmpocyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Ph5WvQ9jJKJGOVLpgD/giphy.gif",
};

const eidAlFitrDateOverrides = {
  2024: { month: 3, day: 10 },
  2025: { month: 2, day: 30 },
  2026: { month: 2, day: 20 },
  2027: { month: 2, day: 10 },
  2028: { month: 1, day: 27 },
  2029: { month: 1, day: 15 },
  2030: { month: 1, day: 5 },
  2031: { month: 0, day: 25 },
};

const chineseNewYearDateOverrides = {
  2024: { month: 1, day: 10 },
  2025: { month: 0, day: 29 },
  2026: { month: 1, day: 17 },
  2027: { month: 1, day: 6 },
  2028: { month: 0, day: 26 },
  2029: { month: 1, day: 13 },
  2030: { month: 1, day: 3 },
  2031: { month: 0, day: 23 },
  2032: { month: 1, day: 11 },
  2033: { month: 0, day: 31 },
  2034: { month: 1, day: 19 },
  2035: { month: 1, day: 8 },
  2036: { month: 0, day: 28 },
  2037: { month: 1, day: 15 },
  2038: { month: 1, day: 4 },
  2039: { month: 0, day: 24 },
  2040: { month: 1, day: 12 },
  2041: { month: 1, day: 1 },
  2042: { month: 0, day: 22 },
  2043: { month: 1, day: 10 },
};

const diwaliDateOverrides = {
  2024: { month: 9, day: 31 },
  2025: { month: 9, day: 20 },
  2026: { month: 10, day: 8 },
  2027: { month: 9, day: 28 },
  2028: { month: 9, day: 17 },
  2029: { month: 10, day: 5 },
  2030: { month: 9, day: 25 },
};

const ramadanStartDateOverrides = {
  2024: [{ month: 2, day: 12 }],
  2025: [{ month: 2, day: 1 }],
  2026: [{ month: 1, day: 18 }],
  2027: [{ month: 1, day: 8 }],
  2028: [{ month: 0, day: 28 }],
  2029: [{ month: 0, day: 16 }],
  2030: [
    { month: 0, day: 6 },
    { month: 11, day: 26 },
  ],
  2031: [{ month: 11, day: 15 }],
};

const holiDateOverrides = {
  2024: { month: 2, day: 25 },
  2025: { month: 2, day: 14 },
  2026: { month: 2, day: 3 },
  2027: { month: 2, day: 22 },
  2028: { month: 2, day: 11 },
  2029: { month: 1, day: 28 },
  2030: { month: 2, day: 19 },
};

const hanukkahDateOverrides = {
  2024: { month: 11, day: 26 },
  2025: { month: 11, day: 15 },
  2026: { month: 11, day: 5 },
  2027: { month: 11, day: 25 },
  2028: { month: 11, day: 13 },
  2029: { month: 11, day: 2 },
  2030: { month: 11, day: 21 },
  2031: { month: 11, day: 10 },
};

const vesakDateOverrides = {
  2024: { month: 4, day: 23 },
  2025: { month: 4, day: 12 },
  2026: { month: 4, day: 1 },
  2027: { month: 4, day: 20 },
  2028: { month: 4, day: 8 },
  2029: { month: 4, day: 27 },
  2030: { month: 4, day: 17 },
  2031: { month: 4, day: 7 },
};

const onamDateOverrides = {
  2024: { month: 8, day: 15 },
  2025: { month: 8, day: 5 },
  2026: { month: 7, day: 26 },
  2027: { month: 8, day: 12 },
  2028: { month: 8, day: 1 },
};

const pongalDateOverrides = {
  2024: { month: 0, day: 15 },
  2025: { month: 0, day: 14 },
  2026: { month: 0, day: 14 },
  2027: { month: 0, day: 15 },
  2028: { month: 0, day: 15 },
  2029: { month: 0, day: 14 },
  2030: { month: 0, day: 14 },
  2031: { month: 0, day: 15 },
};

let eidAlFitrFormatter = null;

try {
  eidAlFitrFormatter = new Intl.DateTimeFormat("en-u-ca-islamic-civil", {
    month: "numeric",
    day: "numeric",
  });
} catch (error) {
  eidAlFitrFormatter = null;
}

const eidAlFitrDateCache = new Map();

const getChineseNewYearDate = (year) =>
  chineseNewYearDateOverrides[year] || null;

const getDiwaliDate = (year) => diwaliDateOverrides[year] || null;

const getRamadanStartDates = (year) =>
  ramadanStartDateOverrides[year] || [];

const getHoliDate = (year) => holiDateOverrides[year] || null;

const getHanukkahDate = (year) => hanukkahDateOverrides[year] || null;

const getVesakDate = (year) => vesakDateOverrides[year] || null;

const getOnamDate = (year) => onamDateOverrides[year] || null;

const getPongalDate = (year) => pongalDateOverrides[year] || null;

const getThanksgivingDate = (year) => {
  const novemberFirst = new Date(year, 10, 1);
  const firstThursdayOffset = (4 - novemberFirst.getDay() + 7) % 7;
  return { month: 10, day: 1 + firstThursdayOffset + 21 };
};

const getLaborDayDate = (year) => {
  const septemberFirst = new Date(year, 8, 1);
  const firstMondayOffset = (1 - septemberFirst.getDay() + 7) % 7;
  return { month: 8, day: 1 + firstMondayOffset };
};

const getMothersDayDate = (year) => {
  const mayFirst = new Date(year, 4, 1);
  const firstSundayOffset = (7 - mayFirst.getDay()) % 7;
  return { month: 4, day: 1 + firstSundayOffset + 7 };
};

const getFathersDayDate = (year) => {
  const juneFirst = new Date(year, 5, 1);
  const firstSundayOffset = (7 - juneFirst.getDay()) % 7;
  return { month: 5, day: 1 + firstSundayOffset + 14 };
};

const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day };
};

const getIslamicMonthDay = (date) => {
  if (!eidAlFitrFormatter) return null;
  const parts = eidAlFitrFormatter.formatToParts(date);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!month || !day) return null;
  return { month, day };
};

const getEidAlFitrDate = (year) => {
  if (eidAlFitrDateOverrides[year]) return eidAlFitrDateOverrides[year];
  if (eidAlFitrDateCache.has(year)) return eidAlFitrDateCache.get(year);

  let match = null;
  const probe = new Date(year, 0, 1, 12);
  while (probe.getFullYear() === year) {
    const islamic = getIslamicMonthDay(probe);
    if (islamic && islamic.month === 10 && islamic.day === 1) {
      match = { month: probe.getMonth(), day: probe.getDate() };
      break;
    }
    probe.setDate(probe.getDate() + 1);
  }

  eidAlFitrDateCache.set(year, match);
  return match;
};

const updateCalendarQuote = (month) => {
  if (!clockQuote) return;
  const quote = calendarQuotes[month];
  if (quote) {
    clockQuote.innerHTML = quote;
  }
};

const updateCalendarBackground = (month) => {
  if (!calendarSection) return;
  const src = calendarImages[month] || "";
  calendarSection.style.backgroundImage = src ? `url("${src}")` : "none";
  calendarSection.style.backgroundPosition = calendarImagePositions[month] || "center";
  calendarSection.style.backgroundSize = calendarImageSizes[month] || "cover";
  calendarSection.style.backgroundColor = calendarImageBackgrounds[month] || "";
};

const closeCalendar = () => {
  if (!calendarPopout) return;
  calendarPopout.classList.remove("is-open");
  calendarPopout.setAttribute("aria-hidden", "true");
  if (calendarSection) {
    calendarSection.style.backgroundImage = "none";
    calendarSection.style.backgroundPosition = "center";
    calendarSection.style.backgroundSize = "";
    calendarSection.style.backgroundColor = "";
  }
  if (clockImage) clockImage.removeAttribute("src");
};

const clampCalendarDate = (date) => {
  const now = new Date();
  const minDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const maxDate = new Date(now.getFullYear() + 1, now.getMonth(), 1);
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
};

const getCalendarEventKey = (year, month, day) => `${year}-${month}-${day}`;

const getCalendarEvent = (year, month, day) => {
  const chineseNewYearDate = getChineseNewYearDate(year);
  if (
    chineseNewYearDate &&
    chineseNewYearDate.month === month &&
    chineseNewYearDate.day === day
  ) {
    return chineseNewYearEvent;
  }

  const eidAlFitrDate = getEidAlFitrDate(year);
  if (
    eidAlFitrDate &&
    eidAlFitrDate.month === month &&
    eidAlFitrDate.day === day
  ) {
    return eidAlFitrEvent;
  }

  const ramadanStartDates = getRamadanStartDates(year);
  if (
    ramadanStartDates.some(
      (ramadanDate) => ramadanDate.month === month && ramadanDate.day === day
    )
  ) {
    return ramadanEvent;
  }

  const holiDate = getHoliDate(year);
  if (holiDate && holiDate.month === month && holiDate.day === day) {
    return holiEvent;
  }

  const vesakDate = getVesakDate(year);
  if (vesakDate && vesakDate.month === month && vesakDate.day === day) {
    return vesakEvent;
  }

  const pongalDate = getPongalDate(year);
  if (pongalDate && pongalDate.month === month && pongalDate.day === day) {
    return pongalEvent;
  }

  const onamDate = getOnamDate(year);
  if (onamDate && onamDate.month === month && onamDate.day === day) {
    return onamEvent;
  }

  const easterDate = getEasterDate(year);
  if (easterDate.month === month && easterDate.day === day) {
    return easterEvent;
  }

  const diwaliDate = getDiwaliDate(year);
  if (diwaliDate && diwaliDate.month === month && diwaliDate.day === day) {
    return diwaliEvent;
  }

  const hanukkahDate = getHanukkahDate(year);
  if (hanukkahDate && hanukkahDate.month === month && hanukkahDate.day === day) {
    return hanukkahEvent;
  }

  const laborDayDate = getLaborDayDate(year);
  if (laborDayDate.month === month && laborDayDate.day === day) {
    return laborDayEvent;
  }

  const mothersDayDate = getMothersDayDate(year);
  if (mothersDayDate.month === month && mothersDayDate.day === day) {
    return mothersDayEvent;
  }

  const fathersDayDate = getFathersDayDate(year);
  if (fathersDayDate.month === month && fathersDayDate.day === day) {
    return fathersDayEvent;
  }

  const thanksgivingDate = getThanksgivingDate(year);
  if (
    thanksgivingDate.month === month &&
    thanksgivingDate.day === day
  ) {
    return thanksgivingEvent;
  }

  return calendarEvents[`${month}-${day}`] || null;
};

const appendCalendarCell = (text, className = "calendar-day") => {
  const cell = document.createElement("div");
  cell.className = className;
  cell.textContent = String(text);
  calendarGrid.appendChild(cell);
  return cell;
};

const buildCalendar = (date) => {
  const clampedDate = clampCalendarDate(date);
  calendarDate = clampedDate;
  const year = clampedDate.getFullYear();
  const month = clampedDate.getMonth();
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() === month;
  const today = now.getDate();
  const monthLabel = clampedDate.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  calendarHeader.textContent = monthLabel;
  calendarGrid.innerHTML = "";
  updateCalendarBackground(month);
  updateCalendarQuote(month);

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  dayLabels.forEach((label, index) => {
    const labelCell = appendCalendarCell(label);
    if (index === 4) {
      labelCell.classList.add("is-event-day");
      labelCell.dataset.calendarWeekday = "thursday";
      labelCell.setAttribute("data-custom-cursor-guard", "");
      labelCell.setAttribute("role", "button");
      labelCell.setAttribute("aria-label", "Feliz Jueves");
      labelCell.title = "Feliz Jueves";
    }
  });

  for (let i = startDay - 1; i >= 0; i -= 1) {
    appendCalendarCell(daysInPrevMonth - i, "calendar-day is-muted");
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isToday = isCurrentMonth && day === today;
    const calendarEvent = getCalendarEvent(year, month, day);
    const cell = appendCalendarCell(
      day,
      `calendar-day${isToday ? " is-today" : ""}${calendarEvent ? " is-event-day" : ""}`
    );
    cell.dataset.calendarDay = String(day);
    cell.dataset.calendarMonth = String(month);
    cell.dataset.calendarYear = String(year);
    cell.setAttribute("data-custom-cursor-guard", "");
  }

  const totalCells = dayLabels.length + startDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i += 1) {
    appendCalendarCell(i, "calendar-day is-muted");
  }
};

const openCalendar = ({ triggerEvent = true } = {}) => {
  if (!calendarPopout) return;
  calendarPopout.classList.add("is-open");
  calendarPopout.setAttribute("aria-hidden", "false");
  calendarDate = new Date();
  buildCalendar(calendarDate);
  updateCalendarClock();
  if (triggerEvent) {
    notifyActivity("calendarOpen");
  }
};

const toggleCalendar = () => {
  const isOpen = calendarPopout.classList.contains("is-open");
  if (isOpen) {
    closeCalendar();
    return;
  }

  openCalendar();
};

calendarButton.addEventListener("click", toggleCalendar);

if (calendarClose) {
  calendarClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeCalendar();
  });
}

calendarPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  const nextDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  buildCalendar(nextDate);
});

calendarNext.addEventListener("click", (event) => {
  event.stopPropagation();
  const nextDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  buildCalendar(nextDate);
});

calendarHeader.addEventListener("click", () => {
  buildCalendar(new Date());
});

calendarGrid.addEventListener("click", (event) => {
  const thursdayCell = event.target.closest("[data-calendar-weekday='thursday']");
  if (thursdayCell && calendarGrid.contains(thursdayCell)) {
    event.stopPropagation();
    if (isFelizJuevesVisible()) {
      closeFelizJuevesWindow();
      return;
    }
    showFelizJuevesWindow();
    return;
  }

  const dayCell = event.target.closest("[data-calendar-day]");
  if (!dayCell || !calendarGrid.contains(dayCell)) return;
  const eventMonth = Number(dayCell.dataset.calendarMonth);
  const eventDay = Number(dayCell.dataset.calendarDay);
  const eventYear = Number(dayCell.dataset.calendarYear);
  const eventKey = getCalendarEventKey(eventYear, eventMonth, eventDay);
  const calendarEvent = getCalendarEvent(eventYear, eventMonth, eventDay);
  if (calendarEvent) {
    event.stopPropagation();
    const isSameEventOpen =
      getActiveRandomEventKey() === eventKey &&
      randomEventWindow &&
      !randomEventWindow.classList.contains("is-hidden") &&
      randomEventWindow.getAttribute("aria-hidden") === "false";
    if (isSameEventOpen) {
      closeRandomEventWindow();
      return;
    }
    openRandomEventWindow(calendarEvent, eventKey);
  }
});

document.addEventListener("click", (event) => {
  if (!calendarPopout.classList.contains("is-open")) return;
  if (calendarPopout.contains(event.target)) return;
  if (calendarButton.contains(event.target)) return;
  closeCalendar();
});

const scheduleCalendarRefresh = () => {
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const delay = nextDay.getTime() - now.getTime() + 1000;
  setTimeout(() => {
    if (calendarPopout.classList.contains("is-open")) {
      calendarDate = new Date();
      buildCalendar(calendarDate);
    }
    scheduleCalendarRefresh();
  }, delay);
};

runAfterHomeActivation(scheduleCalendarRefresh);

// Closing every window from the Start button closes the calendar popout too.
registerCloseAllHook(() => closeCalendar());

window.homeCalendar = Object.freeze({
  calendarPopout,
  closeCalendar,
  openCalendar,
  updateCalendarClock,
});
})();
