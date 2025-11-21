import { Link } from "react-router";
import { NavBar } from "../components/NavBar";

export function meta() {
  return [
    { title: "Terms of Service • Webcomic Studio" },
    { name: "description", content: "Webcomic Studio Terms of Service (draft)." },
  ];
}
export default function TermsPage() {
  const lastUpdated = 'November 20th, 2025';
  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1>Webcomic Studio – Terms of Service (Draft)</h1>
        <p>Last Updated: {lastUpdated}</p>
        <p>Welcome to Webcomic Studio ("Webcomic Studio," "we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of the Webcomic Studio platform, website, and related services (collectively, the "Service"). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Service.</p>
        <h2>1. Eligibility</h2>
        <p>You must be at least 13 years old to use Webcomic Studio. By using the Service, you represent and warrant that you meet this requirement.</p>
        <h2>2. User Accounts</h2>
        <p>To use the Service, you must create an account. You agree to provide accurate and complete account information, keep your login credentials secure, and remain responsible for all activity under your account. Webcomic Studio is not liable for loss or damage arising from unauthorized account use.</p>
        <h2>3. Service Description</h2>
        <p>Webcomic Studio allows users to create and host webcomics, upload comic pages, publish content on a provided subdomain, and optionally point an external domain name they own to their comic. The Service is hosted on Fly.io and uses third-party services such as Clerk for authentication and Stripe for payment processing.</p>
        <h2>4. Free Tier and Subscription Plans</h2>
        <h3>4.1 Free Tier</h3>
        <p>Users may upload up to 100 pages for free.</p>
        <h3>4.2 Subscription</h3>
        <p>To upload additional pages beyond the free tier, users must subscribe to a paid plan billed at $3.99 USD per month.</p>
        <h3>4.3 Billing and Renewal</h3>
        <p>Subscriptions renew automatically each month. Users may cancel at any time via account settings. Cancellation retains access until the end of the already paid billing period, after which uploading new pages is disabled unless resubscribed. Payments are processed securely by Stripe and applicable taxes may apply.</p>
        <h2>5. User Content</h2>
        <h3>5.1 Ownership</h3>
        <p>You retain ownership of the content ("User Content") you upload. You grant Webcomic Studio a limited, worldwide, non-exclusive license to host, display, and distribute your comic pages solely to operate the Service.</p>
        <h3>5.2 Prohibited Content</h3>
        <p>You agree not to upload or distribute content that is illegal, infringes intellectual property rights, is pornographic or intended to be sexually explicit (graphic sexual acts intended for arousal), violates the rights or safety of others, or contains malware/harmful code.</p>
        <h3>5.3 Permitted Mature/Artistic Content</h3>
        <p>Artistic nudity, horror themes, and violence are permitted provided they do not involve unlawful or clearly harmful conduct (e.g., depiction or endorsement of sexual violence, or real-world violence with intent to harm).</p>
        <h3>5.4 Content Review and Enforcement</h3>
        <p>If content is reported and found to violate these Terms: one warning will be issued; a second violation may result in account ban and comic removal. We reserve the right to immediately remove content or suspend accounts for serious or clearly unlawful activity.</p>
        <h2>6. User Conduct</h2>
        <p>You agree not to use the Service for unlawful purposes, attempt to bypass technical or upload limits, interfere with Service operations, or access/modify other users’ content without permission.</p>
        <h2>7. Domain Usage</h2>
        <p>Users may connect a custom domain they own. You are solely responsible for ownership, DNS configuration, and compliance with domain registrars. Webcomic Studio is not liable for issues caused by domain configuration errors.</p>
        <h2>8. Termination</h2>
        <p>We may suspend or terminate accounts for Terms violations, malicious activity, or reasons necessary to protect the platform or its users. You may terminate by deleting your account through settings.</p>
        <h2>9. Third-Party Services</h2>
        <p>The Service integrates with Clerk (authentication), Stripe (billing/payments), and Fly.io (hosting). Your use of those services is subject to their terms and privacy policies. We are not responsible for their performance or security.</p>
        <h2>10. Disclaimer of Warranties</h2>
        <p>The Service is provided "as is" and "as available." We make no warranties regarding uninterrupted operation, data preservation, fitness for a particular purpose, accuracy, or reliability. Use at your own risk.</p>
        <h2>11. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, Webcomic Studio is not liable for loss of data, account suspension/termination, improper custom domain configuration, User Content removal, or indirect/incidental/consequential damages. Total liability is limited to the amount paid in the last 12 months.</p>
        <h2>12. Changes to the Service</h2>
        <p>We may update or modify the Service at any time, including adding or removing features. Subscription pricing may change with notice.</p>
        <h2>13. Changes to These Terms</h2>
        <p>We may revise these Terms periodically. Continued use of the Service after changes constitutes acceptance.</p>
        <h2>14. Contact</h2>
        <p>Questions? Email us at <a href="mailto:support@webcomicstudio.com">support@webcomicstudio.com</a> (placeholder).</p>
        <p>If you need to flag a violation, please <Link to="/report">report an issue</Link>.</p>
      </main>
      <footer className="py-10 border-t border-(--border) bg-(--bg)">
        <div className="mx-auto max-w-6xl px-4 w-full text-center text-sm text-(--muted) flex flex-col gap-2">
          <div>© {new Date().getFullYear()} Webcomic Studio · Build, publish & grow your comic.</div>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/terms" className="hover:underline">Terms of Service</Link>
            <Link to="/adult-content-guidelines" className="hover:underline">Adult Content Guidelines</Link>
            <Link to="/report" className="hover:underline">Report an issue</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
