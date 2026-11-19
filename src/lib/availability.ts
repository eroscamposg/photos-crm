export type WeeklyRule = {
  weekday: number;
  startTime: string;
  endTime: string;
};
export type DateOverride = {
  date: string;
  status: "open" | "closed";
  startTime: string | null;
  endTime: string | null;
};
export type BusyRange = {
  date: string;
  startTime: string;
  endTime: string;
  status: string;
};

export function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

export function fromMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function weekdayIndex(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

export function isTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function windowsForDate(
  date: string,
  weekday: number,
  rules: WeeklyRule[],
  overrides: DateOverride[],
) {
  const override = overrides.find((item) => item.date === date);
  if (override?.status === "closed") return [];
  if (override?.status === "open") {
    return [
      {
        startTime: override.startTime ?? "09:00",
        endTime: override.endTime ?? "17:00",
      },
    ];
  }
  return rules
    .filter((rule) => rule.weekday === weekday)
    .map((rule) => ({ startTime: rule.startTime, endTime: rule.endTime }));
}

export function slotsForDate(options: {
  date: string;
  weekday: number;
  durationMinutes: number;
  rules: WeeklyRule[];
  overrides: DateOverride[];
  busy: BusyRange[];
}) {
  const windows = windowsForDate(
    options.date,
    options.weekday,
    options.rules,
    options.overrides,
  );
  const taken = options.busy.filter(
    (item) => item.date === options.date && item.status !== "cancelled",
  );
  const slots: string[] = [];
  for (const window of windows) {
    const start = minutes(window.startTime);
    const end = minutes(window.endTime);
    for (
      let cursor = start;
      cursor + options.durationMinutes <= end;
      cursor += options.durationMinutes
    ) {
      // NOTE: Take out this piece of code in order to shown taken daates hours, but shown themgreyed out
      const slotEnd = cursor + options.durationMinutes;
      const overlap = taken.some((item) => {
        const busyStart = minutes(item.startTime);
        const busyEnd = minutes(item.endTime);
        return cursor < busyEnd && slotEnd > busyStart;
      });
      if (!overlap) slots.push(fromMinutes(cursor));
      slots.push(fromMinutes(cursor));
    }
  }

  return slots;
}

export function monthDates(year: number, month: number) {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${year}-${String(month).padStart(2, "0")}-${day}`;
  });
}

export function addMonths(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
