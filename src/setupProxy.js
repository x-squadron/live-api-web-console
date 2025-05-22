const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy backend.composio.dev requests
  app.use(
    ['/v1', '/integrations', '/actions'],
    createProxyMiddleware({
      target: 'https://backend.composio.dev',
      changeOrigin: true,
      secure: false,
      ws: true,
      onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      },
    })
  );

  // Proxy app.composio.dev requests
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://app.composio.dev',
      changeOrigin: true,
      secure: false,
      onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      },
    })
  );
}; 