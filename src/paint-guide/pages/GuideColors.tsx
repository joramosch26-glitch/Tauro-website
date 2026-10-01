import { type FormEvent, useEffect, useState } from "react";
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
import { getPaintGuide } from "../data/guides";
import type {
  PaintGuide,
  PaintRecord,
  PaintRecordSection,
} from "../data/types";

const sections: PaintRecordSection[] = ["primary", "exception", "additional"];
const sectionOrder: Record<PaintRecordSection, number> = {
  primary: 0,
  exception: 1,
  additional: 2,
};

const createError = "Could not add paint record. Please try again.";
const saveError = "Could not save paint record. Please try again.";
const deleteError = "Could not delete paint record. Please try again.";

type LoadState = "loading" | "ready" | "not_found" | "error";
type TextField =
  | "surface"
  | "colorName"
  | "brand"
  | "product"
  | "colorCode"
  | "sheen";

function sectionHeading(section: PaintRecordSection) {
  if (section === "primary") return "Primary";
  if (section === "exception") return "Exceptions";
  return "Additional";
}

function blankRecord(): PaintRecordInput {
  return {
    section: "primary",
    surface: "",
    colorName: "",
    brand: "",
    product: "",
    colorCode: "",
    sheen: "",
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
    sheen: record.sheen ?? "",
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

function PaintRecordForm({
  initial,
  onSave,
  onCancel,
  pending,
  failureMessage,
  submitLabel,
  pendingLabel,
}: {
  initial: PaintRecordInput;
  onSave: (value: PaintRecordInput) => Promise<boolean>;
  onCancel: () => void;
  pending: boolean;
  failureMessage: string;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");

  function field(key: TextField, label: string, required = false) {
    return (
      <label className="text-sm font-semibold">
        {label}
        <input
          className="mt-1 w-full border border-[#20211f]/25 px-3 py-2 disabled:bg-[#20211f]/5"
          disabled={pending}
          onChange={(event) =>
            setValue((current) => ({
              ...current,
              [key]: event.target.value,
            }))
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
  const [guide, setGuide] = useState<PaintGuide | null>(null);
  const [records, setRecords] = useState<PaintRecord[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [editPendingId, setEditPendingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [deleteFailure, setDeleteFailure] = useState("");

  useEffect(() => {
    let active = true;

    setState("loading");
    setGuide(null);
    setRecords([]);
    setAdding(false);
    setEditingId(null);
    setDeletingId(null);
    setDeleteFailure("");

    async function load() {
      try {
        const nextGuide = await getPaintGuide(guideId);
        if (!active) return;

        if (!nextGuide) {
          setState("not_found");
          return;
        }

        const nextRecords = await listPaintRecords(guideId);
        if (!active) return;

        setGuide(nextGuide);
        setRecords(sortRecords(nextRecords));
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

  const mutationPending =
    createPending || editPendingId !== null || deletePendingId !== null;
  const interactionActive =
    adding || editingId !== null || deletingId !== null;

  function upsertRecord(next: PaintRecord) {
    setRecords((current) => {
      const exists = current.some((record) => record.id === next.id);
      const updated = exists
        ? current.map((record) => (record.id === next.id ? next : record))
        : [...current, next];
      return sortRecords(updated);
    });
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
    } catch {
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
    } catch {
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
      setDeletingId(null);
    } catch {
      setDeleteFailure(deleteError);
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
          <p className="mt-3 text-[#20211f]/65">Please try again.</p>
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
            initial={blankRecord()}
            onCancel={() => setAdding(false)}
            onSave={createRecord}
            pending={createPending}
            pendingLabel="Adding…"
            submitLabel="Add Paint Record"
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
