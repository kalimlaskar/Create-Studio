// The marketing site's look: editorial, quiet, hand-made. Warm paper, ink type, one
// violet accent used sparingly, a serif italic for emphasis instead of gradients.
//   paper   #F6F4EF   page
//   ink     #15120F   text, buttons, the dark band
//   violet  #5B3DF5   the one accent
//   mint    #0E9F6E   "live" only: someone is watching, booked, connected

export const D = 'font-[family-name:var(--font-display)]';
/** Serif italic for the one or two words that carry a heading. */
export const serif = 'font-[family-name:var(--font-serif)] font-normal italic tracking-[-0.01em]';
export const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3DF5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F4EF]';

export const btnPrimary = `group inline-flex items-center justify-center gap-2 rounded-xl bg-[#15120F] px-5 py-3 text-[15px] font-semibold text-[#F6F4EF] transition hover:bg-[#2B2722] ${focus}`;
export const btnGhost = `inline-flex items-center justify-center gap-2 rounded-xl border border-[#15120F]/15 px-5 py-3 text-[15px] font-semibold text-[#15120F] transition hover:border-[#15120F]/35 hover:bg-[#15120F]/[0.03] ${focus}`;

export const card = 'rounded-2xl border border-[#15120F]/10 bg-white';
export const h2 = `${D} text-[2.4rem] font-bold leading-[1.02] tracking-[-0.035em] text-[#15120F] sm:text-5xl lg:text-[3.5rem]`;
export const label = 'text-[12px] font-semibold uppercase tracking-[0.14em] text-[#15120F]/45';
export const muted = 'text-[#15120F]/62';
