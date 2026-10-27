import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronRight, House, Layers3, PaintRoller } from "lucide-react";
import { buildGuideNavigation, type GuideSelection } from "../presentation/guide-navigation";
import { buildRoomNavigation, type RoomNavigationNode } from "../presentation/room-navigation";
import { propertyMetadata, roomNotesForLocation, verifiedSwatchForRecord } from "../presentation/homeowner-features";
import type { HomeownerGuideDocumentData, HomeownerPaintRecord } from "../presentation/types";
import "./guide-landing.css";

type RoomView = { kind: "space" | "room"; id: string };
type ActiveView = GuideSelection | RoomView;
type Props = {
  data: HomeownerGuideDocumentData;
  /** Optional trusted residence image; presentation only, never persisted in the DTO. */
  heroImageUrl?: string | null;
  /** Optional per-location image sources supplied by a presentation caller. */
  roomPhotoUrls?: Readonly<Record<string, string>>;
  renderSpecifications: (data: HomeownerGuideDocumentData) => ReactNode;
  renderRoomPaints: (records: HomeownerPaintRecord[], locationId: string) => ReactNode;
};
const emptyPhotoSources: Readonly<Record<string, string>> = {};
const countLabel = (count: number) => `${count} paint ${count === 1 ? "selection" : "selections"}`;

function isRoomView(view: ActiveView | null): view is RoomView {
  return view?.kind === "space" || view?.kind === "room";
}

function LocationPhoto({ photoUrl, variant = "card" }: { photoUrl: string | null; variant?: "card" | "subspace" }) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  useEffect(() => setFailedPhotoUrl(null), [photoUrl]);
  const showPhoto = photoUrl !== null && failedPhotoUrl !== photoUrl;
  return <div className={variant === "card" ? "pg-location-photo" : "pg-subspace-photo"} aria-hidden="true">
    {showPhoto ? <img src={photoUrl ?? undefined} alt="" onError={() => setFailedPhotoUrl(photoUrl)} /> : variant === "card" ? <><Layers3 strokeWidth={0.8} /><span>Location photograph not added</span></> : <Layers3 strokeWidth={0.8} />}
  </div>;
}

function LocationPicker({
  roots,
  rootId,
  onChange,
}: {
  roots: RoomNavigationNode[];
  rootId: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="pg-location-picker">
      <span className="sr-only">Choose a floor or location</span>
      <select aria-label="Choose a floor or location" value={rootId} onChange={event => onChange(event.target.value)}>
        {roots.map(root => <option key={root.location.id} value={root.location.id}>{root.location.name}</option>)}
      </select>
      <ChevronDown size={15} aria-hidden="true" />
    </label>
  );
}

function RoomNavigationHeader({
  data,
  node,
  roots,
  onBack,
  onChangeRoot,
}: {
  data: HomeownerGuideDocumentData;
  node: RoomNavigationNode;
  roots: RoomNavigationNode[];
  onBack: () => void;
  onChangeRoot: (id: string) => void;
}) {
  return (
    <nav className="pg-room-nav" aria-label="Room paint guide navigation">
      <button className="pg-room-nav-back" onClick={onBack} type="button" aria-label={`Back from ${node.location.name}`}>
        <ArrowLeft size={18} aria-hidden="true" />
        <span>{data.guide.residence_name}</span>
      </button>
      <LocationPicker roots={roots} rootId={node.rootId} onChange={onChangeRoot} />
    </nav>
  );
}

