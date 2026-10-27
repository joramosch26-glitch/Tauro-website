import { buildHomeownerGuidePresentation } from "./homeowner-guide";
import type { HomeownerGuideDocumentData } from "./types";

export type GuideSelection = { kind: "location" | "category"; id: string } | { kind: "all" };

// Navigation is derived only from the authorized presentation DTO. No storage,
// image URLs, inferred room inheritance or database metadata are introduced.
export function buildGuideNavigation(data: HomeownerGuideDocumentData) {
  const model = buildHomeownerGuidePresentation(data);
  const orderedRecords = [...model.primaryRecords, ...model.exceptionRecords, ...model.additionalRecords];
  const covered = new Set<string>();
  const locations = [...model.topLevelLocations, ...model.orderedLocations.filter(location =>
    location.parent_id !== null && !data.locations.some(parent => parent.id === location.parent_id))];
  const groups = locations.map(location => {
    const ids = new Set([location.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const child of model.orderedLocations) {
        if (child.parent_id && ids.has(child.parent_id) && !ids.has(child.id)) { ids.add(child.id); grew = true; }
      }
    }
    ids.forEach(id => covered.add(id));
    return { id: location.id, name: location.name, locationIds: ids };
  });
  // Invalid/cyclic hierarchies must not hide existing selections.
  for (const location of model.orderedLocations) {
    if (!covered.has(location.id)) groups.push({ id: location.id, name: location.name, locationIds: new Set([location.id]) });
  }
  const locationCards = groups.map(group => {
    const recordIds = new Set(data.assignments.filter(assignment => group.locationIds.has(assignment.location_id)).map(assignment => assignment.paint_record_id));
    return { ...group, records: orderedRecords.filter(record => recordIds.has(record.id)) };
  });
  const surfaces = [...new Set(orderedRecords.map(record => record.surface))];
  const categories = surfaces.map(surface => ({ id: surface, name: surface, records: orderedRecords.filter(record => record.surface === surface) }));

  function documentFor(selection: GuideSelection): HomeownerGuideDocumentData | null {
    if (selection.kind === "all") return data;
    const group = selection.kind === "location" ? locationCards.find(item => item.id === selection.id) : categories.find(item => item.id === selection.id);
    if (!group) return null;
    const recordIds = new Set(group.records.map(record => record.id));
    const locationIds = selection.kind === "location" ? locationCards.find(item => item.id === selection.id)!.locationIds : null;
    return { guide: data.guide, records: group.records,
      locations: locationIds ? data.locations.filter(location => locationIds.has(location.id)) : data.locations,
      assignments: data.assignments.filter(assignment => recordIds.has(assignment.paint_record_id) && (!locationIds || locationIds.has(assignment.location_id))),
    };
  }
  return { locations: locationCards, categories, documentFor };
}
