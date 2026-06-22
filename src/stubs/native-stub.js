// Web stub — native SDK not available on web
module.exports = new Proxy({}, {
  get: () => () => ({ error: { code: 'NotAvailable', message: 'Native SDK not available on web' } }),
});
