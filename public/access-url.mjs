export function publicAccessUrl(value) {
  const url=new URL(value);
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||host==='localhost'||host.endsWith('.localhost')||host==='[::1]'||/^127\./.test(host))return null;
  // Share only the login entry point, never a query string, fragment or credentials.
  return url.origin+'/';
}
