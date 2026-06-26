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
    
    // Serve other files from static assets
    return env.ASSETS.fetch(request);
  }
};
