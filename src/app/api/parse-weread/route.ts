import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/parse-weread — 解析微信读书链接，提取书名、作者、封面
 * Body: { url: "https://weread.qq.com/web/reader/xxx" }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: '请提供微信读书链接' }, { status: 400 });
  }

  // 校验是否为微信读书链接
  if (!url.includes('weread.qq.com')) {
    return NextResponse.json({ error: '仅支持微信读书链接' }, { status: 400 });
  }

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `微信读书页面请求失败 (${resp.status})` },
        { status: 502 }
      );
    }

    const html = await resp.text();

    // 提取 OG meta 标签
    const ogTitle = extractMeta(html, 'og:title') || extractMeta(html, 'title');
    const ogImage = extractMeta(html, 'og:image');
    const ogDescription = extractMeta(html, 'og:description') || extractMeta(html, 'description');

    // 从 title 或 description 中尝试提取作者
    let author = '';
    let title = ogTitle || '';

    // 微信读书页面 title 格式通常是 "书名 - 微信读书"
    if (title.includes(' - ')) {
      title = title.split(' - ')[0].trim();
    }

    // 尝试从页面中提取作者（常见模式：作者：xxx 或 作者:xxx）
    const authorMatch =
      html.match(/作者[：:]\s*([^<\n,，]{1,30}?)(?:[<\n,，]|$)/) ||
      html.match(/"author"\s*:\s*"([^"]+)"/);
    if (authorMatch) {
      author = authorMatch[1].trim();
    }

    // 从 description 中提取作者（格式通常是 "作者：xxx 简介：..."）
    if (!author && ogDescription) {
      const descAuthor = ogDescription.match(/作者[：:]\s*([^\s,，.。]{1,30})/);
      if (descAuthor) {
        author = descAuthor[1].trim();
      }
    }

    // 如果封面图是相对路径，补全
    let coverUrl = ogImage || '';
    if (coverUrl && coverUrl.startsWith('//')) {
      coverUrl = 'https:' + coverUrl;
    }

    if (!title) {
      return NextResponse.json(
        { error: '无法解析书名，请手动填写' },
        { status: 422 }
      );
    }

    return NextResponse.json({ title, author, coverUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[parse-weread]', msg);
    return NextResponse.json(
      { error: `解析失败: ${msg}` },
      { status: 500 }
    );
  }
}

/** 从 HTML 中提取 meta 标签内容 */
function extractMeta(html: string, property: string): string {
  // 尝试 property="og:xxx" 和 name="xxx" 两种格式
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  // 最后尝试 <title> 标签
  if (property === 'title') {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) return titleMatch[1].trim();
  }

  return '';
}
