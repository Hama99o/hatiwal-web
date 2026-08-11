import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { installIntlNumberLocaleAlias } from "./intl-locale-alias";

// Server half of the digit fix: `ps` must reach `Intl` as `fa-AF`, exactly like
// `src/lib/format.ts` does, or the numbers next-intl formats inside messages
// depend on which ICU the runtime happens to ship. Module scope so it is in place
// before the first message is formatted; the browser half lives in
// `src/components/providers.tsx`. See `./intl-locale-alias.ts`.
installIntlNumberLocaleAlias();

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
