import { ChevronRight, ImageOff, Layers3 } from "lucide-react";
import { useState } from "react";
import { GuideLanding } from "./GuideLanding";
import {
  buildHomeownerGuidePresentation,
  locationLabel,
  sectionHeading,
  sections,
} from "../presentation/homeowner-guide";
import type {
  HomeownerGuideDocumentData,
  HomeownerPaintRecord,
} from "../presentation/types";
import { verifiedRoomSwatchFor, type VerifiedRoomSwatch } from "../presentation/room-presentation";
import { approximateCatalogSwatchForRecord, verifiedSwatchForRecord } from "../presentation/homeowner-features";
import { ColorReferenceRows } from "./ColorReferenceRows.js";
import { HomeownerPrivateImage } from "./HomeownerPrivateImage.js";

function RoomContextPhoto({
  photoUrl,
}: {
  photoUrl?: string;
}) {
  const src = photoUrl?.trim() || null;
  return src ? (
    <div className="pg-room-paint-context">
      <HomeownerPrivateImage src={src} alt="" loading="lazy" />
    </div>
  ) : (
    <div className="pg-room-paint-context pg-room-paint-context--empty" aria-hidden="true">
      <ImageOff size={19} strokeWidth={1} />
      <span>Photo not added</span>
    </div>
  );
}

function RoomPaintCard({
  record,
  photoUrl,
  formulaLabelPhotoUrls,
  verifiedSwatches,
}: {
  record: HomeownerPaintRecord;
  photoUrl?: string;
  formulaLabelPhotoUrls: readonly string[];
  verifiedSwatches: readonly VerifiedRoomSwatch[];
}) {
  const recordSwatchValue = verifiedSwatchForRecord(record);
  const recordSwatch = recordSwatchValue
    ? [{ recordId: record.id, ...recordSwatchValue }]
    : [];
  const swatch = verifiedRoomSwatchFor(record.id, [...verifiedSwatches, ...recordSwatch]);
  const approximateSwatch = swatch ? null : approximateCatalogSwatchForRecord(record);
  const shownSwatch = swatch ?? approximateSwatch;
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <article className="pg-room-paint-card" data-paint-record-id={record.id}>
      <RoomContextPhoto photoUrl={photoUrl} />
      <div className="pg-room-paint-main">
        <div className="pg-room-paint-top">
          <div className="pg-room-paint-title">
            <h3 className="pg-room-paint-surface">{record.surface}</h3>
            <p className="pg-room-paint-color">{record.color_name}</p>
          </div>
          <div className="pg-room-swatch-block">
            <span
              className={shownSwatch ? "pg-room-swatch" : "pg-room-swatch pg-room-swatch--unknown"}
              style={shownSwatch ? { backgroundColor: shownSwatch.hex.trim() } : undefined}
              role="img"
              aria-label={swatch ? `Staff-recorded digital swatch for ${record.color_name}` : approximateSwatch ? `Approximate catalog color reference for ${record.color_name}; not manufacturer-verified` : `Unverified swatch for ${record.color_name}`}
            >{shownSwatch ? null : <span>Not<br />verified</span>}</span>
            <span className="pg-room-swatch-status">{swatch ? "Staff-recorded color" : approximateSwatch ? "Approximate reference" : "Swatch not verified"}</span>
          </div>
        </div>
        <dl className="pg-room-paint-visible-facts">
          <div><dt>Sheen</dt><dd>{record.sheen || "Not recorded"}</dd></div>
          <div><dt>Product</dt><dd>{record.product || "Not recorded"}</dd></div>
        </dl>
        <button className="pg-record-details-toggle" type="button" aria-expanded={detailsOpen} aria-label={`${detailsOpen ? "Hide" : "View"} details for ${record.surface}`} onClick={() => setDetailsOpen(open => !open)}>
          <span>{detailsOpen ? "Less details" : "More details"}</span><ChevronRight className={detailsOpen ? "pg-record-chevron pg-record-chevron--open" : "pg-record-chevron"} size={16} aria-hidden="true" />
        </button>
        {detailsOpen ? <div className="pg-record-details">
        {swatch ? <p className="pg-room-swatch-provenance">Staff-recorded color reference: {swatch.provenance}</p> : approximateSwatch ? <p className="pg-room-swatch-provenance">{approximateSwatch.provenance} <a href={approximateSwatch.url} target="_blank" rel="noreferrer">View PaintDB reference</a></p> : null}
        <dl className="pg-room-paint-facts">
          <ColorReferenceRows record={record} reference={approximateSwatch} showMissingColorCode />
        </dl>
        {record.notes ? <div className="pg-room-record-note"><p>Paint note</p><span>{record.notes}</span></div> : null}
        <section className="pg-formula-labels" aria-label={`Formula label photos for ${record.color_name}`}>
          <h4>Paint-can formula label photo</h4>
          <FormulaLabelPhotos record={record} urls={formulaLabelPhotoUrls} />
        </section>
        </div> : null}
      </div>
    </article>
  );
}

