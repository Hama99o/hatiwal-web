/* eslint-disable @next/next/no-html-link-for-pages */
// Global fallback for paths outside any locale (root /404). Renders its own
// standalone <html>/<body> because the root layout is a pass-through.
//
// Deliberately uses a plain <a> and imports NOTHING: importing next/link or
// next/error here pulls pages-router internals into the /404 chunk and breaks
// its static export ("<Html> should not be imported outside pages/_document").
// Hence the eslint-disable for no-html-link-for-pages above.
export default function NotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#fafafa",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 40, margin: 0 }}>404</h1>
          <p style={{ color: "#64748b" }}>Page not found</p>
          <a href="/en" style={{ color: "#2563eb", fontWeight: 600 }}>
            Hatiwal
          </a>
        </div>
      </body>
    </html>
  );
}
