import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GuideEditorNav } from "../components/GuideEditorNav";
import { StaffPageShell } from "../components/StaffPageShell";
import {
  createPaintRecord,
  deletePaintRecord,
  listPaintRecords,
  updatePaintRecord,
  type PaintRecordInput,
} from "../data/paint-records";
import {
  listPaintRecordLocations,
  savePaintRecordLocations,
} from "../data/paint-record-locations";
import { getPaintGuide } from "../data/guides";
import { listGuideLocations } from "../data/locations";
import type {
  GuideLocation,
  PaintGuide,
  PaintRecord,
  PaintRecordLocation,
  PaintRecordSection,
} from "../data/types";
import { homeownerDesignErrorMessage } from "../data/homeowner-design-schema";
import { applyCatalogReference, COLOR_CATALOG_BRANDS, PaintCatalogError, searchPaintColors, type CatalogColor, type ColorOriginSlug } from "../catalog/catalog";

const sections: PaintRecordSection[] = ["primary", "exception", "additional"];
const sectionOrder: Record<PaintRecordSection, number> = {
  primary: 0,
  exception: 1,
  additional: 2,
};

const createError = "Could not add paint record. Please try again.";
const saveError = "Could not save paint record. Please try again.";
const deleteError = "Could not delete paint record. Please try again.";
const saveLocationsError = "Could not save locations. Please try again.";
const refreshLocationsError =
  "Could not refresh location assignments. Reload this page before editing locations again.";
const savedLocationsRefreshError =
  "Locations were saved, but the latest assignments could not be refreshed. Reload this page before editing locations again.";

type LoadState = "loading" | "ready" | "not_found" | "error";
type TextField =
  | "surface"
  | "colorName"
  | "brand"
  | "product"
  | "colorCode"
  | "swatchHex"
  | "swatchProvenance"
  | "colorOriginBrand"
  | "colorReferenceHex"
  | "colorReferenceProvider"
  | "colorReferenceId"
  | "sheen";

function sectionHeading(section: PaintRecordSection) {
  if (section === "primary") return "Primary";
  if (section === "exception") return "Exceptions";
  return "Additional";
}

function blankRecord(designFieldsAvailable = true): PaintRecordInput {
  return {
    section: "primary",
    surface: "",
    colorName: "",
    brand: "",
    product: "",
    colorCode: "",
    swatchHex: "",
    swatchProvenance: "",
    colorOriginBrand: "",
    colorReferenceHex: "",
    colorReferenceProvider: "",
    colorReferenceId: "",
    colorReferenceUrl: "",
    colorReferenceRetrievedAt: "",
    sheen: "",
    homeowner_design_fields_available: designFieldsAvailable,
    notes: "",
    sortOrder: 0,
  };
}

function recordInput(record: PaintRecord): PaintRecordInput {
  return {
    section: record.section,
    surface: record.surface,
    colorName: record.color_name,
    brand: record.brand ?? "",
    product: record.product ?? "",
    colorCode: record.color_code ?? "",
    swatchHex: record.swatch_hex ?? "",
    swatchProvenance: record.swatch_provenance ?? "",
    colorOriginBrand: record.color_origin_brand ?? "",
    colorReferenceHex: record.color_reference_hex ?? "",
    colorReferenceProvider: record.color_reference_provider ?? "",
    colorReferenceId: record.color_reference_id ?? "",
    colorReferenceUrl: record.color_reference_url ?? "",
    colorReferenceRetrievedAt: record.color_reference_retrieved_at ?? "",
    sheen: record.sheen ?? "",
    homeowner_design_fields_available: record.homeowner_design_fields_available,
    notes: record.notes ?? "",
    sortOrder: record.sort_order,
  };
}

