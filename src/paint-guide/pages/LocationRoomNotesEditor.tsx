import { type FormEvent, useEffect, useState } from "react";
import { updateGuideLocation } from "../data/locations";
import type { GuideLocation } from "../data/types";
import { homeownerDesignErrorMessage } from "../data/homeowner-design-schema";

export function LocationRoomNotesEditor({ guideId, location, onSaved }: { guideId: string; location: GuideLocation; onSaved: (location: GuideLocation) => void }) {
  const designFieldsUnavailable = location.homeowner_design_fields_available === false;
  const [notes, setNotes] = useState(location.room_notes ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setNotes(location.room_notes ?? ""), [location.id, location.room_notes]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      const saved = await updateGuideLocation(guideId, location.id, { name: location.name, locationType: location.location_type, roomNotes: notes });
      onSaved(saved); setMessage("Room notes saved.");
    } catch (error) { setMessage(homeownerDesignErrorMessage(error, "Could not save room notes. Please try again.")); }
    finally { setPending(false); }
  }
  return <form className="mt-4 border-t border-[#20211f]/10 pt-4" onSubmit={event => void submit(event)}>
    <label className="block text-sm font-semibold" htmlFor={`room-notes-${location.id}`}>Room Notes <span className="font-normal text-[#20211f]/55">(shown only for this location)</span></label>
    {designFieldsUnavailable ? <p className="mt-2 text-xs text-[#792c25]" role="status">Room Notes are unavailable until the reviewed database migration is applied.</p> : null}
    <textarea id={`room-notes-${location.id}`} className="mt-2 min-h-20 w-full border border-[#20211f]/20 bg-[#fffdf8] px-3 py-2 text-sm disabled:bg-[#20211f]/5" disabled={pending || designFieldsUnavailable} value={notes} onChange={event => setNotes(event.target.value)} />
    <div className="mt-2 flex items-center gap-4"><button className="text-xs font-semibold uppercase tracking-[0.12em] text-[#795b33] disabled:opacity-60" disabled={pending || designFieldsUnavailable} type="submit">{pending ? "Saving." : "Save Room Notes"}</button>{message ? <span role="status" className="text-xs text-[#40513c]">{message}</span> : null}</div>
  </form>;
}
