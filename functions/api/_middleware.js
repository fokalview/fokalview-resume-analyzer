// Browser mutations of private candidate data must originate from this site.
// CORS alone does not prevent a request from changing server state.
export async function onRequest({request, next}) {
  const url = new URL(request.url);
  const protectedPath = /^\/api\/(applications|resume-records|analyze)\/?$/.test(url.pathname);
  if (protectedPath && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    const site = request.headers.get('Sec-Fetch-Site');
    if ((origin !== null && origin !== url.origin) || site === 'cross-site' || site === 'same-site') {
      return Response.json({error: 'This action must be submitted from SagittaIQ.'}, {status: 403});
    }
  }
  return next();
}
