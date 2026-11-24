import { eq } from "drizzle-orm";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
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
import { requireStaff } from "@/lib/studio";
import {
  saveOverride,
  saveSessionType,
  saveWeeklyRules,
  setBookingStatus,
} from "@/server/actions";
export const dynamic = "force-dynamic";
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireStaff();
  const now = new Date();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [yearText, monthText] = (params.month ?? fallback).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const dates = monthDates(year, month);
  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const types = await db
    .select()
    .from(sessionTypes)
    .where(eq(sessionTypes.studioId, ctx.studio.id));
  const rules = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.studioId, ctx.studio.id));
  const overrides = await db
    .select()
    .from(dateOverrides)
    .where(eq(dateOverrides.studioId, ctx.studio.id));
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.studioId, ctx.studio.id));
  const selected =
    params.date && dates.includes(params.date) ? params.date : dates[0];
  const mapped = overrides.map((item) => ({
    date: item.date,
    status: item.status === "closed" ? ("closed" as const) : ("open" as const),
    startTime: item.startTime,
    endTime: item.endTime,
  }));
  const openDays = new Set(
    dates.filter(
      (date) =>
        slotsForDate({
          date,
          weekday: weekdayIndex(date),
          durationMinutes: types[0]?.durationMinutes ?? 60,
          rules,
          overrides: mapped,
          busy: rows,
        }).length > 0,
    ),
  );
  const monthParam = `${year}-${String(month).padStart(2, "0")}`;
  const ruleByDay = new Map(rules.map((rule) => [rule.weekday, rule]));
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-4xl">Calendar</h1>
        <p className="mt-2 text-stone-700">
          Weekly hours, a closed or specially open date, and the requests that
          occupy a slot.
        </p>
        {params.error ? (
          <p className="mt-2 text-sm text-red-800">
            Check the hours or session length and try again.
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <a
              className="text-sm underline"
              href={`/calendar?month=${prev.year}-${String(prev.month).padStart(2, "0")}`}
            >
              Previous
            </a>
            <h2 className="font-serif text-2xl">{monthLabel(year, month)}</h2>
            <a
              className="text-sm underline"
              href={`/calendar?month=${next.year}-${String(next.month).padStart(2, "0")}`}
            >
              Next
            </a>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted">
            {days.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {Array.from({ length: weekdayIndex(dates[0]) }).map((_, index) => (
              <span key={index} />
            ))}
            {dates.map((date) => (
              <a
                key={date}
                href={`/calendar?month=${monthParam}&date=${date}`}
                className={`rounded-xl px-2 py-3 text-sm ${date === selected ? "bg-accent text-accent-foreground" : openDays.has(date) ? "bg-white" : "bg-stone-200/70 text-muted"}`}
              >
                {Number(date.slice(-2))}
              </a>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {rows
              .filter((booking) => booking.date === selected)
              .map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm"
                >
                  <span>
                    {booking.startTime}–{booking.endTime} {booking.clientName}
                  </span>
                  <Badge>{booking.status}</Badge>
                  <form action={setBookingStatus} className="flex gap-2">
                    <input type="hidden" name="id" value={booking.id} />
                    <Select name="status" defaultValue={booking.status}>
                      <option value="requested">requested</option>
                      <option value="confirmed">confirmed</option>
                      <option value="cancelled">cancelled</option>
                    </Select>
                    <Button variant="line">Update</Button>
                  </form>
                </div>
              ))}
          </div>
        </Card>
        <div className="grid gap-4">
          <Card>
            <h2 className="font-serif text-2xl">Session types</h2>
            <ul className="my-3 grid gap-1 text-sm">
              {types.map((type) => (
                <li key={type.id}>
                  {type.name} · {type.durationMinutes} min
                </li>
              ))}
            </ul>
            <form action={saveSessionType} className="grid gap-2">
              <Input name="name" placeholder="Engagement" required />
              <Input
                name="durationMinutes"
                type="number"
                min={15}
                max={480}
                placeholder="60"
                required
              />
              <Textarea
                name="description"
                rows={2}
                placeholder="What the hour includes"
              />
              <Button>Add type</Button>
            </form>
          </Card>
          <Card>
            <h2 className="font-serif text-2xl">Date override</h2>
            <form action={saveOverride} className="mt-3 grid gap-2">
              <Input name="date" type="date" defaultValue={selected} required />
              <Select name="status" defaultValue="closed">
                <option value="closed">Closed</option>
                <option value="open">Open with these hours</option>
              </Select>
              <Input name="startTime" placeholder="10:00" />
              <Input name="endTime" placeholder="14:00" />
              <Input name="note" placeholder="Note" />
              <Button>Save override</Button>
            </form>
          </Card>
        </div>
      </div>
      <Card>
        <h2 className="font-serif text-2xl">Weekly hours</h2>
        <form action={saveWeeklyRules} className="mt-4 grid gap-2">
          {days.map((label, weekday) => {
            const rule = ruleByDay.get(weekday);
            return (
              <div
                key={label}
                className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-2 text-sm"
              >
                <span>{label}</span>
                <Input
                  name={`start-${weekday}`}
                  defaultValue={rule?.startTime ?? "09:00"}
                />
                <Input
                  name={`end-${weekday}`}
                  defaultValue={rule?.endTime ?? "17:00"}
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={`closed-${weekday}`}
                    defaultChecked={!rule}
                  />
                  Closed
                </label>
              </div>
            );
          })}
          <Button className="mt-2 w-fit">Save weekly hours</Button>
        </form>
      </Card>
    </div>
  );
}
