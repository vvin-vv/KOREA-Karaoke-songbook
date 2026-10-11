// Vercel Serverless Function: same-origin relay so mobile Safari is not blocked by CORS.
const ENDPOINT = 'https://api.manana.kr/v2/karaoke/search.json';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error:'GET만 지원합니다.'});
  const brand = String(req.query.brand || 'tj');
  const mode = String(req.query.mode || 'title');
  const keyword = String(req.query.keyword || '').trim().slice(0, 100);
  const page = Math.min(100, Math.max(1, Number.parseInt(req.query.page || '1',10) || 1));
  if (!['tj','kumyoung'].includes(brand) || !['title','singer','no'].includes(mode) || !keyword) {
    return res.status(400).json({error:'검색 조건이 올바르지 않습니다.'});
  }
  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set('brand', brand);
    url.searchParams.set(mode, keyword);
    url.searchParams.set('limit', '20');
    url.searchParams.set('page', String(page));
    const upstream = await fetch(url, { signal: AbortSignal.timeout(12000), headers: {accept:'application/json'} });
    if (!upstream.ok) throw new Error('외부 검색 서비스 응답 오류 '+upstream.status);
    const json = await upstream.json();
    if (!json || !Array.isArray(json.data)) throw new Error('예상하지 못한 검색 응답');
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({data:json.data,total:json.total || null,page});
  } catch (e) {
    return res.status(502).json({error:'외부 검색 서비스를 연결할 수 없습니다. 공식 검색을 이용해 주세요.'});
  }
}