function FormulaLabelPhotos({ record, urls }: { record: HomeownerPaintRecord; urls: readonly string[] }) {
  return urls.length ? <div className="pg-formula-label-list">
    {urls.map((url, index) => <figure key={`${url}-${index}`}>
      <HomeownerPrivateImage src={url} loading="lazy" alt={`Formula-label image for ${record.color_name}, photo ${index + 1}`} />
      <figcaption><a href={url} target="_blank" rel="noopener noreferrer">Open full-size label photo</a></figcaption>
    </figure>)}
  </div> : <p className="pg-formula-label-pending" role="status">Formula label photo pending. A clear photo of the real can sticker will be added here.</p>;
}

function PaintRecordDetails({
  record,
  compact = false,
  locationLabels = [],
  formulaLabelPhotoUrls = [],
}: {
  record: HomeownerPaintRecord;
  compact?: boolean;
  locationLabels?: string[];
  formulaLabelPhotoUrls?: readonly string[];
}) {
  return (
    <article
      className={
        compact
          ? "min-w-0 border-t border-[#20211f]/10 py-3 first:border-t-0 first:pt-0"
          : "border border-[#20211f]/15 bg-white p-5 sm:p-6"
      }
    >
      {compact ? (
        <p className="font-serif text-lg sm:text-xl">{record.surface}</p>
      ) : (
        <h3 className="font-serif text-2xl">{record.surface}</h3>
      )}
      <p className={compact ? "mt-0.5 text-sm text-[#20211f]/75" : "mt-1 text-base text-[#20211f]/80"}>
        {record.color_name}
        {record.sheen ? ` · ${record.sheen}` : ""}
      </p>
      {record.brand || record.product || record.color_code || record.notes || approximateCatalogSwatchForRecord(record) ? (
        <dl className={compact ? "mt-2 grid gap-x-4 gap-y-1 text-xs leading-5 text-[#20211f]/60 sm:grid-cols-2" : "mt-4 grid gap-2 text-sm leading-6 text-[#20211f]/65 sm:grid-cols-2"}>
          <ColorReferenceRows record={record} reference={approximateCatalogSwatchForRecord(record)} />
          {record.product ? (
            <div>
              <dt className="font-semibold text-[#20211f]">Product</dt>
              <dd>{record.product}</dd>
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
      {!compact && locationLabels.length ? (
        <div className="mt-5 border-t border-[#20211f]/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b36]">
            {locationLabels.length === 1 ? "Location" : "Locations"}
          </p>
          <div className="mt-2 space-y-1 text-sm leading-6 text-[#20211f]/70">
            {locationLabels.map((label, index) => (
              <p key={`${label}-${index}`}>{label}</p>
            ))}
          </div>
        </div>
      ) : null}
      {formulaLabelPhotoUrls.length ? (
        <section className="mt-5 border-t border-[#20211f]/10 pt-4" aria-label={`Formula label photos for ${record.color_name}`}>
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b36]">Paint-can formula label photo</h4>
          <FormulaLabelPhotos record={record} urls={formulaLabelPhotoUrls} />
        </section>
      ) : null}
    </article>
  );
}

function LocationRecords({ records }: { records: HomeownerPaintRecord[] }) {
  return (
    <div className="mt-4">
      {sections.map((section) => {
        const sectionRecords = records.filter((record) => record.section === section);
        if (!sectionRecords.length) return null;

        return (
          <section className="mt-4 first:mt-0" key={section}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b36]">
              {sectionHeading(section)}
            </p>
            <div className="mt-2 grid gap-x-5 sm:grid-cols-2">
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

function ExceptionLocationCard({
  title,
  parentName,
  records,
  formulaLabelPhotoUrls = {},
}: {
  title: string;
  parentName?: string;
  records: HomeownerPaintRecord[];
  formulaLabelPhotoUrls?: Readonly<Record<string, readonly string[]>>;
}) {
  return (
    <section className="min-w-0 break-words border border-[#20211f]/15 bg-white p-5 sm:p-6">
      <h3 className="font-serif text-2xl sm:text-3xl">{title}</h3>
      {parentName ? (
        <p className="mt-1 text-sm leading-6 text-[#20211f]/60">{parentName}</p>
      ) : null}
      <div className="mt-5">
        {records.map((record) => (
          <PaintRecordDetails compact key={record.id} record={record} formulaLabelPhotoUrls={formulaLabelPhotoUrls[record.id] ?? []} />
        ))}
      </div>
    </section>
  );
}

function GuideSpecifications({ data, formulaLabelPhotoUrls }: { data: HomeownerGuideDocumentData; formulaLabelPhotoUrls: Readonly<Record<string, readonly string[]>> }) {
  const { guide, locations } = data;
  const {
    primaryRecords,
    exceptionRecords,
    additionalRecords,
    exceptionLocationGroups,
    unassignedExceptionRecords,
    orderedLocations,
    topLevelLocations,
    orphanLocations,
    recordsForLocation,
    assignedLocationsForRecord,
  } = buildHomeownerGuidePresentation(data);

  return (
    <article className="overflow-hidden border border-[#20211f]/15 bg-[#fffdf8] shadow-[0_18px_60px_rgba(32,33,31,0.08)]">
      <header className="bg-[#20211f] px-6 py-12 text-[#f5f1e8] sm:px-10 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7b87b]">
          Tauro Painting
        </p>
        <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
          {guide.residence_name}
        </h2>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#f5f1e8]/65">
          Paint Color Guide
        </p>
      </header>

      <div className="space-y-14 px-6 py-10 sm:px-10 sm:py-14">
        <section aria-labelledby="primary-specifications">
          <h2 id="primary-specifications" className="font-serif text-3xl sm:text-4xl">
            Primary
          </h2>
          {guide.primary_scope_note ? (
            <div className="mt-6 border-l-2 border-[#9b6b36] pl-5 text-lg leading-8 text-[#20211f]/75">
              {guide.primary_scope_note}
            </div>
          ) : null}
          {primaryRecords.length ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {primaryRecords.map((record) => (
                <PaintRecordDetails key={record.id} record={record} formulaLabelPhotoUrls={formulaLabelPhotoUrls[record.id] ?? []} />
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
              {exceptionLocationGroups.map((group) => (
                <ExceptionLocationCard
                  key={group.location.id}
                  title={group.location.name}
                  parentName={group.parentName}
                  records={group.records}
                  formulaLabelPhotoUrls={formulaLabelPhotoUrls}
                />
              ))}
              {unassignedExceptionRecords.length ? (
                <ExceptionLocationCard
                  title="Other Exceptions"
                  records={unassignedExceptionRecords}
                />
              ) : null}
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
                  <PaintRecordDetails
                    key={record.id}
                    locationLabels={assignedLocations.map((location) =>
                      locationLabel(location, locations),
                    )}
                    record={record}
                    formulaLabelPhotoUrls={formulaLabelPhotoUrls[record.id] ?? []}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="paint-by-location">
          <h2 id="paint-by-location" className="font-serif text-3xl sm:text-4xl">
            Paint by Location
          </h2>
          <div className="mt-8 space-y-6">
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
                <section className="border border-[#20211f]/15 bg-white p-5 sm:p-6" key={parent.id}>
                  <h3 className="font-serif text-2xl">{parent.name}</h3>
                  {parentRecords.length ? <LocationRecords records={parentRecords} /> : null}
                  {visibleChildren.map((child) => (
                    <section className="mt-5 border-l border-[#9b6b36]/50 pl-4 sm:pl-5" key={child.id}>
                      <h4 className="font-serif text-lg sm:text-xl">{child.name}</h4>
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
            <a className="underline decoration-[#9b6b36] underline-offset-4" href="mailto:office@tauropainting.com">
              office@tauropainting.com
            </a>
          </div>
        </footer>
      </div>
    </article>
  );
}

export type HomeownerGuideDocumentProps = {
  data: HomeownerGuideDocumentData;
  /** Explicitly authorized image source; omitted for the existing placeholder. */
  heroImageUrl?: string | null;
  /** Optional presentation-only room photographs; never read from or persisted to the DTO. */
  roomPhotoUrls?: Readonly<Record<string, string>>;
  /** Optional presentation-only photo for the exact record and location, before room-level fallback. */
  recordPhotoUrls?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Protected full-resolution formula label photos, separate from all room/context imagery. */
  formulaLabelPhotoUrls?: Readonly<Record<string, readonly string[]>>;
  /** Explicit verified color values with provenance, keyed to exact record identity. */
  verifiedSwatches?: readonly VerifiedRoomSwatch[];
};

export function HomeownerGuideDocument({ data, heroImageUrl, roomPhotoUrls, recordPhotoUrls, formulaLabelPhotoUrls = {}, verifiedSwatches = [] }: HomeownerGuideDocumentProps) {
  return <GuideLanding
    data={data}
    heroImageUrl={heroImageUrl}
    roomPhotoUrls={roomPhotoUrls}
    renderSpecifications={document => <GuideSpecifications data={document} formulaLabelPhotoUrls={formulaLabelPhotoUrls} />}
    renderRoomPaints={(records, locationId) => {
      return <div className="pg-room-paint-list">
        {records.map(record => <RoomPaintCard
          key={record.id}
          photoUrl={recordPhotoUrls?.[locationId]?.[record.id]?.trim() || roomPhotoUrls?.[locationId]}
          formulaLabelPhotoUrls={formulaLabelPhotoUrls[record.id] ?? []}
          record={record}
          verifiedSwatches={verifiedSwatches}
        />)}
      </div>;
    }}
  />;
}
