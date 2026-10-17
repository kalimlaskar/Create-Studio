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
                <li>Senders can add forms to their videos and connect tools like Slack and HubSpot. What a viewer types into a form, and how they watched, then goes to the sender and the tools the sender chose.</li>
                <li>For viewer data, the sender decides what is collected and why; we process it for them.</li>
                <li>We don’t sell personal data or show ads.</li>
            </ul>

            <h2>What we collect</h2>
            <h3>Your account</h3>
            <p>Email address, display name, username and profile photo, and your password (stored only as a secure hash by our sign-in provider). If you subscribe, we keep your plan, subscription status and payment references from Razorpay. We never see or store card or bank details.</p>

            <h3>Your content</h3>
            <ul>
                <li><strong>Recordings, edits and drafts</strong> are kept in your browser’s storage on your device. We don’t receive them unless you export to the cloud or upload them.</li>
                <li><strong>Videos you upload or save to the cloud</strong>, with a poster image, title, chapters, buttons, forms and booking links you add, and your protection settings. A PIN or password is stored only as a one-way hash.</li>
                <li><strong>Integrations you connect</strong>: Slack webhook addresses, HubSpot access tokens and webhook addresses, encrypted before they are stored, and the result of the last delivery.</li>
                <li><strong>AI features</strong>: when you generate captions, a script, a reel caption or a voiceover, the audio or text you submit is sent to Google’s Gemini API to produce the result. We count the minutes used for plan limits.</li>
                <li><strong>Feedback</strong> you send through the in-app form (rating and comment).</li>
            </ul>

            <h3>People who watch shared videos</h3>
            <p>When a share page is opened, or a video is played where it is embedded on another website, we record, for the video’s sender:</p>
            <ul>
                <li>a random identifier kept in the viewer’s browser (not linked to any account),</li>
                <li>which parts of the video were played and how often, and play, pause, seek, chapter, button-click, form and booking events. From these we show the sender where viewers rewatched, skipped or stopped,</li>
                <li>device type (mobile, tablet or desktop) and country, from our hosting provider,</li>
                <li>for embedded videos, the name of the website it was played on (not the full address),</li>
                <li>a salted, one-way hash of the network address, used only to stop fake views and repeated form submissions. The address itself isn’t stored.</li>
            </ul>
            <p>If the sender created a personal link for someone, the name, email and company they entered are linked to that link’s views.</p>

            <h3>Protected videos</h3>
            <p>A sender can ask viewers for a PIN, a password or an email code before a video plays.</p>
            <ul>
                <li><strong>Email codes</strong>: we send a six-digit code to the address the viewer enters, through our email provider. The code is stored only as a hash and expires after 10 minutes. Once confirmed, the address is shown to the sender alongside that viewer’s views.</li>
                <li><strong>Wrong PINs and passwords</strong> are recorded with the hashed network address, to slow down guessing.</li>
            </ul>

            <h3>Forms in videos</h3>
            <p>A sender can add a form before, during or after a video, for example asking for a name, work email and company. The sender chooses the questions. When a viewer submits a form, we store:</p>
            <ul>
                <li>the answers the viewer typed,</li>
                <li>any hidden values the sender set up to understand where the viewer came from: for example the campaign tags in the link (such as <code>utm_source</code>), the referring page, the address of the page the video was on, and the video’s title. Viewers don’t see these values, but they are only about how the visit arrived, not about the viewer’s device or other browsing,</li>
                <li>the hashed network address, to stop repeated or automated submissions.</li>
            </ul>
            <p>A form before the video must be filled in to watch it. If it asks for an email address, that address is shown to the sender alongside the viewer’s views. The sender may also have us forward each submission to their own systems, such as a HubSpot form or another address they control.</p>

            <h3>Booking calendars in videos</h3>
            <p>A sender can show their booking page (for example Calendly, Cal.com or HubSpot Meetings) inside the player. That page is run by the booking provider under its own privacy policy, and anything typed into it goes to that provider and the sender, not to us. For Calendly, the provider tells the page when a meeting is booked, and we record that a booking happened, not its details.</p>

            <h3>What senders are responsible for</h3>
            <p>For viewer data, the sender is in charge of the purpose and we act on their behalf (see our <Link href="/dpa">data processing agreement</Link>). Senders must have a lawful reason to send videos and collect form answers, should tell recipients that viewing is measured, and should write consent text on their forms that explains how answers will be used. The share page itself tells viewers that the sender can see how the video is watched. Viewers can ask the sender, or us, to delete their data.</p>

            <h3>The browser extension</h3>
            <p>Cliprame Recorder records the tab you choose. Recordings are kept in the extension on your device until you download them or send them to Cliprame. Privacy-mask rules are stored on your device, and masking runs only on sites you turn it on for, after Chrome asks your permission. Masks are applied in the page before recording, so masked data never reaches the video.</p>

            <h3>Reports about videos</h3>
            <p>Anyone watching a shared video can report it, without an account. We store the reason, any details and contact email the reporter chooses to give, and a hashed network address to stop repeated reports. The sender isn’t told who reported their video.</p>
            <p>We don’t routinely watch people’s videos. A Cliprame administrator opens a video only to review a report about it, through a link that expires after 15 minutes, and every such viewing is recorded in an internal audit log. If a video breaks our rules, we may take it down or suspend the account. Taken-down videos stop playing but aren’t deleted straight away, so a mistake can be put right.</p>

            <h2>How we use it</h2>
            <ul>
                <li>To run the service: sign-in, storage, sharing, exports and AI features you request.</li>
                <li>To show senders their viewer analytics and form submissions.</li>
                <li>To protect videos the sender locked, and to deliver alerts and form submissions to the tools the sender connected.</li>
                <li>To bill subscriptions and enforce plan limits.</li>
                <li>To keep the service secure, prevent abuse and fix problems, including reviewing reported videos and acting on them.</li>
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
            <p><strong>Tools a sender connects.</strong> When a sender connects Slack, HubSpot or a webhook, or sends form submissions to a HubSpot form or another address, we send data there on the sender’s instruction: the viewer’s name, email and company where known, how much of the video they watched, their device and country, and, for forms, their answers and hidden values. These tools belong to the sender, not to us, and the sender’s own agreements with them apply.</p>
            <p>We may also disclose data where the law requires it. Data may be processed outside your country; where required, we use appropriate safeguards such as standard contractual clauses.</p>

            <h2>Cookies and browser storage</h2>
            <p>We don’t use advertising or cross-site tracking cookies. We use:</p>
            <table>
                <thead><tr><th>Name</th><th>Purpose</th><th>Lasts</th></tr></thead>
                <tbody>
                    <tr><td><strong>Sign-in cookies</strong></td><td>Keep you signed in to your account.</td><td>Until you sign out</td></tr>
                    <tr><td><strong>cliprame_unlock_…</strong></td><td>Remembers that a viewer unlocked a protected video, so they aren’t asked again.</td><td>7 days</td></tr>
                    <tr><td><strong>cliprame_lead_…</strong></td><td>Remembers that a viewer filled in a video’s gate form, so they aren’t asked again.</td><td>7 days</td></tr>
                    <tr><td><strong>cliprame-sidebar</strong></td><td>Remembers whether you collapsed the studio sidebar.</td><td>1 year</td></tr>
                    <tr><td><strong>cliprame-viewer</strong> (browser storage)</td><td>The random viewer identifier described above, so repeat visits aren’t counted as new viewers.</td><td>Until cleared</td></tr>
                </tbody>
            </table>
            <p>The unlock and form cookies are strictly necessary for the video to play once a viewer has passed the check. On embedded videos, some browsers block them, in which case the viewer is simply asked again.</p>

            <h2>How long we keep it</h2>
            <ul>
                <li>Account data: until you delete your account.</li>
                <li>Shared videos, their analytics and form submissions: until the sender deletes the video or their account.</li>
                <li>Email codes and records of wrong PINs or passwords: deleted after one day.</li>
                <li>Records of which alerts were sent (used to avoid sending one twice): deleted after 90 days.</li>
                <li>Integration settings: until the sender removes the integration or deletes their account.</li>
                <li>Reports about videos and the record of admin actions: as long as needed for safety and legal reasons.</li>
                <li>Uploads that never finish: deleted automatically after 24 hours.</li>
                <li>Payment records: as long as tax and accounting law requires.</li>
            </ul>
            <p>Deleting your account cancels any subscription and deletes your profile, profile photo, hosted videos, share links, their analytics and form submissions, and your integrations. Copies already delivered to tools you connected, like Slack or HubSpot, stay there until you delete them in those tools.</p>

            <h2>Your rights</h2>
            <p>You can access, correct or delete your data, withdraw consent, and ask us how it is used. Most of this is available in your account settings; for anything else email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Under India’s DPDP Act you can also nominate someone to exercise your rights and complain to the Data Protection Board of India. In the EU and UK you can also object to processing, ask for a copy in a portable format, and complain to your data protection authority.</p>
            <p>Viewers who don’t want to be measured can turn on Global Privacy Control or “Do Not Track” in their browser; share pages then record nothing about how they watch. Forms are different: anything a viewer chooses to submit in a form is still sent to the sender. Viewers who want their form answers or viewing data removed can ask the sender, or email us and we’ll pass the request on and help.</p>

            <h2>Security</h2>
            <p>Videos are stored in a private bucket and played through links that expire. For protected videos, the video’s address isn’t sent to a viewer until they pass the PIN, password, email code or gate form. Data is encrypted in transit, and integration tokens and addresses are encrypted at rest. PINs, passwords and email codes are stored only as hashes. Access to each account’s data is restricted at the database level.</p>

            <h2>Children</h2>
            <p>Cliprame is not intended for anyone under 18. We don’t knowingly collect their data; contact us if you believe we have.</p>

            <h2>Changes</h2>
            <p>We’ll update this page when our practices change and tell account holders about significant changes. See also our <Link href="/terms">terms of service</Link> and <Link href="/dpa">data processing agreement</Link>.</p>
        </LegalPage>
    );
}
