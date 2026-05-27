import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const day = Number(searchParams.get('day'));

  if (!year || !month || !day) {
    return NextResponse.json({ error: 'Missing year/month/day' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('daily_reviews')
    .select('completed, good_things, problems, mood, reflections, tomorrow_todo, mood_score, energy, updated_at')
    .eq('year', year)
    .eq('month', month)
    .eq('day', day)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    return NextResponse.json({
      completed: '', goodThings: '', problems: '', mood: '',
      reflections: '', tomorrowTodo: '', moodScore: 3, energy: 3, updatedAt: '',
    });
  }

  return NextResponse.json({
    completed: data.completed || '',
    goodThings: data.good_things || '',
    problems: data.problems || '',
    mood: data.mood || '',
    reflections: data.reflections || '',
    tomorrowTodo: data.tomorrow_todo || '',
    moodScore: data.mood_score ?? 3,
    energy: data.energy ?? 3,
    updatedAt: data.updated_at || '',
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { year, month, day, completed, goodThings, problems, mood, reflections, tomorrowTodo, moodScore, energy } = body as {
    year: number; month: number; day: number;
    completed?: string; goodThings?: string; problems?: string;
    mood?: string; reflections?: string; tomorrowTodo?: string;
    moodScore?: number; energy?: number;
  };

  if (!year || !month || !day) {
    return NextResponse.json({ error: 'Missing year/month/day' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const row = {
    year, month, day,
    completed: completed || '',
    good_things: goodThings || '',
    problems: problems || '',
    mood: mood || '',
    reflections: reflections || '',
    tomorrow_todo: tomorrowTodo || '',
    mood_score: moodScore ?? 3,
    energy: energy ?? 3,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from('daily_reviews')
    .upsert(row, { onConflict: 'year,month,day' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const day = Number(searchParams.get('day'));

  if (!year || !month || !day) {
    return NextResponse.json({ error: 'Missing year/month/day' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const { error } = await client
    .from('daily_reviews')
    .delete()
    .eq('year', year)
    .eq('month', month)
    .eq('day', day);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
