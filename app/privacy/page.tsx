import Link from 'next/link';
import { COMPANY, CONTACT_EMAIL, LegalPage, SUBPROCESSORS } from '@/components/legal/LegalPage';

export const metadata = { title: 'Privacy policy | Cliprame' };

export default function PrivacyPage() {
    return (
        <LegalPage
            current="/privacy"
            title="Privacy policy"
            intro={`This policy explains what personal data ${COMPANY} ("we") collects when you use Cliprame, the Cliprame Recorder browser extension and Cliprame share pages, why we use it, and the choices you have. It is written for India's Digital Personal Data Protection Act, 2023 and, for people in the EU and UK, the GDPR.`}>
            <h2>The short version</h2>
            <ul>
                <li>Recordings and drafts stay in your browser unless you choose to upload or share them.</li>
                <li>Videos you share are stored privately and played through short-lived links.</li>
                <li>When someone watches a shared video, the sender sees how it was watched. Viewers aren’t asked for an account, and browsers set to “Do Not Track” or Global Privacy Control aren’t tracked.</li>
                <li>We don’t sell personal data or show ads.</li>
            </ul>

            <h2>What we collect</h2>
            <h3>Your account</h3>
            <p>Email address, display name, username and profile photo, and your password (stored only as a secure hash by our sign-in provider). If you subscribe, we keep your plan, subscription status and payment references from Razorpay. We never see or store card or bank details.</p>

            <h3>Your content</h3>
            <ul>
                <li><strong>Recordings, edits and drafts</strong> are kept in your browser’s storage on your device. We don’t receive them unless you export to the cloud or upload them.</li>
                <li><strong>Videos you upload or save to the cloud</strong>, with a poster image, title, chapters and button settings.</li>
                <li><strong>AI features</strong>: when you generate captions, a script, a reel caption or a voiceover, the audio or text you submit is sent to Google’s Gemini API to produce the result. We count the minutes used for plan limits.</li>
                <li><strong>Feedback</strong> you send through the in-app form (rating and comment).</li>
            </ul>

            <h3>People who watch shared videos</h3>
            <p>When a share page is opened, we record, for the video’s owner:</p>
            <ul>
                <li>a random identifier kept in the viewer’s browser (not linked to any account),</li>
                <li>which parts of the video were played and how often, and play, pause, seek, chapter and button-click events,</li>
                <li>device type (mobile, tablet or desktop) and country, from our hosting provider,</li>
                <li>a salted, one-way hash of the network address, used only to stop fake views. The address itself isn’t stored.</li>
            </ul>
            <p>If the sender created a personal link for someone, the name, email and company they entered are linked to that link’s views. Senders must have a lawful reason to send videos and should tell recipients that viewing is measured. Viewers can ask the sender, or us, to delete their data.</p>

            <h3>The browser extension</h3>
            <p>Cliprame Recorder records the tab you choose. Recordings are kept in the extension on your device until you download them or send them to Cliprame. Privacy-mask rules are stored on your device, and masking runs only on sites you turn it on for, after Chrome asks your permission. Masks are applied in the page before recording, so masked data never reaches the video.</p>

            <h2>How we use it</h2>
            <ul>
                <li>To run the service: sign-in, storage, sharing, exports and AI features you request.</li>
                <li>To show video owners their viewer analytics.</li>
                <li>To bill subscriptions and enforce plan limits.</li>
                <li>To keep the service secure, prevent abuse and fix problems.</li>
                <li>To reply to support requests and feedback.</li>
            </ul>
            <p>Our legal bases are your consent and the performance of our contract with you; for viewer analytics and security, our and the sender’s legitimate interests, which viewers can object to as described below.</p>

            <h2>Who we share it with</h2>
            <p>Only the service providers that run Cliprame for us, under contracts that limit their use of the data:</p>
            <table>
                <thead><tr><th>Provider</th><th>Purpose</th><th>Location</th></tr></thead>
                <tbody>
                    {SUBPROCESSORS.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.purpose}</td><td>{item.location}</td></tr>)}
                </tbody>
            </table>
            <p>We may also disclose data where the law requires it. Data may be processed outside your country; where required, we use appropriate safeguards such as standard contractual clauses.</p>

            <h2>How long we keep it</h2>
            <ul>
                <li>Account data: until you delete your account.</li>
                <li>Shared videos and their analytics: until you delete the video or your account.</li>
                <li>Uploads that never finish: deleted automatically after 24 hours.</li>
                <li>Payment records: as long as tax and accounting law requires.</li>
            </ul>
            <p>Deleting your account cancels any subscription and deletes your profile, profile photo, hosted videos, share links and their analytics.</p>

            <h2>Your rights</h2>
            <p>You can access, correct or delete your data, withdraw consent, and ask us how it is used. Most of this is available in your account settings; for anything else email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Under India’s DPDP Act you can also nominate someone to exercise your rights and complain to the Data Protection Board of India. In the EU and UK you can also object to processing, ask for a copy in a portable format, and complain to your data protection authority.</p>
            <p>Viewers who don’t want to be measured can turn on Global Privacy Control or “Do Not Track” in their browser; share pages then record nothing.</p>

            <h2>Security</h2>
            <p>Videos are stored in a private bucket and played through links that expire. Data is encrypted in transit. Access to each account’s data is restricted at the database level.</p>

            <h2>Children</h2>
            <p>Cliprame is not intended for anyone under 18. We don’t knowingly collect their data; contact us if you believe we have.</p>

            <h2>Changes</h2>
            <p>We’ll update this page when our practices change and tell account holders about significant changes. See also our <Link href="/terms">terms of service</Link> and <Link href="/dpa">data processing agreement</Link>.</p>
        </LegalPage>
    );
}
