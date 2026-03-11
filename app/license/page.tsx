export const metadata = {
  title: "License | Swish",
};

export default function License() {
  return (
    <article className="w-full max-w-[640px] px-6 py-10 text-[#121212] text-sm leading-relaxed space-y-6 self-start">
      <h1 className="text-2xl font-semibold">License</h1>
      <p className="text-[#121212]/50">Last updated: March 11, 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Proprietary Software License</h2>
        <p>
          Copyright &copy; 2026 Swish. All rights reserved.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. Grant of Use</h2>
        <p>
          Swish grants you a limited, non-exclusive, non-transferable, revocable license to
          use the Swish application and website solely for personal, non-commercial use in
          accordance with these terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. Restrictions</h2>
        <p>You may not:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Copy, modify, distribute, or create derivative works of the software.</li>
          <li>Reverse engineer, decompile, or disassemble any part of the application.</li>
          <li>Use the software for any commercial purpose without written permission.</li>
          <li>Remove or alter any proprietary notices or labels.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. Ownership</h2>
        <p>
          All intellectual property rights in the Swish application, including its design,
          code, branding, and content, remain the exclusive property of Swish.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. Termination</h2>
        <p>
          This license is effective until terminated. It will terminate automatically if you
          fail to comply with any of its terms. Upon termination, you must cease all use of
          the software.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. Contact</h2>
        <p>
          For licensing inquiries, reach out to us on X
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
