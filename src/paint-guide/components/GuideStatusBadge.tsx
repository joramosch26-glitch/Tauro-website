import type { PaintGuideStatus } from "../data/types";

const statusStyles: Record<PaintGuideStatus, string> = {
  draft: "border-[#9b6b36]/35 bg-[#f5f1e8] text-[#745027]",
  published: "border-[#53634f]/35 bg-[#edf2ea] text-[#40513c]",
  archived: "border-[#20211f]/15 bg-[#20211f]/5 text-[#20211f]/60",
};

const statusLabels: Record<PaintGuideStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export function GuideStatusBadge({ status }: { status: PaintGuideStatus }) {
  return (
    <span
      className={`inline-flex border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
