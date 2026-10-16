import Link from 'next/link';

export default function ShareNotFound() {
    return (
        <main className="grid min-h-dvh place-items-center bg-[#F7F6FB] px-4 text-center text-[#14121F]">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">This video isn’t available</h1>
                <p className="mt-2 text-sm text-[#14121F]/60">The link may have been turned off or the video deleted. Ask the sender for a new link.</p>
                <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[#6A4CFF] hover:underline">Go to Cliprame</Link>
            </div>
        </main>
    );
}