function RoomHero({
  node,
  rootName,
  photoUrl,
  dataKey,
  headingRef,
  onPhotoError,
}: {
  node: RoomNavigationNode;
  rootName: string;
  photoUrl: string | null;
  dataKey: HomeownerGuideDocumentData;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onPhotoError: (key: string) => void;
}) {
  const [failedPhotoKey, setFailedPhotoKey] = useState<string | null>(null);
  const photoKey = `${node.location.id}\u0000${photoUrl ?? ""}`;
  useEffect(() => setFailedPhotoKey(null), [dataKey, photoUrl, node.location.id]);
  const showPhoto = photoUrl !== null && failedPhotoKey !== photoKey;

  return (
    <section className={showPhoto ? "pg-room-hero pg-room-hero--photo" : "pg-room-hero"} aria-label={`${node.location.name} room details`}>
      {showPhoto ? (
        <img
          className="pg-room-hero-image"
          src={photoUrl ?? undefined}
          alt={`Room photograph for ${node.location.name}`}
          onError={() => { setFailedPhotoKey(photoKey); onPhotoError(photoKey); }}
        />
      ) : (
        <div className="pg-room-hero-placeholder" role="img" aria-label={photoUrl ? `Room photograph unavailable for ${node.location.name}` : `Room photograph not added for ${node.location.name}`}>
          <House size={66} strokeWidth={0.8} aria-hidden="true" />
          <span>{photoUrl ? "Room photograph unavailable" : "Room photograph not added"}</span>
        </div>
      )}
      <div className="pg-room-hero-shade" aria-hidden="true" />
      <div className="pg-room-hero-copy">
        <p>{rootName === node.location.name ? "Paint by Location" : rootName}</p>
        <h1 ref={headingRef} tabIndex={-1}>{node.location.name}</h1>
        <span className="pg-room-title-rule" aria-hidden="true" />
      </div>
    </section>
  );
}

