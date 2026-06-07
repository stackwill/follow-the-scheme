"use client";

import { useEffect, useRef } from "react";

export function DemoNotice() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function dismissNotice() {
    const scrollPosition = window.scrollY;
    const horizontalScrollPosition = window.scrollX;

    dialogRef.current?.close();
    window.requestAnimationFrame(() => {
      window.scrollTo(horizontalScrollPosition, scrollPosition);
    });
  }

  useEffect(() => {
    dialogRef.current?.showModal();
    window.history.replaceState({}, "", "/");
  }, []);

  return (
    <dialog className="demo-notice" ref={dialogRef}>
      <div className="demo-notice__content study-callout">
        <span className="active-course-pill">Portfolio demo</span>
        <strong>This is the demo version of IHateGCSE</strong>
        <span>
          The real site is private. This demo gives you the same experience so you can explore papers and try the
          marking flow.
        </span>
        <button className="button-link" onClick={dismissNotice} type="button">
          Explore the demo
        </button>
      </div>
    </dialog>
  );
}
