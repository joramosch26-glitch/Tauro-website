/** C2-only in-memory mock. It has no HTTP, Supabase, browser storage, or persistence. */
export type PrototypePhotoPlacement = {
  id: string;
  group: "Residence" | "Main Floor";
  title: string;
  context: string;
  src: string | null;
  fileName: string | null;
  mimeType: string | null;
  byteSize: number | null;
};

export type PrototypePhotoAdapter = {
  list(): Promise<PrototypePhotoPlacement[]>;
  replace(id: string, photo: Pick<PrototypePhotoPlacement, "src" | "fileName" | "mimeType" | "byteSize">): Promise<PrototypePhotoPlacement>;
  remove(id: string): Promise<void>;
  /** Test-only fault switches; never wired to a production route. */
  failNextList?: boolean;
  failNextWrite?: boolean;
  calls?: string[];
};

export function createPrototypePhotoAdapter(options: { failFirstList?: boolean; failFirstPreview?: boolean } = {}): PrototypePhotoAdapter {
  let rows: PrototypePhotoPlacement[] = [
    { id: "residence-cover", group: "Residence", title: "Residence cover", context: "Guide home · cover image", src: null, fileName: null, mimeType: null, byteSize: null },
    { id: "main-floor", group: "Main Floor", title: "Main Floor", context: "Floor overview · optional context", src: null, fileName: null, mimeType: null, byteSize: null },
    { id: "kitchen-room", group: "Main Floor", title: "Kitchen", context: "Room photograph · Main Floor", src: "/tests/fixtures/milestone-b-synthetic-kitchen.jpg", fileName: "synthetic-kitchen-sample.jpg", mimeType: "image/jpeg", byteSize: 214142 },
    { id: "kitchen-walls", group: "Main Floor", title: "Kitchen walls", context: "Paint context · QA Ivory Sample · Walls", src: null, fileName: null, mimeType: null, byteSize: null },
    { id: "dining-room", group: "Main Floor", title: "Dining Room", context: "Room photograph · Main Floor", src: null, fileName: null, mimeType: null, byteSize: null },
  ];
  if (options.failFirstPreview) {
    rows = rows.map(row => row.id === "kitchen-room" ? { ...row, src: "/tests/fixtures/missing-synthetic-photo.jpg" } : row);
  }
  const adapter: PrototypePhotoAdapter = {
    calls: [],
    failNextList: options.failFirstList ?? false,
    async list() {
      adapter.calls?.push("list");
      await new Promise(resolve => setTimeout(resolve, 300));
      if (adapter.failNextList) {
        adapter.failNextList = false;
        throw new Error("Synthetic list failure");
      }
      return rows.map(row => ({ ...row }));
    },
    async replace(id, photo) {
      adapter.calls?.push("replace");
      await new Promise(resolve => setTimeout(resolve, 90));
      if (adapter.failNextWrite) {
        adapter.failNextWrite = false;
        throw new Error("Synthetic write failure");
      }
      const index = rows.findIndex(row => row.id === id);
      if (index < 0) throw new Error("Synthetic placement not found");
      rows[index] = { ...rows[index], ...photo };
      return { ...rows[index] };
    },
    async remove(id) {
      adapter.calls?.push("remove");
      await new Promise(resolve => setTimeout(resolve, 70));
      if (adapter.failNextWrite) {
        adapter.failNextWrite = false;
        throw new Error("Synthetic delete failure");
      }
      const index = rows.findIndex(row => row.id === id);
      if (index < 0) throw new Error("Synthetic placement not found");
      rows[index] = { ...rows[index], src: null, fileName: null, mimeType: null, byteSize: null };
    },
  };
  return adapter;
}
