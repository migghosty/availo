import Image from "next/image";
import { Section } from "@/components/Section";
import { getBusinessAddress, getBusinessName } from "@/lib/settingsData";
import { GALLERY } from "@/lib/gallery";

/**
 * The page a first-time client reads before deciding to book.
 *
 * Everything else in the public flow answers *what* and *when*; this answers
 * *who* and *where*. Note the address was previously invisible until after a
 * booking was confirmed — a client had to commit before finding out where they
 * were going.
 *
 * The bio is a constant below rather than an admin-editable field: it changes
 * about never, and a Settings column plus a form field plus validation is a lot
 * of machinery for a string edited once a year.
 */

export const dynamic = "force-dynamic";

/**
 * TODO: replace with the real bio. Blank lines start a new paragraph —
 * `whitespace-pre-line` preserves them, so no markup is needed.
 */
const BIO = `I've been cutting hair for over ten years, and I still think a good cut is mostly listening. Tell me what you want, and if I think something else would suit you better, I'll say so before I pick up the clippers — not after.

Fades, tapers, scissor work, beard shaping. Walk-ins are welcome when I have a gap, but booking ahead is the only way to be sure of a time.`;

export default async function AboutPage() {
  const [businessName, address] = await Promise.all([
    getBusinessName(),
    getBusinessAddress(),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
        About {businessName}
      </h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
        Who&apos;s cutting your hair, and where to find them.
      </p>

      <Section title="A little about me">
        <p className="whitespace-pre-line">{BIO}</p>
      </Section>

      {/* Omitted entirely when unset — a heading over a blank space reads as a
          bug, and `address` is empty until the admin fills it in at
          /admin/settings. */}
      {address ? (
        <Section title="Where to find us">
          <p className="whitespace-pre-line">{address}</p>
          <p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline"
            >
              Get directions
            </a>
          </p>
        </Section>
      ) : null}

      {/* Same rule as the address: no photos means no section, not an empty
          grid. See lib/gallery.ts for how to add them. */}
      {GALLERY.length > 0 ? (
        <Section title="Recent work">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {GALLERY.map((photo) => (
              <div
                key={photo.src}
                className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-slate-800"
              >
                {/* `fill` + a square wrapper means photos of any dimensions drop
                    in without being measured first. `sizes` matters here: two
                    columns on a phone, three from `sm:` up — without it Next
                    would ship a full-width image for every tile. */}
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
