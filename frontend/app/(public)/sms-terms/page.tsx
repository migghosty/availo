import { getAdminPhone, getBusinessAddress, getBusinessName } from "@/lib/settingsData";
import { formatPhone } from "@/lib/phone";

/**
 * The messaging policy carriers ask for.
 *
 * The A2P 10DLC campaign registration has a field for a public URL showing how
 * consent is collected and what recipients are agreeing to, and reviewers open
 * it. The headings below map onto what they look for: what is sent, how often,
 * that rates may apply, how to stop, how to get help, and who to contact.
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

export default async function SmsTermsPage() {
  const [businessName, address, adminPhone] = await Promise.all([
    getBusinessName(),
    getBusinessAddress(),
    getAdminPhone(),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
        SMS Terms
      </h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
        How {businessName} uses text messages.
      </p>

      <Section title="What you'll receive">
        <p>
          When you book an appointment with {businessName} and tick the box
          agreeing to be texted, we send you a confirmation with the date, time
          and service. If your appointment is cancelled, we send you a message
          telling you so.
        </p>
        <p>
          These are transactional messages about an appointment you booked. We do
          not send marketing or promotional texts, and we do not text you unless
          you have booked.
        </p>
      </Section>

      <Section title="How often">
        <p>
          Message frequency depends on how often you book. In practice this is
          one message per booking, plus one more if that booking is cancelled.
        </p>
      </Section>

      <Section title="Cost">
        <p>
          Message and data rates may apply. {businessName} does not charge you
          for these messages; your mobile carrier may, according to your plan.
        </p>
      </Section>

      <Section title="Stopping messages">
        <p>
          Reply <strong>STOP</strong> to any message to stop receiving texts. You
          will get one confirmation that you have been unsubscribed, and nothing
          after that. You can still book appointments — you simply won&apos;t get
          text confirmations, so keep the confirmation page or your cancellation
          link.
        </p>
        <p>
          Reply <strong>START</strong> at any time to begin receiving messages
          again.
        </p>
      </Section>

      <Section title="Getting help">
        <p>
          Reply <strong>HELP</strong> to any message for help
          {adminPhone ? <>, or call us on {formatPhone(adminPhone)}</> : null}.
        </p>
      </Section>

      <Section title="Carriers">
        <p>
          Carriers are not liable for delayed or undelivered messages. Delivery
          is not guaranteed, which is why your appointment is also confirmed on
          screen when you book.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          {businessName}
          {adminPhone ? <> &middot; {formatPhone(adminPhone)}</> : null}
        </p>
        {address ? (
          <p className="whitespace-pre-line">{address}</p>
        ) : null}
      </Section>
    </div>
  );
}
