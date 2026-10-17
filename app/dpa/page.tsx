import Link from 'next/link';
import { COMPANY, CONTACT_EMAIL, LegalPage, SUBPROCESSORS } from '@/components/legal/LegalPage';

export const metadata = { title: 'Data processing agreement | Cliprame' };

export default function DpaPage() {
    return (
        <LegalPage
            current="/dpa"
            title="Data processing agreement"
            intro={`This agreement applies when a business ("Customer") uses Cliprame to process personal data about other people, such as video recipients and viewers. It forms part of the terms of service. To receive a signed copy, email ${CONTACT_EMAIL}.`}>
            <h2>1. Roles</h2>
            <p>For personal data in the Customer’s videos, share links and viewer analytics, the Customer is the controller (the “data fiduciary” under India’s DPDP Act) and {COMPANY} is the processor. {COMPANY} processes it only to provide the service and on the Customer’s documented instructions, which are these terms and the Customer’s use of the product.</p>

            <h2>2. Data covered</h2>
            <ul>
                <li><strong>People:</strong> the Customer’s users, people appearing in videos, recipients of personal links, viewers of share pages and embedded videos, and people who submit the Customer’s forms.</li>
                <li><strong>Data:</strong> videos and their audio, transcripts, recipient name, email and company, viewing analytics (random browser identifier, playback and interaction events, device type, country, embedding website and a hashed network address), email addresses confirmed to unlock protected videos, and form submissions (the answers the Customer asks for and the hidden values it sets up, such as campaign tags and referring page).</li>
                <li><strong>Purpose and duration:</strong> hosting, sharing and measuring videos for as long as the Customer keeps them in the service.</li>
            </ul>

            <h2>3. Our commitments</h2>
            <ul>
                <li>Staff and contractors with access are bound by confidentiality.</li>
                <li>We maintain appropriate security: private storage with expiring links, encryption in transit, database-level access controls, and abuse limits on analytics.</li>
                <li>We help the Customer respond to requests from individuals (access, correction, deletion) and with impact assessments where reasonably needed.</li>
                <li>We notify the Customer without undue delay, and within 72 hours where possible, after becoming aware of a personal data breach affecting their data.</li>
                <li>When the Customer deletes content or ends the service, we delete the related personal data, except where the law requires us to keep it.</li>
                <li>We make available the information reasonably needed to show compliance with this agreement.</li>
            </ul>

            <h2>4. Subprocessors</h2>
            <p>The Customer authorises these subprocessors. We’ll give at least 30 days’ notice of new ones by updating this page; the Customer may object and, if we can’t resolve it, end the affected service.</p>
            <table>
                <thead><tr><th>Subprocessor</th><th>Purpose</th><th>Location</th></tr></thead>
                <tbody>
                    {SUBPROCESSORS.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.purpose}</td><td>{item.location}</td></tr>)}
                </tbody>
            </table>

            <h2>5. International transfers</h2>
            <p>Where personal data is transferred out of the EU, UK or India in a way that requires safeguards, the parties rely on the applicable standard contractual clauses or other lawful mechanisms.</p>

            <h2>6. The Customer’s responsibilities</h2>
            <p>The Customer is responsible for having a lawful basis to record people, to send and measure personal links and to collect form answers, for giving recipients any required notice (including clear consent text on its forms), and for the accuracy of recipient details it enters. When the Customer connects Slack, HubSpot, a webhook or its own form backend, data sent there is sent on the Customer’s instruction; those services are the Customer’s recipients, not our subprocessors. See the <Link href="/privacy">privacy policy</Link> for what viewers are told.</p>
        </LegalPage>
    );
}
