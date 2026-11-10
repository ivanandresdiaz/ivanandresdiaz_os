import Image from "next/image";
import ivan from "./ivan.webp";

/**
 * Ivan himself, drawn, saying something to the Stakeholder (Ronda 56): on the
 * sign-in, the menu and the goodbye, never inside an Interview, where Ivan AI
 * asks and nothing should distract.
 *
 * `big` on the sign-in, so people recognize him at first sight: the drawing
 * fills the column and the bubble sits above it. Elsewhere, small, beside it.
 */
export function IvanSays({ children, big = false }: { children: React.ReactNode; big?: boolean }) {
  if (big) {
    return (
      <div className="flex flex-col items-center">
        <div className="bubble-in relative z-10 w-full rounded-3xl border border-line bg-surface px-5 py-4 text-base leading-snug shadow-sm [transform-origin:center_bottom]">
          {/* The tail, pointing down at Ivan. */}
          <span
            aria-hidden
            className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-r border-b border-line bg-surface"
          />
          <p className="relative">{children}</p>
        </div>
        <Image
          src={ivan}
          alt="Ivan Díaz"
          priority
          sizes="(max-width: 512px) 100vw, 480px"
          className="ivan-in -mt-1 w-full select-none drop-shadow-sm"
          draggable={false}
        />
      </div>
    );
  }
  return (
    <div className="flex items-start gap-1">
      <Image
        src={ivan}
        alt="Ivan Díaz"
        width={110}
        sizes="110px"
        priority
        className="ivan-in w-[110px] shrink-0 select-none drop-shadow-sm"
        draggable={false}
      />
      <div className="bubble-in relative mt-3 min-w-0 flex-1 rounded-3xl rounded-tl-md border border-line bg-surface px-4 py-3 text-[15px] leading-snug shadow-sm">
        {/* The tail, pointing at Ivan's mouth. */}
        <span
          aria-hidden
          className="absolute top-5 -left-[7px] size-3 rotate-45 border-b border-l border-line bg-surface"
        />
        <p className="relative">{children}</p>
      </div>
    </div>
  );
}
