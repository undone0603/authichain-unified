import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/claimpilot/supabase';
import { deadlineState } from '@/lib/claimpilot/engine';

export async function GET(){
  const supabase=getSupabaseAdmin();
  if(!supabase) return NextResponse.json({ok:true,mode:'demo',openMatches:17,noProof:9,ready:6,urgent:3,deadlines:[]});
  const [settlements,claims,deadlines]=await Promise.all([
    supabase.from('claimpilot_settlements').select('*').eq('status','open').order('claim_deadline',{ascending:true}),
    supabase.from('claimpilot_claims').select('*').in('status',['candidate','ready','review','submitted','processing']),
    supabase.from('claimpilot_deadlines').select('*').is('completed_at',null).order('due_at',{ascending:true}),
  ]);
  const error=settlements.error??claims.error??deadlines.error;
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  return NextResponse.json({ok:true,settlements:settlements.data??[],claims:claims.data??[],deadlines:(deadlines.data??[]).map(d=>({...d,state:deadlineState(d.due_at)}))});
}
