/** Closing CTA band before the footer: gold leaf with subtle film grain, black type, black button. */
export function ClosingBand({ dateLabel }: { dateLabel: string }) {
  return (
    <section className="on-gold grain section-y text-black" style={{ backgroundImage: "var(--leaf)" }} aria-labelledby="closing-title">
      <div className="wrap flex flex-col items-center text-center">
        <h2 id="closing-title" className="display display-l text-black">
          Be in the room.
          <br />
          <span className="tnum">{dateLabel}.</span>
        </h2>
        <a href="#tickets" className="btn btn-black-gold mt-10">
          Book your pass
        </a>
      </div>
    </section>
  );
}
