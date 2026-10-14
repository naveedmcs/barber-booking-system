/**
 * Dev Server Redirect Middleware
 * Intercepts legacy /book, /book.html, and /booking.html requests and redirects
 * with HTTP 302 to canonical /booking/ (preserving all query parameters).
 */

module.exports = function(req, res, next) {
  const host = (req.headers && req.headers.host) || "localhost:3000";
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;

  if (
    pathname === "/book" ||
    pathname === "/book/" ||
    pathname === "/book.html" ||
    pathname === "/booking.html"
  ) {
    const targetUrl = "/booking/" + parsedUrl.search + parsedUrl.hash;
    res.writeHead(302, {
      Location: targetUrl,
      "Content-Type": "text/plain"
    });
    return res.end(`Redirecting to canonical booking route: ${targetUrl}`);
  }

  next();
};
