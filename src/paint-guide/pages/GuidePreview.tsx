import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPaintGuide } from "../data/guides";
import { listGuideLocations } from "../data/locations";
import { listPaintRecordLocations } from "../data/paint-record-locations";
import { listPaintRecords } from "../data/paint-records";
import type {
  GuideLocation,
  PaintGuide,
  PaintGuideStatus,
  PaintRecord,
  PaintRecordLocation,
  PaintRecordSection,
} from "../data/types";

const sections: PaintRecordSection[] = ["primary", "exception", "additional"];
const sectionOrder: Record<PaintRecordSection, number> = {
  primary: 0,
  exception: 1,
  additional: 2,
};

type LoadState = "loading" | "ready" | "not_found" | "error";

function sectionHeading(section: PaintRecordSection) {
  if (section === "primary") return "Primary";
  if (section === "exception") return "Exceptions";
  return "Additional";
}

function statusLabel(status: PaintGuideStatus) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)} · Staff Preview`;
}

function compareRecords(a: PaintRecord, b: PaintRecord) {
  return (
    sectionOrder[a.section] - sectionOrder[b.section] ||
    a.sort_order - b.sort_order ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

function compareLocations(a: GuideLocation, b: GuideLocation) {
  return (
    a.sort_order - b.sort_order ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

function hierarchyOrderedLocations(locations: GuideLocation[]) {
  const topLevel = locations
    .filter((location) => location.parent_id === null)
    .sort(compareLocations);
  const childrenByParent = new Map<string, GuideLocation[]>();

  locations
    .filter((location) => location.parent_id !== null)
    .forEach((location) => {
      const children = childrenByParent.get(location.parent_id!) ?? [];
      children.push(location);
      childrenByParent.set(location.parent_id!, children);
    });

  const ordered: GuideLocation[] = [];
  const rendered = new Set<string>();

  topLevel.forEach((parent) => {
    ordered.push(parent);
    rendered.add(parent.id);

    (childrenByParent.get(parent.id) ?? [])
      .sort(compareLocations)
      .forEach((child) => {
        ordered.push(child);
        rendered.add(child.id);
      });
  });

  locations
    .filter((location) => !rendered.has(location.id))
    .sort(compareLocations)
    .forEach((location) => ordered.push(location));

  return ordered;
}

function locationLabel(location: GuideLocation, locations: GuideLocation[]) {
  const parent = location.parent_id
    ? locations.find((item) => item.id === location.parent_id)
    : null;
  return parent ? `${parent.name} › ${location.name}` : location.name;
}

function PaintRecordDetails({
  record,
  compact = false,
}: {
  record: PaintRecord;
  compact?: boolean;
}) {
  return (
    <article
      className={
        compact
          ? "border-t border-[#20211f]/10 py-4 first:border-t-0 first:pt-0"
          : "border border-[#20211f]/15 bg-white p-5 sm:p-6"
      }
    >
      {compact ? (
        <p className="font-serif text-xl">{record.surface}</p>
      ) : (
        <h3 className="font-serif text-2xl">{record.surface}</h3>
      )}
      <p className="mt-1 text-base text-[#20211f]/80">
        {record.color_name}
        {record.sheen ? ` · ${record.sheen}` : ""}
      </p>
      {record.brand || record.product || record.color_code || record.notes ? (
        <dl className="mt-4 grid gap-2 text-sm leading-6 text-[#20211f]/65 sm:grid-cols-2">
          {record.brand ? (
            <div>
              <dt className="font-semibold text-[#20211f]">Brand</dt>
              <dd>{record.brand}</dd>
            </div>
          ) : null}
          {record.product ? (
            <div>
              <dt className="font-semibold text-[#20211f]">Product</dt>
              <dd>{record.product}</dd>
            </div>
          ) : null}
          {record.color_code ? (
            <div>
              <dt className="font-semibold text-[#20211f]">Color Code</dt>
              <dd>{record.color_code}</dd>
            </div>
          ) : null}
          {record.notes ? (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-[#20211f]">Notes</dt>
              <dd>{record.notes}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}

function LocationRecords({ records }: { records: PaintRecord[] }) {
  return (
    <div className="mt-4">
      {sections.map((section) => {
        const sectionRecords = records.filter((record) => record.section === section);
        if (!sectionRecords.length) return null;

        return (
          <section className="mt-5 first:mt-0" key={section}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b36]">
              {sectionHeading(section)}
            </p>
            <div className="mt-3">
              {sectionRecords.map((record) => (
                <PaintRecordDetails compact key={record.id} record={record} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function GuidePreview() {
  const { guideId = "" } = useParams();
  const [guide, setGuide] = useState<PaintGuide | null>(null);
  const [records, setRecords] = useState<PaintRecord[]>([]);
  const [locations, setLocations] = useState<GuideLocation[]>([]);
  const [assignments, setAssignments] = useState<PaintRecordLocation[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [loadedGuideId, setLoadedGuideId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setState("loading");
    setGuide(null);
    setRecords([]);
    setLocations([]);
    setAssignments([]);
    setLoadedGuideId(null);

    async function load() {
      try {
        const nextGuide = await getPaintGuide(guideId);
        if (!active) return;

        if (!nextGuide) {
          setState("not_found");
          return;
        }

        const [nextRecords, nextLocations, nextAssignments] = await Promise.all([
          listPaintRecords(guideId),
          listGuideLocations(guideId),
          listPaintRecordLocations(guideId),
        ]);
        if (!active) return;

        setGuide(nextGuide);
        setRecords([...nextRecords].sort(compareRecords));
        setLocations(nextLocations);
        setAssignments(nextAssignments);
        setLoadedGuideId(guideId);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [guideId]);

  function recordsForLocation(locationId: string) {
    const recordIds = new Set(
      assignments
        .filter((assignment) => assignment.location_id === locationId)
        .map((assignment) => assignment.paint_record_id),
    );
    return records.filter((record) => recordIds.has(record.id));
  }

  function assignedLocationsForRecord(recordId: string) {
    const locationIds = new Set(
      assignments
        .filter((assignment) => assignment.paint_record_id === recordId)
        .map((assignment) => assignment.location_id),
    );
    return hierarchyOrderedLocations(locations).filter((location) =>
      locationIds.has(location.id),
    );
  }

  if (state === "loading" || (state === "ready" && loadedGuideId !== guideId)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 text-[#20211f]" data-paint-guide-shell="true">
        <p className="text-sm font-semibold uppercase tracking-[0.16em]">
          Loading Paint Guide Preview…
        </p>
      </main>
    );
  }

  if (state === "not_found") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-16 text-[#20211f]" data-paint-guide-shell="true">
        <section className="w-full max-w-xl border border-[#20211f]/15 bg-white p-8 sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">
            Staff Preview
          </p>
          <h1 className="mt-4 font-serif text-4xl">Paint Guide not found</h1>
          <Link className="mt-8 inline-flex border border-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em]" to="/paint-guide">
            Back to Paint Guides
          </Link>
        </section>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-16 text-[#20211f]" data-paint-guide-shell="true">
        <section className="w-full max-w-xl border border-[#20211f]/15 bg-white p-8 sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">
            Staff Preview
          </p>
          <h1 className="mt-4 font-serif text-4xl">Could not load Paint Guide.</h1>
          <p className="mt-4 leading-7 text-[#20211f]/65">Please return to the dashboard and try again.</p>
          <Link className="mt-8 inline-flex border border-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em]" to="/paint-guide">
            Back to Paint Guides
          </Link>
        </section>
      </main>
    );
  }

  const primaryRecords = records.filter((record) => record.section === "primary");
  const exceptionRecords = records.filter((record) => record.section === "exception");
  const additionalRecords = records.filter((record) => record.section === "additional");
  const orderedLocations = hierarchyOrderedLocations(locations);
  const topLevelLocations = orderedLocations.filter(
    (location) => location.parent_id === null,
  );
  const normalChildIds = new Set(
    topLevelLocations.flatMap((parent) =>
      orderedLocations
        .filter((location) => location.parent_id === parent.id)
        .map((location) => location.id),
    ),
  );
  const orphanLocations = orderedLocations.filter(
    (location) =>
      location.parent_id !== null &&
      !normalChildIds.has(location.id) &&
      recordsForLocation(location.id).length > 0,
  );

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-4 py-5 text-[#20211f] sm:px-8 sm:py-10" data-paint-guide-shell="true">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#20211f]/15 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] sm:px-5">
          <Link className="text-[#20211f] underline decoration-[#9b6b36] underline-offset-4" to={`/paint-guide/g/${guideId}`}>
            Back to Guide
          </Link>
          <div className="flex items-center gap-3 text-[#20211f]/65">
            <span>Staff Preview</span>
            <span aria-hidden="true">•</span>
            <span>{guide ? statusLabel(guide.status) : "Staff Preview"}</span>
          </div>
        </div>

        <article className="overflow-hidden border border-[#20211f]/15 bg-[#fffdf8] shadow-[0_18px_60px_rgba(32,33,31,0.08)]">
          <header className="bg-[#20211f] px-6 py-12 text-[#f5f1e8] sm:px-10 sm:py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7b87b]">
              Tauro Painting
            </p>
            <h1 className="mt-6 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
              {guide?.residence_name}
            </h1>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#f5f1e8]/65">
              Paint Color Guide
            </p>
          </header>

          <div className="space-y-14 px-6 py-10 sm:px-10 sm:py-14">
            <section aria-labelledby="primary-specifications">
              <h2 id="primary-specifications" className="font-serif text-3xl sm:text-4xl">
                Primary
              </h2>
              {guide?.primary_scope_note ? (
                <div className="mt-6 border-l-2 border-[#9b6b36] pl-5 text-lg leading-8 text-[#20211f]/75">
                  {guide.primary_scope_note}
                </div>
              ) : null}
              {primaryRecords.length ? (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {primaryRecords.map((record) => (
                    <PaintRecordDetails key={record.id} record={record} />
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-[#20211f]/65">
                  Primary paint specifications have not been added yet.
                </p>
              )}
            </section>

            {exceptionRecords.length ? (
              <section aria-labelledby="exception-specifications">
                <h2 id="exception-specifications" className="font-serif text-3xl sm:text-4xl">
                  Exceptions
                </h2>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {exceptionRecords.map((record) => {
                    const assignedLocations = assignedLocationsForRecord(record.id);
                    return (
                      <div key={record.id}>
                        <PaintRecordDetails record={record} />
                        {assignedLocations.length ? (
                          <p className="mt-3 text-sm font-semibold text-[#20211f]/65">
                            {assignedLocations
                              .map((location) => locationLabel(location, locations))
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {additionalRecords.length ? (
              <section aria-labelledby="additional-specifications">
                <h2 id="additional-specifications" className="font-serif text-3xl sm:text-4xl">
                  Additional
                </h2>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {additionalRecords.map((record) => {
                    const assignedLocations = assignedLocationsForRecord(record.id);
                    return (
                      <div key={record.id}>
                        <PaintRecordDetails record={record} />
                        {assignedLocations.length ? (
                          <p className="mt-3 text-sm font-semibold text-[#20211f]/65">
                            {assignedLocations
                              .map((location) => locationLabel(location, locations))
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section aria-labelledby="paint-by-location">
              <h2 id="paint-by-location" className="font-serif text-3xl sm:text-4xl">
                Paint by Location
              </h2>
              <div className="mt-8 space-y-8">
                {topLevelLocations.map((parent) => {
                  const parentRecords = recordsForLocation(parent.id);
                  const children = orderedLocations.filter(
                    (location) => location.parent_id === parent.id,
                  );
                  const visibleChildren = children.filter(
                    (child) => recordsForLocation(child.id).length > 0,
                  );

                  if (!parentRecords.length && !visibleChildren.length) return null;

                  return (
                    <section className="border border-[#20211f]/15 bg-white p-5 sm:p-7" key={parent.id}>
                      <h3 className="font-serif text-2xl">{parent.name}</h3>
                      {parentRecords.length ? <LocationRecords records={parentRecords} /> : null}
                      {visibleChildren.map((child) => (
                        <section className="mt-6 border-l border-[#9b6b36]/50 pl-5" key={child.id}>
                          <h4 className="font-serif text-xl">
                            {locationLabel(child, locations)}
                          </h4>
                          <LocationRecords records={recordsForLocation(child.id)} />
                        </section>
                      ))}
                    </section>
                  );
                })}

                {orphanLocations.map((location) => (
                  <section className="border border-[#20211f]/15 bg-white p-5 sm:p-7" key={location.id}>
                    <h3 className="font-serif text-2xl">
                      {locationLabel(location, locations)}
                    </h3>
                    <LocationRecords records={recordsForLocation(location.id)} />
                  </section>
                ))}
              </div>
            </section>

            <footer className="border-t border-[#20211f]/15 pt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6b36]">
                Tauro Painting
              </p>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl">
                Questions about your paint selections?
              </h2>
              <div className="mt-6 flex flex-col gap-2 text-lg text-[#20211f]/75 sm:flex-row sm:gap-6">
                <a className="underline decoration-[#9b6b36] underline-offset-4" href="tel:+18019289520">
                  (801) 928-9520
                </a>
                <a className="underline decoration-[#9b6b36] underline-offset-4" href="mailto:tauropaintingutah@gmail.com">
                  tauropaintingutah@gmail.com
                </a>
              </div>
            </footer>
          </div>
        </article>
      </div>
    </main>
  );
}
