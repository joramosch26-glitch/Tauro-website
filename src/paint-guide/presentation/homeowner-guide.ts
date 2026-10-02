import type {
  HomeownerGuideDocumentData,
  HomeownerGuideLocation,
  HomeownerPaintRecord,
  HomeownerPaintRecordSection,
} from "./types";

export const sections: HomeownerPaintRecordSection[] = ["primary", "exception", "additional"];
const sectionOrder: Record<HomeownerPaintRecordSection, number> = {
  primary: 0,
  exception: 1,
  additional: 2,
};

export function sectionHeading(section: HomeownerPaintRecordSection) {
  if (section === "primary") return "Primary";
  if (section === "exception") return "Exceptions";
  return "Additional";
}

function compareRecords(a: HomeownerPaintRecord, b: HomeownerPaintRecord) {
  return (
    sectionOrder[a.section] - sectionOrder[b.section] ||
    a.sort_order - b.sort_order ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

function compareLocations(a: HomeownerGuideLocation, b: HomeownerGuideLocation) {
  return (
    a.sort_order - b.sort_order ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

function hierarchyOrderedLocations(locations: HomeownerGuideLocation[]) {
  const topLevel = locations
    .filter((location) => location.parent_id === null)
    .sort(compareLocations);
  const childrenByParent = new Map<string, HomeownerGuideLocation[]>();

  locations
    .filter((location) => location.parent_id !== null)
    .forEach((location) => {
      const children = childrenByParent.get(location.parent_id!) ?? [];
      children.push(location);
      childrenByParent.set(location.parent_id!, children);
    });

  const ordered: HomeownerGuideLocation[] = [];
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

export function locationLabel(location: HomeownerGuideLocation, locations: HomeownerGuideLocation[]) {
  const parent = location.parent_id
    ? locations.find((item) => item.id === location.parent_id)
    : null;
  return parent ? `${parent.name} › ${location.name}` : location.name;
}

export function buildHomeownerGuidePresentation(data: HomeownerGuideDocumentData) {
  const records = [...data.records].sort(compareRecords);
  const { locations, assignments } = data;

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

  const primaryRecords = records.filter((record) => record.section === "primary");
  const exceptionRecords = records.filter((record) => record.section === "exception");
  const additionalRecords = records.filter((record) => record.section === "additional");
  const orderedLocations = hierarchyOrderedLocations(locations);
  const exceptionLocationGroups = orderedLocations
    .map((location) => {
      // Exact junction rows only; recordsForLocation deduplicates assignment IDs.
      const locationRecords = recordsForLocation(location.id)
        .filter((record) => record.section === "exception")
        .sort(compareRecords);
      const parent = location.parent_id
        ? locations.find((item) => item.id === location.parent_id && item.id !== location.id)
        : undefined;
      return { location, parentName: parent?.name, records: locationRecords };
    })
    .filter((group) => group.records.length > 0);
  const assignedExceptionIds = new Set(
    exceptionLocationGroups.flatMap((group) => group.records.map((record) => record.id)),
  );
  // Unresolved location references do not count as usable assignments.
  const unassignedExceptionRecords = exceptionRecords
    .filter((record) => !assignedExceptionIds.has(record.id))
    .sort(compareRecords);
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

  return {
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
  };
}
