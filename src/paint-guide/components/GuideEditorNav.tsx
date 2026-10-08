import { Link, useParams } from "react-router-dom";

export function GuideEditorNav({ active }: { active: "overview" | "locations" | "colors" | "preview" | "access" }) {
  const { guideId } = useParams();
  const links = [
    ["overview", "Overview", `/paint-guide/g/${guideId}`],
    ["locations", "Locations", `/paint-guide/g/${guideId}/locations`],
    ["colors", "Colors", `/paint-guide/g/${guideId}/colors`],
    ["preview", "Preview", `/paint-guide/g/${guideId}/preview`],
    ["access", "Access & QR", `/paint-guide/g/${guideId}/access`],
  ] as const;
  return <nav aria-label="Paint Guide sections" className="mt-6 flex gap-5 border-b border-[#20211f]/15 text-xs font-semibold uppercase tracking-[0.14em]">{links.map(([id, label, to]) => <Link className={`border-b-2 pb-3 ${active === id ? "border-[#9b6b36] text-[#20211f]" : "border-transparent text-[#20211f]/50 hover:text-[#20211f]"}`} key={id} to={to}>{label}</Link>)}</nav>;
}
