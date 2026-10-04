import { IOS_BUNDLE_ID, APPLE_TEAM_ID } from "@/lib/app-links";

// iOS Universal Links: tells iPhones that hatiwal.com listing and seller links
// belong to the Hatiwal app (1.1.5+, associatedDomains applinks:hatiwal.com),
// so a tapped share link opens the app instead of Safari. Must be JSON at this
// exact path with no redirect; the locale middleware skips dotted paths.
export const dynamic = "force-static";

export function GET() {
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [`${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`],
          components: [
            { "/": "/l/*" },
            { "/": "/u/*" },
            { "/": "/listings/*" },
            { "/": "/sellers/*" },
            { "/": "/*/listings/*" },
            { "/": "/*/sellers/*" },
          ],
        },
      ],
    },
  });
}
