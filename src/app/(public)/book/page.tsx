import { eq } from "drizzle-orm";
import { BookingForm } from "@/components/booking-form";
import { Card } from "@/components/ui";
import { db } from "@/db";
import {
  availabilityRules,
  bookings,
  dateOverrides,
  sessionTypes,
} from "@/db/schema";
import {
  addMonths,
  monthDates,
  monthLabel,
  slotsForDate,
  weekdayIndex,
} from "@/lib/availability";
import { getPublicStudio } from "@/lib/studio";
export const dynamic = "force-dynamic";
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    month?: string;
    date?: string;
    time?: string;
    sent?: string;
  }>;
}) {
  const params = await searchParams;
  const studio = await getPublicStudio();
  if (!studio) return <p>Booking is not open yet.</p>;
  if (params.sent)
    return (
      <Card>
        <h1 className="font-serif text-4xl">Request received.</h1>
        <p className="mt-3 text-stone-700">
          The studio will confirm the time. If email is not configured, the
          request still appears on the calendar.
        </p>
      </Card>
    );

  const active = (
    await db
      .select()
      .from(sessionTypes)
      .where(eq(sessionTypes.studioId, studio.id))
  ).filter((type) => type.active);

  const selectedType =
    active.find((type) => type.id === params.type) ?? active[0];
  const now = new Date();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [yearText, monthText] = (params.month ?? fallback).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const dates = monthDates(year, month);

  const rules = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.studioId, studio.id));

  const overrides = (
    await db
      .select()
      .from(dateOverrides)
      .where(eq(dateOverrides.studioId, studio.id))
  ).map((item) => ({
    date: item.date,
    status: item.status === "closed" ? ("closed" as const) : ("open" as const),
    startTime: item.startTime,
    endTime: item.endTime,
  }));

  const busy = await db
    .select()
    .from(bookings)
    .where(eq(bookings.studioId, studio.id));
  const slotsByDate = new Map(
    dates.map((date) => [
      date,
      selectedType
        ? slotsForDate({
            date,
            weekday: weekdayIndex(date),
            durationMinutes: selectedType.durationMinutes,
            rules,
            overrides,
            busy,
          })
        : [],
    ]),
  );

  const selectedDate =
    params.date && (slotsByDate.get(params.date)?.length ?? 0) > 0
      ? params.date
      : null;
  const times = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];
  const selectedTime =
    params.time &&
    times.some((slot) => slot.time === params.time && !slot.taken)
      ? params.time
      : null;

  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const monthParam = `${year}-${String(month).padStart(2, "0")}`;
  const query = (extra: Record<string, string>) => {
    const search = new URLSearchParams({ month: monthParam, ...extra });
    if (selectedType) search.set("type", selectedType.id);
    return `/book?${search.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-5xl">Book a session</h1>
        <p className="mt-3 max-w-xl text-stone-700">
          Only dates the studio left open can be requested. A request holds that
          slot until it is cancelled.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {active.map((type) => (
          <a
            key={type.id}
            href={`/book?type=${type.id}&month=${monthParam}`}
            className={`rounded-full px-4 py-2 text-sm ${type.id === selectedType?.id ? "bg-accent text-accent-foreground" : "border border-line bg-card"}`}
          >
            {type.name} · {type.durationMinutes} min
          </a>
        ))}
      </div>
      {selectedType ? (
        <p className="max-w-xl text-sm text-muted">
          {selectedType.description}
        </p>
      ) : null}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <a
            className="text-sm underline"
            href={`/book?type=${selectedType?.id ?? ""}&month=${prev.year}-${String(prev.month).padStart(2, "0")}`}
          >
            Previous
          </a>
          <h2 className="font-serif text-2xl">{monthLabel(year, month)}</h2>
          <a
            className="text-sm underline"
            href={`/book?type=${selectedType?.id ?? ""}&month=${next.year}-${String(next.month).padStart(2, "0")}`}
          >
            Next
          </a>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: weekdayIndex(dates[0] ?? "2026-01-01") }).map(
            (_, index) => (
              <span key={index} />
            ),
          )}
          {dates.map((date) => {
            const open = (slotsByDate.get(date) ?? []).length > 0;
            const className = `rounded-xl px-2 py-3 text-center text-sm ${date === selectedDate ? "bg-accent text-accent-foreground" : open ? "bg-white" : "bg-stone-200/60 text-muted"}`;
            return open ? (
              <a key={date} href={query({ date })} className={className}>
                {Number(date.slice(-2))}
              </a>
            ) : (
              <span key={date} className={className}>
                {Number(date.slice(-2))}
              </span>
            );
          })}
        </div>
      </Card>
      {selectedDate ? (
        <div className="flex flex-wrap gap-2">
          {times.map(({ time, taken }) => {
            const isSelected = time === selectedTime;

            if (taken) {
              return (
                <span
                  key={time}
                  aria-disabled="true"
                  className="cursor-not-allowed rounded-full border border-line bg-card px-4 py-2 text-sm opacity-40 line-through"
                >
                  {time}
                </span>
              );
            }

            return (
              <a
                key={time}
                href={query({ date: selectedDate, time })}
                className={`rounded-full px-4 py-2 text-sm ${
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "border border-line bg-card"
                }`}
              >
                {time}
              </a>
            );
          })}
        </div>
      ) : null}

      {selectedType && selectedDate && selectedTime ? (
        <Card>
          <h2 className="mb-3 font-serif text-2xl">Your details</h2>
          <BookingForm
            sessionTypeId={selectedType.id}
            date={selectedDate}
            startTime={selectedTime}
          />
        </Card>
      ) : null}
    </div>
  );
}
