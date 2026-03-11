export const metadata = {
  title: "Privacy Policy | Swish",
};

export default function PrivacyPolicy() {
  return (
    <article className="w-full max-w-[640px] px-6 py-10 text-[#121212] text-sm leading-relaxed space-y-6 self-start">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-[#121212]/50">Last updated: March 11, 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. Introduction</h2>
        <p>
          Swish (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the Swish application
          and website at swish.cash. This Privacy Policy explains how we collect, use, and
          protect your information when you use our service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. Information We Collect</h2>
        <p>We collect the following information:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Wallet addresses</strong> &mdash; Solana wallet public keys used to send
            and receive payments.
          </li>
          <li>
            <strong>X (Twitter) profile information</strong> &mdash; username and public profile
            data when you sign in via X, provided through Privy authentication.
          </li>
          <li>
            <strong>Transaction data</strong> &mdash; amounts, timestamps, and transaction
            status for payment requests, sends, and claims.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. How We Use Your Information</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To facilitate private USDC payments on Solana.</li>
          <li>To associate X handles with wallet addresses for social payments.</li>
          <li>To display your transaction history and payment requests.</li>
          <li>To generate and manage claimable payment links.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. Privacy by Design</h2>
        <p>
          Swish uses privacy-preserving technology to route payments without exposing sender
          or receiver wallet addresses on-chain. Your wallet address is not revealed to
          payment recipients.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. Third-Party Services</h2>
        <p>We use the following third-party services:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Privy</strong> &mdash; authentication and embedded wallet management.
          </li>
          <li>
            <strong>Supabase</strong> &mdash; database for user and transaction records.
          </li>
          <li>
            <strong>Solana blockchain</strong> &mdash; on-chain transaction processing.
          </li>
        </ul>
        <p>
          These services have their own privacy policies. We recommend reviewing them
          independently.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">6. Data Retention</h2>
        <p>
          We retain your data for as long as your account is active or as needed to provide
          services. On-chain transaction data is permanent and cannot be deleted.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">7. Security</h2>
        <p>
          We implement reasonable security measures to protect your information. Private keys
          for embedded wallets are managed by Privy and are never stored on our servers.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">8. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be reflected by
          updating the date at the top of this page.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">9. Contact</h2>
        <p>
          For questions about this Privacy Policy, reach out to us on X
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
