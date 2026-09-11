import indexHTML from './index.html';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(indexHTML, {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
          'cache-control': 'public, max-age=0, must-revalidate'
        }
      });
    }

    // /dl/* → stream from R2 bucket (faster than pub-*.r2.dev from China).
    // Range is forwarded so downloads can resume / use parallel chunks.
    if (url.pathname.startsWith('/dl/')) {
      const key = 'latest/' + url.pathname.slice(4);
      const filename = url.pathname.split('/').pop();
      const contentType = filename.endsWith('.dmg')
        ? 'application/x-apple-diskimage'
        : filename.endsWith('.exe')
          ? 'application/vnd.microsoft.portable-executable'
          : 'application/zip';

      // head() carries the full size; object.size is unreliable once ranged.
      const meta = await env.R2.head(key);
      if (!meta) {
        return new Response('Not found', { status: 404 });
      }

      const headers = new Headers({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes',
        'ETag': meta.httpEtag,
      });

      if (request.headers.get('if-none-match') === meta.httpEtag) {
        return new Response(null, { status: 304, headers });
      }

      if (request.method === 'HEAD') {
        headers.set('Content-Length', String(meta.size));
        return new Response(null, { status: 200, headers });
      }

      const object = await env.R2.get(key, { range: request.headers });
      if (!object) {
        return new Response('Not found', { status: 404 });
      }

      // R2 fills `range` whenever Headers are passed, so a range covering the
      // whole object is answered as a plain 200 (RFC 9110 §14.2).
      const offset = object.range?.offset ?? 0;
      const length = object.range?.length ?? meta.size;
      if (offset > 0 || length < meta.size) {
        headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${meta.size}`);
        headers.set('Content-Length', String(length));
        return new Response(object.body, { status: 206, headers });
      }

      headers.set('Content-Length', String(meta.size));
      return new Response(object.body, { status: 200, headers });
    }

    // Block internal directories from static asset serving
    if (url.pathname.startsWith('/.git') || url.pathname.startsWith('/.wrangler')) {
      return new Response('Not found', { status: 404 });
    }

    // Serve other files from static assets
    return env.ASSETS.fetch(request);
  }
};