function sortRecords(records: PaintRecord[]) {
  return [...records].sort(
    (a, b) =>
      sectionOrder[a.section] - sectionOrder[b.section] ||
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
}

function nextSortOrder(records: PaintRecord[]) {
  return records.length
    ? Math.max(...records.map((record) => record.sort_order)) + 10
    : 0;
}

function locationLabel(location: GuideLocation, locations: GuideLocation[]) {
  const parent = location.parent_id
    ? locations.find((item) => item.id === location.parent_id)
    : null;
  return parent ? `${parent.name} › ${location.name}` : location.name;
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

    const children = childrenByParent.get(parent.id) ?? [];
    children.sort(compareLocations).forEach((child) => {
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

function PaintRecordForm({
  initial,
  onSave,
  onCancel,
  pending,
  failureMessage,
  submitLabel,
  pendingLabel,
  catalogFieldsAvailable,
}: {
  initial: PaintRecordInput;
  onSave: (value: PaintRecordInput) => Promise<boolean>;
  onCancel: () => void;
  pending: boolean;
  failureMessage: string;
  submitLabel: string;
  pendingLabel: string;
  catalogFieldsAvailable: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [catalogBrand, setCatalogBrand] = useState<ColorOriginSlug>("sherwin-williams");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogColors, setCatalogColors] = useState<CatalogColor[]>([]);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [catalogBusy, setCatalogBusy] = useState(false);
  const catalogRequest = useRef<AbortController | null>(null);

  useEffect(() => () => catalogRequest.current?.abort(), []);

  async function searchCatalog() {
    catalogRequest.current?.abort();
    const controller = new AbortController();
    catalogRequest.current = controller;
    setCatalogBusy(true);
    setCatalogMessage("");
    setCatalogColors([]);
    try {
      const result = await searchPaintColors({ brand: catalogBrand, query: catalogQuery, signal: controller.signal });
      if (catalogRequest.current !== controller) return;
      setCatalogColors(result.colors);
      setCatalogMessage(result.colors.length ? `${result.total === null ? result.colors.length : result.total} matching reference colors. Choose one to fill the color name, code, and separate approximate swatch.` : "No matches. You can enter the color manually.");
    } catch (caught) {
      if (catalogRequest.current !== controller) return;
      setCatalogMessage(caught instanceof PaintCatalogError ? caught.message : "Color search failed. You can enter the color manually.");
    } finally {
      if (catalogRequest.current === controller) {
        catalogRequest.current = null;
        setCatalogBusy(false);
      }
    }
  }

  function field(key: TextField, label: string, required = false) {
    const newDesignField = key === "swatchHex" || key === "swatchProvenance";
    return (
      <label className="text-sm font-semibold">
        {label}
        <input
          className="mt-1 w-full border border-[#20211f]/25 px-3 py-2 disabled:bg-[#20211f]/5"
          disabled={pending || (newDesignField && value.homeowner_design_fields_available === false)}
          onChange={(event) =>
            setValue((current) => {
              const next = { ...current, [key]: event.target.value };
              if (key === "colorName" || key === "colorCode") {
                next.colorOriginBrand = "";
                next.colorReferenceHex = "";
                next.colorReferenceProvider = "";
                next.colorReferenceId = "";
                next.colorReferenceUrl = "";
                next.colorReferenceRetrievedAt = "";
              }
              return next;
            })
          }
          required={required}
          value={value[key]}
        />
      </label>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!value.surface.trim() || !value.colorName.trim()) {
      setError("Surface and Color Name are required.");
      return;
    }
    if (value.colorReferenceId && initial.colorName !== value.colorName && value.swatchHex.trim()) {
      setError("The existing verified swatch is attached to the previous color. Clear it or re-enter its verified value and source before saving this new color reference. Review any formula-label photos separately.");
      return;
    }
    if (Boolean(value.swatchHex.trim()) !== Boolean(value.swatchProvenance.trim()) || (value.swatchHex.trim() && !/^#[\da-f]{6}$/i.test(value.swatchHex.trim()))) {
      setError("A verified swatch needs a six-digit hex value and its source. Leave both blank when unknown.");
      return;
    }

    setError("");

    try {
      if (!(await onSave(value))) setError(failureMessage);
    } catch {
      setError(failureMessage);
    }
  }

  return (
    <form
      className="mt-5 grid gap-3 border border-[#20211f]/15 bg-white p-5 sm:grid-cols-2"
      onSubmit={(event) => void submit(event)}
    >
      <section className="border border-[#9b6b36]/35 bg-[#faf8f4] p-4 sm:col-span-2" aria-label="Color catalog reference">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]">Find a color reference</p>
        {catalogFieldsAvailable ? <>
          <p className="mt-1 text-xs text-[#20211f]/65">Independent digital approximation. It does not verify the can formula or change the paint brand, product, or sheen used.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
            <label className="text-sm font-semibold">Color-origin brand
              <select className="mt-1 w-full border border-[#20211f]/25 bg-white px-3 py-2" disabled={pending || catalogBusy} value={catalogBrand} onChange={(event) => setCatalogBrand(event.target.value as ColorOriginSlug)}>
                {COLOR_CATALOG_BRANDS.map((brand) => <option key={brand.slug} value={brand.slug}>{brand.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Search name or code
              <input className="mt-1 w-full border border-[#20211f]/25 px-3 py-2" disabled={pending || catalogBusy} maxLength={80} value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="e.g. White Dove or OC-17" />
            </label>
            <button className="self-end border border-[#20211f] px-3 py-2 text-xs font-semibold uppercase disabled:opacity-60" disabled={pending || catalogBusy || !catalogQuery.trim()} onClick={() => void searchCatalog()} type="button">{catalogBusy ? "Searching…" : "Search"}</button>
          </div>
          {catalogMessage ? <p className="mt-2 text-sm" role="status">{catalogMessage}</p> : null}
          {catalogColors.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Color reference results">
            {catalogColors.map((color) => <li key={color.id} className="flex items-center gap-3 border border-[#20211f]/15 bg-white p-3">
              <span className="h-10 w-10 shrink-0 border border-black/20" style={{ backgroundColor: color.referenceHex }} aria-label={`Approximate swatch ${color.referenceHex}`} />
              <div className="min-w-0 flex-1 text-sm"><strong>{color.name}</strong><span className="ml-2">{color.code}</span><p className="text-xs text-[#20211f]/60">{color.colorOrigin.name} · PaintDB reference · {color.referenceHex}{color.lrv === null ? "" : ` · LRV ${color.lrv}`}{color.sourceUrl ? <> · <a className="underline" href={color.sourceUrl} target="_blank" rel="noreferrer">Source</a></> : " · No source link"}</p></div>
              <button className="border border-[#20211f] px-2 py-1 text-xs font-semibold" disabled={pending || !color.sourceUrl} onClick={() => { setValue((current) => applyCatalogReference(current, color)); setError(""); setCatalogMessage(`${color.name} (${color.code}) selected. Review the changed name/code before saving.`); setCatalogColors([]); }} type="button">Use reference</button>
            </li>)}
          </ul> : null}
          {value.colorReferenceHex ? <div className="mt-3 flex items-center gap-2 text-xs" role="status"><span className="h-5 w-5 border border-black/20" style={{ backgroundColor: value.colorReferenceHex }} />Selected approximate swatch {value.colorReferenceHex} · {value.colorOriginBrand} · {value.colorReferenceProvider} · retrieved {value.colorReferenceRetrievedAt.slice(0, 10)}. Verify with a physical sample.</div> : null}
          {value.colorReferenceId && initial.colorName !== value.colorName && value.swatchHex.trim() ? <p className="mt-2 text-sm text-[#9c2f2f]" role="alert">This record has a verified swatch for the previous color. Review it and its source before saving; formula-label photos must be reviewed separately.</p> : null}
          <p className="mt-2 text-[11px] text-[#20211f]/55">Color data via PaintDB. Independent reference, not manufacturer-verified. Verify color in person. <a className="underline" href="https://paintdb.com/api/v1" target="_blank" rel="noreferrer">API information</a>.</p>
        </> : <p className="mt-2 text-sm text-[#20211f]/65">Catalog references need the separate Paint Guide catalog-fields migration. Manual paint entry remains available.</p>}
      </section>
      <label className="text-sm font-semibold">
        Section
        <select
          className="mt-1 w-full border border-[#20211f]/25 px-3 py-2 disabled:bg-[#20211f]/5"
          disabled={pending}
          onChange={(event) =>
            setValue((current) => ({
              ...current,
              section: event.target.value as PaintRecordSection,
            }))
          }
          value={value.section}
        >
          {sections.map((section) => (
            <option key={section} value={section}>
              {sectionHeading(section)}
            </option>
          ))}
        </select>
      </label>
      {field("surface", "Surface", true)}
      {field("colorName", "Color Name", true)}
      {field("brand", "Brand")}
      {field("product", "Product")}
      {field("colorCode", "Color Code")}
      {field("swatchHex", "Verified digital color (hex; optional)")}
      {field("swatchProvenance", "Swatch source / verification (optional)")}
      {field("sheen", "Sheen")}
      <label className="text-sm font-semibold sm:col-span-2">
        Notes
        <textarea
          className="mt-1 w-full border border-[#20211f]/25 px-3 py-2 disabled:bg-[#20211f]/5"
          disabled={pending}
          onChange={(event) =>
            setValue((current) => ({
              ...current,
              notes: event.target.value,
            }))
          }
          value={value.notes}
        />
      </label>
      {error ? (
        <p className="text-sm text-[#9c2f2f] sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3 sm:col-span-2">
        <button
          className="bg-[#20211f] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        <button
          className="text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function GuideColors() {
  const { guideId = "" } = useParams();
  const mountedRef = useRef(true);
  const currentGuideIdRef = useRef(guideId);
  currentGuideIdRef.current = guideId;
  const [guide, setGuide] = useState<PaintGuide | null>(null);
  const [records, setRecords] = useState<PaintRecord[]>([]);
  const [locations, setLocations] = useState<GuideLocation[]>([]);
  const [assignments, setAssignments] = useState<PaintRecordLocation[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assignmentEditorId, setAssignmentEditorId] = useState<string | null>(
    null,
  );
  const [assignmentDraftLocationIds, setAssignmentDraftLocationIds] = useState<
    string[]
  >([]);
  const [createPending, setCreatePending] = useState(false);
  const [editPendingId, setEditPendingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [assignmentPendingId, setAssignmentPendingId] = useState<string | null>(
    null,
  );
  const [deleteFailure, setDeleteFailure] = useState("");
  const [assignmentFailure, setAssignmentFailure] = useState("");
  const [assignmentFailureRecordId, setAssignmentFailureRecordId] = useState<
    string | null
  >(null);
  const [assignmentStateTrusted, setAssignmentStateTrusted] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [designDataError, setDesignDataError] = useState("");
  const [catalogFieldsAvailable, setCatalogFieldsAvailable] = useState(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    setState("loading");
    setGuide(null);
    setRecords([]);
    setLocations([]);
    setAssignments([]);
    setAdding(false);
    setEditingId(null);
    setDeletingId(null);
    setAssignmentEditorId(null);
    setAssignmentDraftLocationIds([]);
    setAssignmentPendingId(null);
    setDeleteFailure("");
    setAssignmentFailure("");
    setAssignmentFailureRecordId(null);
    setAssignmentStateTrusted(true);

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
        setRecords(sortRecords(nextRecords));
        setCatalogFieldsAvailable((nextRecords as PaintRecord[] & { catalog_reference_fields_available?: boolean }).catalog_reference_fields_available !== false);
        setLocations(nextLocations);
        setAssignments(nextAssignments);
        setState("ready");
      } catch (error) {
        if (active) { setLoadError(homeownerDesignErrorMessage(error, "Please try again.")); setState("error"); }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [guideId]);

  const mutationPending =
    createPending ||
    editPendingId !== null ||
    deletePendingId !== null ||
    assignmentPendingId !== null || guide?.homeowner_design_fields_available === false;
  const interactionActive =
    adding ||
    editingId !== null ||
    deletingId !== null ||
    assignmentEditorId !== null;

  function upsertRecord(next: PaintRecord) {
    setRecords((current) => {
      const exists = current.some((record) => record.id === next.id);
      const updated = exists
        ? current.map((record) => (record.id === next.id ? next : record))
        : [...current, next];
      return sortRecords(updated);
    });
  }

  function assignedLocationIds(paintRecordId: string) {
    return assignments
      .filter((assignment) => assignment.paint_record_id === paintRecordId)
      .map((assignment) => assignment.location_id);
  }

  function assignedLocations(paintRecordId: string) {
    const assignedIds = new Set(assignedLocationIds(paintRecordId));
    return hierarchyOrderedLocations(locations).filter((location) =>
      assignedIds.has(location.id),
    );
  }

  function openAssignmentEditor(paintRecordId: string) {
    setDeleteFailure("");
    setAssignmentFailure("");
    setAssignmentFailureRecordId(null);
    setAssignmentDraftLocationIds(assignedLocationIds(paintRecordId));
    setAssignmentEditorId(paintRecordId);
  }

  function closeAssignmentEditor() {
    setAssignmentEditorId(null);
    setAssignmentDraftLocationIds([]);
    setAssignmentFailure("");
    setAssignmentFailureRecordId(null);
  }

  function isCurrentAssignmentRequest(originatingGuideId: string) {
    return (
      mountedRef.current && currentGuideIdRef.current === originatingGuideId
    );
  }

  function toggleAssignmentLocation(locationId: string, selected: boolean) {
    setAssignmentDraftLocationIds((current) => {
      const next = new Set(current);
      if (selected) next.add(locationId);
      else next.delete(locationId);
      return [...next];
    });
  }

  async function saveAssignments(paintRecordId: string) {
    if (!assignmentStateTrusted) return;

    const originatingGuideId = guideId;
    const currentLocationIds = assignedLocationIds(paintRecordId);
    setAssignmentPendingId(paintRecordId);
    setAssignmentFailure("");
    setAssignmentFailureRecordId(null);

    try {
      await savePaintRecordLocations(
        originatingGuideId,
        paintRecordId,
        currentLocationIds,
        assignmentDraftLocationIds,
      );
    } catch {
      if (!isCurrentAssignmentRequest(originatingGuideId)) return;

      setAssignmentFailure(saveLocationsError);
      setAssignmentFailureRecordId(paintRecordId);

      try {
        const nextAssignments = await listPaintRecordLocations(originatingGuideId);
        if (!isCurrentAssignmentRequest(originatingGuideId)) return;

        setAssignments(nextAssignments);
        setAssignmentDraftLocationIds(
          nextAssignments
            .filter(
              (assignment) => assignment.paint_record_id === paintRecordId,
            )
            .map((assignment) => assignment.location_id),
        );
      } catch {
        if (!isCurrentAssignmentRequest(originatingGuideId)) return;

        setAssignmentStateTrusted(false);
        setAssignmentFailure(refreshLocationsError);
        setAssignmentFailureRecordId(paintRecordId);
      } finally {
        if (isCurrentAssignmentRequest(originatingGuideId)) {
          setAssignmentPendingId(null);
        }
      }

      return;
    }

    if (!isCurrentAssignmentRequest(originatingGuideId)) return;

    try {
      const nextAssignments = await listPaintRecordLocations(originatingGuideId);
      if (!isCurrentAssignmentRequest(originatingGuideId)) return;

      setAssignments(nextAssignments);
      closeAssignmentEditor();
    } catch {
      if (!isCurrentAssignmentRequest(originatingGuideId)) return;

      setAssignmentStateTrusted(false);
      setAssignmentFailure(savedLocationsRefreshError);
      setAssignmentFailureRecordId(paintRecordId);
      setAssignmentEditorId(null);
      setAssignmentDraftLocationIds([]);
    } finally {
      if (isCurrentAssignmentRequest(originatingGuideId)) {
        setAssignmentPendingId(null);
      }
    }
  }

  async function createRecord(input: PaintRecordInput) {
    setCreatePending(true);

    try {
      const next = await createPaintRecord(guideId, {
        ...input,
        sortOrder: nextSortOrder(
          records.filter((record) => record.section === input.section),
        ),
      });
      upsertRecord(next);
      setAdding(false);
      return true;
    } catch (error) {
      setDesignDataError(homeownerDesignErrorMessage(error, ""));
      return false;
    } finally {
      setCreatePending(false);
    }
  }

  async function saveRecord(id: string, input: PaintRecordInput) {
    const currentRecord = records.find((record) => record.id === id);
    if (!currentRecord) return false;

    const sortOrder =
      currentRecord.section === input.section
        ? currentRecord.sort_order
        : nextSortOrder(
            records.filter(
              (record) => record.section === input.section && record.id !== id,
            ),
          );

    setEditPendingId(id);

    try {
      const next = await updatePaintRecord(guideId, id, {
        ...input,
        sortOrder,
      });
      upsertRecord(next);
      setEditingId(null);
      return true;
    } catch (error) {
      setDesignDataError(homeownerDesignErrorMessage(error, ""));
      return false;
    } finally {
      setEditPendingId(null);
    }
  }

  async function removeRecord(id: string) {
    setDeletePendingId(id);
    setDeleteFailure("");

    try {
      await deletePaintRecord(guideId, id);
      setRecords((current) => current.filter((record) => record.id !== id));
      setAssignments((current) =>
        current.filter((assignment) => assignment.paint_record_id !== id),
      );
      setDeletingId(null);
    } catch (error) {
      setDeleteFailure(homeownerDesignErrorMessage(error, deleteError));
    } finally {
      setDeletePendingId(null);
    }
  }

  if (state === "loading") {
    return (
      <StaffPageShell title="Paint Guide">
        <p className="py-12 text-sm uppercase tracking-[0.14em] text-[#20211f]/60">
          Loading colors…
        </p>
      </StaffPageShell>
    );
  }

  if (state === "not_found") {
    return (
      <StaffPageShell title="Paint Guide">
        <section className="py-12">
          <h2 className="font-serif text-3xl">Paint Guide not found</h2>
          <Link
            className="mt-6 inline-flex border border-[#20211f] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]"
            to="/paint-guide"
          >
            Back to Paint Guides
          </Link>
        </section>
      </StaffPageShell>
    );
  }

  if (state === "error") {
    return (
      <StaffPageShell title="Paint Guide">
        <section className="py-12">
          <h2 className="font-serif text-3xl">Could not load colors.</h2>
          <p className="mt-3 text-[#20211f]/65" role="alert">{loadError || "Please try again."}</p>
          <Link
            className="mt-6 inline-flex border border-[#20211f] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]"
            to="/paint-guide"
          >
            Back to Paint Guides
          </Link>
        </section>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell title={guide?.residence_name ?? "Paint Guide"}>
      <GuideEditorNav active="colors" />
      {guide?.homeowner_design_fields_available === false ? <p className="mt-5 border border-[#9c2f2f]/25 bg-[#fff7f3] p-4 text-sm text-[#792c25]" role="status">Digital swatches are unavailable until the reviewed database migration is applied. Existing paint records are shown; writes are paused to avoid dropping fields.</p> : null}
      {designDataError ? <p className="mt-5 border border-[#9c2f2f]/30 bg-[#fff7f3] p-4 text-sm text-[#792c25]" role="alert">{designDataError}</p> : null}
      <section className="py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6b36]">
              Colors &amp; finishes
            </p>
            <h2 className="mt-3 font-serif text-3xl">Paint specifications</h2>
          </div>
          <button
            className="bg-[#20211f] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60"
            disabled={interactionActive || mutationPending}
            onClick={() => setAdding(true)}
            type="button"
          >
            Add Paint Record
          </button>
        </div>

        {guide?.primary_scope_note ? (
          <div className="mt-6 max-w-2xl border-l-2 border-[#9b6b36] pl-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#20211f]/50">
              Primary scope note
            </p>
            <p className="mt-2 text-[#20211f]/65">
              {guide.primary_scope_note}
            </p>
          </div>
        ) : null}

        {adding ? (
          <PaintRecordForm
            failureMessage={createError}
            initial={blankRecord(guide?.homeowner_design_fields_available !== false)}
            onCancel={() => setAdding(false)}
            onSave={createRecord}
            pending={createPending}
            pendingLabel="Adding…"
            submitLabel="Add Paint Record"
            catalogFieldsAvailable={catalogFieldsAvailable}
          />
        ) : null}

        {records.length === 0 ? (
          <div className="mt-8 max-w-2xl border border-[#20211f]/15 bg-white p-8">
            <h3 className="font-serif text-2xl">No paint records yet.</h3>
            <p className="mt-3 text-[#20211f]/65">
              Add the primary paint specifications for this residence.
            </p>
          </div>
        ) : (
          sections.map((section) => (
            <div className="mt-10" key={section}>
              <h2 className="font-serif text-3xl">
                {sectionHeading(section)}
              </h2>
              {records
                .filter((record) => record.section === section)
                .map((record) => (
                  <article
                    className="mt-4 border border-[#20211f]/15 bg-white p-5"
                    key={record.id}
                  >
                    {editingId === record.id ? (
                      <PaintRecordForm
                        failureMessage={saveError}
                        initial={recordInput(record)}
                        onCancel={() => setEditingId(null)}
                        onSave={(input) => saveRecord(record.id, input)}
                        pending={editPendingId === record.id}
                        pendingLabel="Saving…"
                        submitLabel="Save"
                        catalogFieldsAvailable={catalogFieldsAvailable}
                      />
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="font-serif text-xl">
                              {record.surface}
                            </h3>
                            <p>
                              {record.color_name}
                              {record.sheen ? ` · ${record.sheen}` : ""}
                            </p>
                            {record.color_reference_hex && /^#[\da-f]{6}$/i.test(record.color_reference_hex) ? <p className="mt-2 flex items-center gap-2 text-xs text-[#20211f]/65"><span className="h-5 w-5 border border-black/20" style={{ backgroundColor: record.color_reference_hex }} />Approximate {record.color_origin_brand} color reference {record.color_reference_hex}; not manufacturer-verified. {record.color_reference_url ? <a className="underline" href={record.color_reference_url} target="_blank" rel="noreferrer">PaintDB source</a> : null}</p> : null}
                            {[record.brand, record.product, record.color_code, record.notes]
                              .filter(Boolean)
                              .map((detail, index) => (
                                <p
                                  className="text-sm text-[#20211f]/65"
                                  key={index}
                                >
                                  {detail}
                                </p>
                              ))}
                            <p className="mt-3 text-sm text-[#20211f]/65">
                              {!assignmentStateTrusted
                                ? "Location assignments need a page reload."
                                : assignedLocations(record.id).length
                                ? assignedLocations(record.id)
                                    .map((location) =>
                                      locationLabel(location, locations),
                                    )
                                    .join(", ")
                                : "No locations assigned."}
                            </p>
                          </div>
                          <div className="flex gap-3 text-xs font-semibold uppercase tracking-[0.12em]">
                            <button
                              disabled={interactionActive || mutationPending}
                              onClick={() => {
                                setDeletingId(null);
                                setDeleteFailure("");
                                setEditingId(record.id);
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              disabled={
                                interactionActive ||
                                mutationPending ||
                                !assignmentStateTrusted
                              }
                              onClick={() => openAssignmentEditor(record.id)}
                              type="button"
                            >
                              Manage Locations
                            </button>
                            <button
                              className="text-[#9c2f2f] disabled:opacity-60"
                              disabled={interactionActive || mutationPending}
                              onClick={() => {
                                setEditingId(null);
                                setDeleteFailure("");
                                setDeletingId(record.id);
                              }}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {assignmentFailure &&
                        assignmentFailureRecordId === record.id &&
                        assignmentEditorId !== record.id ? (
                          <p
                            className="mt-3 text-sm text-[#9c2f2f]"
                            role="alert"
                          >
                            {assignmentFailure}
                          </p>
                        ) : null}

                        {assignmentEditorId === record.id ? (
                          <div className="mt-4 border-t border-[#20211f]/15 pt-4">
                            <h4 className="font-serif text-lg">
                              Manage Locations
                            </h4>
                            {locations.length === 0 ? (
                              <div className="mt-3 text-sm text-[#20211f]/65">
                                <p>No locations available.</p>
                                <Link
                                  className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.12em] underline"
                                  to={`/paint-guide/g/${guideId}/locations`}
                                >
                                  Add locations
                                </Link>
                              </div>
                            ) : (
                              <fieldset
                                className="mt-4 space-y-3"
                                disabled={
                                  assignmentPendingId === record.id ||
                                  !assignmentStateTrusted
                                }
                              >
                                <legend className="sr-only">
                                  Locations for {record.surface}
                                </legend>
                                {hierarchyOrderedLocations(locations).map(
                                  (location) => (
                                  <label
                                    className={`flex items-center gap-3 text-sm ${
                                      location.parent_id ? "ml-5" : ""
                                    }`}
                                    key={location.id}
                                  >
                                    <input
                                      checked={assignmentDraftLocationIds.includes(
                                        location.id,
                                      )}
                                      onChange={(event) =>
                                        toggleAssignmentLocation(
                                          location.id,
                                          event.target.checked,
                                        )
                                      }
                                      type="checkbox"
                                    />
                                    {locationLabel(location, locations)}
                                  </label>
                                  ),
                                )}
                              </fieldset>
                            )}
                            {assignmentFailure ? (
                              <p
                                className="mt-3 text-sm text-[#9c2f2f]"
                                role="alert"
                              >
                                {assignmentFailure}
                              </p>
                            ) : null}
                            <div className="mt-4 flex gap-3">
                              <button
                                className="bg-[#20211f] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60"
                                disabled={
                                  locations.length === 0 ||
                                  assignmentPendingId === record.id ||
                                  !assignmentStateTrusted
                                }
                                onClick={() => void saveAssignments(record.id)}
                                type="button"
                              >
                                {assignmentPendingId === record.id
                                  ? "Saving Locations…"
                                  : "Save Locations"}
                              </button>
                              <button
                                className="text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
                                disabled={assignmentPendingId === record.id}
                                onClick={closeAssignmentEditor}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {deletingId === record.id ? (
                          <div className="mt-4 border-t border-[#9c2f2f]/20 pt-4 text-sm">
                            <p>
                              Delete this Paint Record? This permanently removes
                              this paint specification.
                            </p>
                            {deleteFailure ? (
                              <p
                                className="mt-3 text-[#9c2f2f]"
                                role="alert"
                              >
                                {deleteFailure}
                              </p>
                            ) : null}
                            <div className="mt-3 flex gap-3">
                              <button
                                className="font-semibold text-[#9c2f2f] disabled:opacity-60"
                                disabled={deletePendingId === record.id}
                                onClick={() => void removeRecord(record.id)}
                                type="button"
                              >
                                {deletePendingId === record.id
                                  ? "Deleting…"
                                  : "Delete"}
                              </button>
                              <button
                                disabled={deletePendingId === record.id}
                                onClick={() => {
                                  setDeletingId(null);
                                  setDeleteFailure("");
                                }}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                ))}
            </div>
          ))
        )}
      </section>
    </StaffPageShell>
  );
}

