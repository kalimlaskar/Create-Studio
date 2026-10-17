import Link from 'next/link';
import { COMPANY, LegalPage } from '@/components/legal/LegalPage';
import { getCatalogPlan } from '@/lib/plans/catalog';

export const metadata = { title: 'Terms of service | Cliprame' };

export default async function TermsPage() {
    const free = await getCatalogPlan('free');
    return (
        <LegalPage
            current="/terms"
            title="Terms of service"
            intro={`These terms are an agreement between you and ${COMPANY} for using Cliprame, the Cliprame Recorder extension and Cliprame share pages. By creating an account or using the service, you accept them. If you use Cliprame for an organisation, you accept them on its behalf.`}>
            <h2>Your account</h2>
            <p>You must be at least 18 and give accurate details. Keep your password safe; you’re responsible for activity on your account. Tell us promptly if you think it has been misused.</p>

            <h2>Plans and payment</h2>
            <ul>
                <li>The Free plan is limited ({free.exportSeconds}-second videos{free.watermark ? ' with a watermark' : ''}, {free.hostedVideos} hosted videos). Paid plans and their limits are listed on the <Link href="/pricing">pricing page</Link>.</li>
                <li>Paid plans renew monthly through Razorpay until cancelled. You can cancel at any time; access continues until the end of the period you’ve paid for.</li>
                <li>Refunds are handled as described at the time of purchase or as required by law.</li>
                <li>We may change prices with at least 30 days’ notice; changes apply from your next renewal.</li>
                <li>AI features have monthly allowances that reset each calendar month.</li>
            </ul>

            <h2>Your content</h2>
            <p>You own the videos, scripts and other content you create. You give us a limited licence to store, process, convert, transcribe and show it only to provide the service to you and the people you share it with. You confirm you have the rights and permissions needed for your content, including from anyone who appears or speaks in it.</p>

            <h2>Sharing and viewer analytics</h2>
            <p>Share pages tell viewers that the sender can see how a video is watched. When you send personal links, you’re responsible for having a lawful basis to contact and measure each recipient, and for honouring their requests to stop. Use the privacy-mask tools to keep confidential data out of recordings; masks reduce, but can’t guarantee, exposure, so review your recordings before sharing.</p>

            <h2>Acceptable use</h2>
            <p>Don’t use Cliprame to:</p>
            <ul>
                <li>break the law or infringe anyone’s rights, including privacy and intellectual property,</li>
                <li>share sexual content involving minors, threats, harassment, hate, or malware,</li>
                <li>impersonate others, send spam, or record people without the consent the law requires,</li>
                <li>inflate view counts, get around plan limits or security, or overload the service.</li>
            </ul>
            <p>We may remove content or suspend accounts that break these rules, and will tell you why unless the law prevents it.</p>

            <h2>AI features</h2>
            <p>Captions, scripts, translations and voiceovers are generated automatically and can contain mistakes. Review them before publishing. Don’t use AI voiceover to imitate a real person without their permission.</p>

            <h2>Service changes and availability</h2>
            <p>We work to keep Cliprame available but don’t guarantee it will be uninterrupted. We may add, change or remove features; if we remove a paid feature you rely on, you may cancel and we’ll refund any unused prepaid period.</p>

            <h2>Ending the agreement</h2>
            <p>You can delete your account at any time in account settings. We may suspend or end accounts that seriously or repeatedly break these terms. When an account ends, its hosted content is deleted as described in our <Link href="/privacy">privacy policy</Link>.</p>

            <h2>Liability</h2>
            <p>The service is provided “as is”. To the extent the law allows, we aren’t liable for indirect or consequential losses, and our total liability is limited to the amount you paid us in the 12 months before the claim. Nothing here limits liability that can’t be limited by law.</p>

            <h2>Law</h2>
            <p>These terms are governed by the laws of India, and disputes go to the courts of India, unless the law where you live gives you the right to bring a claim locally. Business customers can also sign our <Link href="/dpa">data processing agreement</Link>.</p>
        </LegalPage>
    );
}
