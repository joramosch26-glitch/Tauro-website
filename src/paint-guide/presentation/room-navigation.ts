import { buildHomeownerGuidePresentation } from "./homeowner-guide";
import type {
  HomeownerGuideDocumentData,
  HomeownerGuideLocation,
  HomeownerPaintRecord,
} from "./types";

export type RoomNavigationNode = {
  location: HomeownerGuideLocation;
  /** The usable parent link. Invalid and cyclic links are intentionally broken for display. */
  parentId: string | null;
  children: RoomNavigationNode[];
  rootId: string;
  hasUnresolvedHierarchy: boolean;
  exactRecords: HomeownerPaintRecord[];
  aggregateRecords: HomeownerPaintRecord[];
};

function compareLocations(a: HomeownerGuideLocation, b: HomeownerGuideLocation) {
  return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

/**
 * Build a safe display forest from the authorized DTO. Paint rows on a node are
 * exact junction matches. Descendant rows are exposed separately for clearly
 * labeled aggregate counts only; they are never implicitly assigned to rooms.
 */
export function buildRoomNavigation(data: HomeownerGuideDocumentData) {
  const locations = [...data.locations].sort(compareLocations);
  const locationById = new Map<string, HomeownerGuideLocation>();
  for (const location of locations) {
    if (!locationById.has(location.id)) locationById.set(location.id, location);
  }

  const cyclicIds = new Set<string>();
  for (const start of locations) {
    const path: string[] = [];
    const seenAt = new Map<string, number>();
    let currentId: string | null = start.id;
    while (currentId && locationById.has(currentId)) {
      const priorIndex = seenAt.get(currentId);
      if (priorIndex !== undefined) {
        for (const cyclicId of path.slice(priorIndex)) cyclicIds.add(cyclicId);
        break;
      }
      seenAt.set(currentId, path.length);
      path.push(currentId);
      const nextParentId: string | null = locationById.get(currentId)?.parent_id ?? null;
      if (!nextParentId || !locationById.has(nextParentId)) break;
      currentId = nextParentId;
    }
  }

  const recordModel = buildHomeownerGuidePresentation(data);
  const orderedRecords = [...recordModel.primaryRecords, ...recordModel.exceptionRecords, ...recordModel.additionalRecords];
  const recordIdsByLocation = new Map<string, Set<string>>();
  for (const assignment of data.assignments) {
    if (!locationById.has(assignment.location_id) || !orderedRecords.some(record => record.id === assignment.paint_record_id)) continue;
    const ids = recordIdsByLocation.get(assignment.location_id) ?? new Set<string>();
    ids.add(assignment.paint_record_id);
    recordIdsByLocation.set(assignment.location_id, ids);
  }

  const nodes = new Map<string, RoomNavigationNode>();
  for (const location of locationById.values()) {
    const cycleMember = cyclicIds.has(location.id);
    const parentExists = location.parent_id !== null && locationById.has(location.parent_id);
    const parentId = !cycleMember && parentExists ? location.parent_id : null;
    const exactIds = recordIdsByLocation.get(location.id) ?? new Set<string>();
    nodes.set(location.id, {
      location,
      parentId,
      children: [],
      rootId: location.id,
      hasUnresolvedHierarchy: cycleMember || (location.parent_id !== null && !parentExists),
      exactRecords: orderedRecords.filter(record => exactIds.has(record.id)),
      aggregateRecords: [],
    });
  }

  for (const node of nodes.values()) {
    if (node.parentId) nodes.get(node.parentId)?.children.push(node);
  }
  for (const node of nodes.values()) node.children.sort((a, b) => compareLocations(a.location, b.location));

  function setRoot(node: RoomNavigationNode, rootId: string, visited: Set<string>) {
    if (visited.has(node.location.id)) return;
    visited.add(node.location.id);
    node.rootId = rootId;
    for (const child of node.children) setRoot(child, rootId, visited);
  }
  const roots = [...nodes.values()].filter(node => node.parentId === null).sort((a, b) => compareLocations(a.location, b.location));
  const assignedRoots = new Set<string>();
  for (const root of roots) setRoot(root, root.location.id, assignedRoots);
  // Defensive fallback for malformed duplicate or unexpected graph state.
  for (const node of nodes.values()) {
    if (!assignedRoots.has(node.location.id)) {
      node.parentId = null;
      node.hasUnresolvedHierarchy = true;
      node.rootId = node.location.id;
      roots.push(node);
      setRoot(node, node.location.id, assignedRoots);
    }
  }

  function collectRecordIds(node: RoomNavigationNode, seen: Set<string>, result: Set<string>) {
    if (seen.has(node.location.id)) return;
    seen.add(node.location.id);
    for (const record of node.exactRecords) result.add(record.id);
    for (const child of node.children) collectRecordIds(child, seen, result);
  }
  for (const node of nodes.values()) {
    const ids = new Set<string>();
    collectRecordIds(node, new Set(), ids);
    node.aggregateRecords = orderedRecords.filter(record => ids.has(record.id));
  }

  return {
    roots,
    locations: [...nodes.values()],
    nodeFor: (id: string) => nodes.get(id) ?? null,
  };
}
