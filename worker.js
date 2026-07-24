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

    // /dl/* → stream from R2 bucket (faster than pub-*.r2.dev from China)
    if (url.pathname.startsWith('/dl/')) {
      const key = 'latest/' + url.pathname.slice(4);
      const object = await env.R2.get(key);
      if (!object) {
        return new Response('Not found', { status: 404 });
      }
      const filename = url.pathname.split('/').pop();
      const contentType = filename.endsWith('.dmg')
        ? 'application/x-apple-diskimage'
        : filename.endsWith('.exe')
          ? 'application/vnd.microsoft.portable-executable'
          : 'application/zip';
      return new Response(object.body, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(object.size),
          'Cache-Control': 'public, max-age=86400',
          'ETag': object.etag,
        },
      });
    }

    // Block internal directories from static asset serving
    if (url.pathname.startsWith('/.git') || url.pathname.startsWith('/.wrangler')) {
      return new Response('Not found', { status: 404 });
    }

    // Serve other files from static assets
    return env.ASSETS.fetch(request);
  }
};
