export type Diary = {
  date: string;            // YYYY-MM-DD
  text: string;
  weekday?: string;
  images?: string[];
  videos?: string[];
  audioUrl?: string;
}

export async function fetchDiaryByDate(date: string, signal?: AbortSignal): Promise<Diary> {
  // TODO: 換成你的後端實際路徑
  const res = await fetch(`/api/diaries/${date}`, { signal })
  if (!res.ok) throw new Error(`讀取失敗：${res.status}`)
  const data = await res.json()
  return data as Diary
}
