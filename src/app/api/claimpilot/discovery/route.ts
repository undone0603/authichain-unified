import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/claimpilot/supabase';

const SOURCES=[
 {name:'Consumer Action',kind:'directory',url:'https://www.consumer-action.org/lawsuits/'},
 {name:'FTC Refund Programs',kind:'government',url:'https://www.ftc.gov/enforcement/recent-ftc-cases-resulting-refunds'}
];

export async function GET(){const supabase=getSupabaseAdmin(); if(!supabase)return NextResponse.json({ok:true,mode:'demo',sources:SOURCES}); const {data,error}=await supabase.from('claimpilot_sources').select('*').order('name'); if(error)return NextResponse.json({ok:false,error:error.message},{status:500}); return NextResponse.json({ok:true,sources:data});}
export async function POST(){const supabase=getSupabaseAdmin(); if(!supabase)return NextResponse.json({ok:false,error:'Supabase is not configured'},{status:503}); const {data,error}=await supabase.from('claimpilot_sources').upsert(SOURCES,{onConflict:'url'}).select(); if(error)return NextResponse.json({ok:false,error:error.message},{status:500}); return NextResponse.json({ok:true,sources:data});}
