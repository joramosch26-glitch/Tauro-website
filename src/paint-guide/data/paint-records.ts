import { supabase } from "../lib/supabase";
import type { PaintRecord, PaintRecordSection } from "./types";
const COLUMNS="id, guide_id, section, surface, brand, product, color_name, color_code, sheen, notes, sort_order, created_at, updated_at";
const optional=(value:string)=>value.trim()||null;
function client(){if(!supabase)throw new Error("Paint Guide is not configured.");return supabase;}
export type PaintRecordInput={section:PaintRecordSection;surface:string;colorName:string;brand:string;product:string;colorCode:string;sheen:string;notes:string;sortOrder:number;};
export async function listPaintRecords(guideId:string):Promise<PaintRecord[]>{const{data,error}=await client().from("paint_records").select(COLUMNS).eq("guide_id",guideId).order("sort_order",{ascending:true}).order("created_at",{ascending:true});if(error)throw error;return(data??[])as PaintRecord[];}
const values=(input:PaintRecordInput)=>({section:input.section,surface:input.surface.trim(),color_name:input.colorName.trim(),brand:optional(input.brand),product:optional(input.product),color_code:optional(input.colorCode),sheen:optional(input.sheen),notes:optional(input.notes),sort_order:input.sortOrder});
export async function createPaintRecord(guideId:string,input:PaintRecordInput):Promise<PaintRecord>{const{data,error}=await client().from("paint_records").insert({guide_id:guideId,...values(input)}).select(COLUMNS).single();if(error||!data)throw error??new Error("Could not add paint record.");return data as PaintRecord;}
export async function updatePaintRecord(guideId:string,id:string,input:PaintRecordInput):Promise<PaintRecord>{const{data,error}=await client().from("paint_records").update(values(input)).eq("id",id).eq("guide_id",guideId).select(COLUMNS).maybeSingle();if(error||!data)throw error??new Error("Could not save paint record.");return data as PaintRecord;}
export async function deletePaintRecord(guideId:string,id:string):Promise<void>{const{data,error}=await client().from("paint_records").delete().eq("id",id).eq("guide_id",guideId).select("id");if(error||!data?.length)throw error??new Error("Could not delete paint record.");}