export function GuideLanding({ data, heroImageUrl, roomPhotoUrls = emptyPhotoSources, renderSpecifications, renderRoomPaints }: Props) {
  const navigation = buildGuideNavigation(data);
  const rooms = buildRoomNavigation(data);
  const [selection, setSelection] = useState<{ document: HomeownerGuideDocumentData; view: ActiveView } | null>(null);
  const [failedHeroImageUrl, setFailedHeroImageUrl] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);
  const locationSection = useRef<HTMLElement>(null);
  const active = selection?.document === data ? selection.view : null;
  const resolvedHeroImageUrl = heroImageUrl?.trim() || null;
  const showHeroImage = resolvedHeroImageUrl !== null && failedHeroImageUrl !== resolvedHeroImageUrl;
  const selectedDocument = active && !isRoomView(active) ? navigation.documentFor(active) : null;
  const selectedTitle = active?.kind === "all" ? "All paint selections" : active?.kind === "location"
    ? navigation.locations.find(location => location.id === active.id)?.name
    : active?.kind === "category"
      ? navigation.categories.find(category => category.id === active.id)?.name
      : undefined;

  useEffect(() => {
    setSelection(null);
    setFailedHeroImageUrl(null);
  }, [data]);

  useEffect(() => {
    if (resolvedHeroImageUrl !== null) setFailedHeroImageUrl(current => current === resolvedHeroImageUrl ? current : null);
  }, [resolvedHeroImageUrl]);

  useEffect(() => {
    if (active || hasNavigated.current) {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (active) hasNavigated.current = true;
  }, [active]);

  function open(view: GuideSelection) { setSelection({ document: data, view }); }
  function openSpace(id: string) {
    const node = rooms.nodeFor(id);
    if (!node) return;
    setSelection({ document: data, view: { kind: node.children.length ? "space" : "room", id } });
  }
  function home() {
    setSelection(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function backFromSpace(node: RoomNavigationNode) {
    if (node.parentId) openSpace(node.parentId);
    else home();
  }

  if (isRoomView(active)) {
    const node = rooms.nodeFor(active.id);
    if (!node) return null;
    const root = rooms.nodeFor(node.rootId);
    const photoUrl = roomPhotoUrls[node.location.id]?.trim() || null;
    const exactRecords = node.exactRecords;

    if (active.kind === "room") {
      return (
        <article className="pg-experience pg-room-experience">
          <RoomNavigationHeader data={data} node={node} roots={rooms.roots} onBack={() => backFromSpace(node)} onChangeRoot={openSpace} />
          <RoomHero node={node} rootName={root?.location.name ?? node.location.name} photoUrl={photoUrl} dataKey={data} headingRef={heading} onPhotoError={() => {}} />
          <div className="pg-room-page-content">
            <section aria-labelledby="pg-room-paint-heading">
              <div className="pg-room-section-heading">
                <p className="pg-eyebrow">Recorded for this space</p>
                <h2 id="pg-room-paint-heading">Paint Colors</h2>
                <p>Colors and finishes assigned directly to this location.</p>
              </div>
              {exactRecords.length ? renderRoomPaints(exactRecords, node.location.id) : (
                <p className="pg-room-empty">No paint selections have been assigned directly to this location.</p>
              )}
              {roomNotesForLocation(node.location) ? <aside className="pg-room-notes" aria-labelledby="pg-room-notes-heading"><h2 id="pg-room-notes-heading">Room Notes</h2><p>{roomNotesForLocation(node.location)}</p></aside> : null}
            </section>
            {node.hasUnresolvedHierarchy ? <p className="pg-hierarchy-note" role="note">The location hierarchy could not be confirmed. This space is shown separately.</p> : null}
          </div>
        </article>
      );
    }

    return (
      <article className="pg-experience pg-room-experience">
        <RoomNavigationHeader data={data} node={node} roots={rooms.roots} onBack={() => backFromSpace(node)} onChangeRoot={openSpace} />
        <main className="pg-space-page-content">
          <header className="pg-space-heading">
            <p className="pg-eyebrow">Paint by Location</p>
            <h1 ref={heading} tabIndex={-1}>{node.location.name}</h1>
            <p>Choose a nested space, or review selections assigned directly to this location.</p>
          </header>
          {node.hasUnresolvedHierarchy ? <p className="pg-hierarchy-note" role="note">The location hierarchy could not be confirmed. This space is shown separately.</p> : null}
          {exactRecords.length ? (
            <section className="pg-direct-paints" aria-labelledby="pg-direct-paints-heading">
              <div className="pg-room-section-heading">
                <p className="pg-eyebrow">Exact assignments</p>
                <h2 id="pg-direct-paints-heading">Paint assigned to {node.location.name}</h2>
                <p>These selections are assigned to this location itself, not inherited by its rooms.</p>
              </div>
              {renderRoomPaints(exactRecords, node.location.id)}
            </section>
          ) : null}
          {node.children.length ? (
            <section className="pg-space-list" aria-labelledby="pg-subspaces-heading">
              <div className="pg-room-section-heading">
                <p className="pg-eyebrow">Available spaces</p>
                <h2 id="pg-subspaces-heading">Rooms and areas</h2>
              </div>
              <div className="pg-subspace-grid">
                {node.children.map(child => (
                  <button className="pg-subspace-card" key={child.location.id} type="button" onClick={() => openSpace(child.location.id)}>
                    <LocationPhoto photoUrl={roomPhotoUrls[child.location.id]?.trim() || null} variant="subspace" />
                    <span className="pg-subspace-copy"><span className="pg-subspace-name">{child.location.name}</span><span className="pg-subspace-count">{countLabel(child.exactRecords.length)} assigned directly</span></span>
                    <ChevronRight size={19} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          ) : exactRecords.length === 0 ? (
            <p className="pg-room-empty">No child locations or paint selections are available here.</p>
          ) : null}
        </main>
      </article>
    );
  }

  if (active && selectedDocument) return (
    <div className="pg-experience">
      <nav className="pg-detail-nav" aria-label="Paint guide navigation">
        <button onClick={home} type="button"><ArrowLeft size={18} aria-hidden="true" /> Guide home</button>
        <span>{data.guide.residence_name}</span>
      </nav>
      <header className="pg-selection-heading">
        <p className="pg-eyebrow">{active.kind === "location" ? "Paint by Location" : active.kind === "category" ? "Paint by Category" : "Your paint guide"}</p>
        <h1 ref={heading} tabIndex={-1}>{selectedTitle}</h1>
        <p>{countLabel(selectedDocument.records.length)}</p>
      </header>
      {selectedDocument.records.length ? renderSpecifications(selectedDocument) : <p className="pg-empty">
        {active.kind === "all" ? "No paint selections have been added to this guide yet." : active.kind === "category" ? "No paint selections have been assigned to this category yet." : "No paint selections have been assigned to this location yet."}
      </p>}
      <button className="pg-return" onClick={home} type="button"><ArrowLeft size={16} aria-hidden="true" /> Back to guide home</button>
    </div>
  );

  return (
    <article className="pg-experience">
      <header className={showHeroImage ? "pg-hero pg-hero--photo" : "pg-hero"}>
        {showHeroImage ? <img
          className="pg-hero-background"
          src={resolvedHeroImageUrl ?? undefined}
          alt={`Photograph of ${data.guide.residence_name}`}
          onError={() => setFailedHeroImageUrl(resolvedHeroImageUrl)}
        /> : null}
        <div className="pg-hero-copy">
          <p className="pg-eyebrow">Tauro Painting</p>
          <h1 ref={heading} tabIndex={-1}>{data.guide.residence_name}</h1>
          <p className="pg-hero-subtitle">Paint Color Guide</p>
        </div>
        {showHeroImage ? null : <div className="pg-residence-placeholder" role="img" aria-label="Residence photograph not added">
          <House strokeWidth={0.7} aria-hidden="true" />
          <span>Residence photograph not added</span>
        </div>}
        <button className="pg-explore" type="button" onClick={() => { locationSection.current?.scrollIntoView({ behavior: "instant", block: "start" }); locationSection.current?.focus({ preventScroll: true }); }}>
          Explore your home <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </header>
      {(propertyMetadata(data.guide).place || propertyMetadata(data.guide).propertyType) ? <div className="pg-property-meta" aria-label="Property details">
        {propertyMetadata(data.guide).place ? <span><House size={15} aria-hidden="true" />{propertyMetadata(data.guide).place}</span> : null}
        {propertyMetadata(data.guide).propertyType ? <span><Layers3 size={15} aria-hidden="true" />{propertyMetadata(data.guide).propertyType}</span> : null}
      </div> : null}
      <div className="pg-intro-strip"><House size={16} aria-hidden="true" /><span>Your home. Every finish, thoughtfully recorded.</span></div>
      <div className="pg-landing-content">
        <section ref={locationSection} tabIndex={-1} aria-labelledby="pg-location-heading" className="pg-location-section">
          <div className="pg-section-heading"><p className="pg-eyebrow">A place for every color</p><h2 id="pg-location-heading">Paint by Location</h2><p>Explore paint selections by their recorded location.</p></div>
          {navigation.locations.length ? <div className="pg-location-grid">
            {navigation.locations.map(location => {
              const roomNode = rooms.nodeFor(location.id);
              const aggregateCount = roomNode?.aggregateRecords.length ?? location.records.length;
              const photoUrl = roomPhotoUrls[location.id]?.trim() || null;
              const countText = roomNode?.children.length
                ? `${countLabel(aggregateCount)} across this location and nested spaces`
                : `${countLabel(aggregateCount)} assigned here`;
              return <button className="pg-location-card" key={location.id} type="button" onClick={() => openSpace(location.id)} aria-label={`View colors for ${location.name}, ${countText}`}>
                <LocationPhoto photoUrl={photoUrl} />
                <div className="pg-location-card-copy"><h3>{location.name}</h3><div className="pg-location-card-footer"><span>{countText}</span><span className="pg-view-colors">View colors <ChevronRight size={16} aria-hidden="true" /></span></div></div>
              </button>;
            })}
          </div> : <p className="pg-empty">Locations have not been added yet. You can still browse all paint selections below.</p>}
        </section>
        <section className="pg-category-section" aria-labelledby="pg-category-heading">
          <div className="pg-section-heading"><p className="pg-eyebrow">The finishing details</p><h2 id="pg-category-heading">Paint by Category</h2><p>Browse the surfaces that make up your home.</p></div>
          {navigation.categories.length ? <div className="pg-category-grid" aria-label="Paint categories">
            {navigation.categories.map(category => <button className="pg-category-card" type="button" key={category.id} onClick={() => open({ kind: "category", id: category.id })} aria-label={`Browse ${category.name}, ${countLabel(category.records.length)}`}>
              <div className="pg-category-mark" aria-hidden="true">
                {category.records[0] && verifiedSwatchForRecord(category.records[0])
                  ? <span className="pg-category-swatch" style={{ backgroundColor: verifiedSwatchForRecord(category.records[0])!.hex }} />
                  : <PaintRoller size={25} strokeWidth={1} />}
              </div><h3>{category.name}</h3><div><span>{category.records.length} {category.records.length === 1 ? "color" : "colors"}</span><ChevronRight size={14} aria-hidden="true" /></div>
            </button>)}
          </div> : <p className="pg-empty">Paint selections have not been added yet.</p>}
          <button className="pg-all-colors" type="button" onClick={() => open({ kind: "all" })}>View all paint selections <ArrowUpRight size={18} aria-hidden="true" /></button>
        </section>
        {data.guide.primary_scope_note ? <aside className="pg-scope-note"><span className="pg-eyebrow">A note for your home</span><p>{data.guide.primary_scope_note}</p></aside> : null}
        <footer className="pg-landing-footer"><p className="pg-eyebrow">Tauro Painting</p><p>Thoughtful finishes. A lasting reference.</p></footer>
      </div>
    </article>
  );
}
