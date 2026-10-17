import { MarketingShell } from '@/components/marketing/MarketingShell';
import { getMarketingSession } from '@/components/marketing/session';
import DemoShowcaseClient from './DemoShowcaseClient';

export const metadata = {
    title: 'Demo | Cliprame',
    description: 'See a Cliprame video from both sides: what you record, what your prospect sees, and the alert you get when they watch. Plus scripts to borrow.',
};

export default async function DemoPage() {
    const session = await getMarketingSession();
    return (
        <MarketingShell current="demo" session={session}>
            <DemoShowcaseClient isLoggedIn={session.isLoggedIn} />
        </MarketingShell>
    );
}
