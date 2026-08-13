import Link from "next/link";
import { getAdminPhone, getBusinessAddress, getBusinessName } from "@/lib/settingsData";
import { formatPhone } from "@/lib/phone";

/**
 * Privacy policy.
 *
 * Deliberately short, because the app genuinely collects very little: a name, a
 * phone number, and what you booked. Saying so plainly is more useful to a
 * client — and more credible to a carrier reviewing an A2P 10DLC registration —
 * than pages of boilerplate about data we don't hold.
 *
 * Boilerplate, not legal advice — read it before publishing.
 */

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
        {title}
      </h2>
      <div className="text-sm text-gray-600 dark:text-slate-300 space-y-3 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default async function PrivacyPage() {
  const [businessName, address, adminPhone] = await Promise.all([
    getBusinessName(),
    getBusinessAddress(),
    getAdminPhone(),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
        Privacy Policy
      </h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
        What {businessName} collects when you book, and why.
      </p>

      <Section title="What we collect">
        <p>
          Only what a booking needs: your <strong>name</strong>, your{" "}
          <strong>phone number</strong>, the service you chose, and the date and
          time. We also record <strong>when you agreed</strong> to receive text
          messages, because we are required to be able to show that.
        </p>
        <p>
          There are no accounts and no passwords for clients. We do not collect
          your email address, your payment details, or your location.
        </p>
      </Section>

      <Section title="Why we collect it">
        <p>
          Your name and the appointment details let us hold the right slot for
          the right person. Your phone number is how we confirm the booking, how
          we tell you if something changes, and how you look your booking up
          again if you lose the link.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>
          Nobody, other than the service that delivers our text messages on our
          behalf. We do not sell your information, and we do not share it for
          anyone&apos;s marketing — ours or a third party&apos;s.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Your booking is kept while it is upcoming and for a period afterwards
          as a record of business. Cancelling an appointment deletes it.
        </p>
      </Section>

      <Section title="Text messages">
        <p>
          Messaging is covered separately, including how to stop them — see our{" "}
          <Link
            href="/sms-terms"
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline"
          >
            SMS Terms
          </Link>
          .
        </p>
      </Section>

      <Section title="Contact">
        <p>
          To ask what we hold about you, or to have it deleted, contact{" "}
          {businessName}
          {adminPhone ? <> on {formatPhone(adminPhone)}</> : null}.
        </p>
        {address ? (
          <p className="whitespace-pre-line">{address}</p>
        ) : null}
      </Section>
    </div>
  );
}
