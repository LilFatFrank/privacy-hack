export const metadata = {
  title: "Terms of Service | Swish",
};

export default function TermsOfService() {
  return (
    <article className="w-full max-w-[640px] px-6 py-10 text-[#121212] text-sm leading-relaxed space-y-6 self-start">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="text-[#121212]/50">Last updated: March 11, 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. Acceptance of Terms</h2>
        <p>
          By accessing or using Swish (&quot;the Service&quot;), you agree to be bound by these
          Terms of Service. If you do not agree, do not use the Service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. Description of Service</h2>
        <p>
          Swish is a privacy-focused payment application that enables users to send and receive
          USDC on the Solana blockchain without exposing wallet addresses. The Service includes
          direct sends, payment requests, and claimable payment links.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. Eligibility</h2>
        <p>
          You must be at least 18 years old and capable of entering into a binding agreement
          to use the Service. By using Swish, you represent that you meet these requirements.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. User Responsibilities</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are responsible for safeguarding your wallet and authentication credentials.</li>
          <li>You are responsible for all transactions made through your account.</li>
          <li>You agree not to use the Service for any unlawful purpose.</li>
          <li>
            You understand that blockchain transactions are irreversible once confirmed
            on-chain.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. Fees</h2>
        <p>
          Swish charges a service fee on transactions, consisting of a base network fee and
          a percentage-based privacy routing fee. Fees are displayed before you confirm any
          transaction.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">6. No Warranty</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind, whether express or implied. Swish does not guarantee
          uninterrupted or error-free operation.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">7. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Swish shall not be liable for any indirect,
          incidental, special, or consequential damages arising from your use of the Service,
          including but not limited to loss of funds, data, or profits.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">8. Third-Party Services</h2>
        <p>
          The Service relies on third-party providers including Privy, Supabase, and the
          Solana blockchain. Swish is not responsible for the availability or conduct of
          these services.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">9. Modifications</h2>
        <p>
          We reserve the right to modify or discontinue the Service at any time. We may also
          update these Terms, with changes taking effect upon posting.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">10. Contact</h2>
        <p>
          For questions about these Terms, reach out to us on X
          at{" "}
          <a
            href="https://x.com/LilFatFrank"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            @LilFatFrank
          </a>
          .
        </p>
      </section>
    </article>
  );
}
