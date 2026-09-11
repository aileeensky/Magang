import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api';

async function proxy(request: NextRequest, context: { params: { path: string[] } }) {
  const path = context.params.path.join('/');
  const target = `${BACKEND_API_URL.replace(/\/$/, '')}/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!['host', 'content-length', 'connection'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  let body: ArrayBuffer | undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend tidak dapat dihubungi';
    return NextResponse.json(
      { message: `Gagal menghubungi backend SIMONIK: ${message}` },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
