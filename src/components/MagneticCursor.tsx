import { useEffect, useRef } from 'react';

/**
 * Cursor magnético para manos con temblor: un anillo grande y suavizado
 * acompaña al puntero sin mover el cursor real. Se activa desde el
 * Laboratorio y se recuerda en este dispositivo.
 */
export function MagneticCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = (on: boolean) => {
      document.documentElement.classList.toggle('a11y-magnetic', on);
    };
    apply(localStorage.getItem('lienzo:magnetic:v1') === 'on');

    const onToggle = (event: Event) => {
      apply(Boolean((event as CustomEvent<boolean>).detail));
    };
    const target = { current: { x: -100, y: -100 } };
    const onMove = (event: PointerEvent) => {
      target.current = { x: event.clientX, y: event.clientY };
    };
    let x = -100;
    let y = -100;
    let frame = 0;
    const loop = () => {
      x += (target.current.x - x) * 0.2;
      y += (target.current.y - y) * 0.2;
      if (ref.current) {
        ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      frame = requestAnimationFrame(loop);
    };
    window.addEventListener('tiza:magnetic', onToggle);
    window.addEventListener('pointermove', onMove, { passive: true });
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('tiza:magnetic', onToggle);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div className="magnetic-cursor" ref={ref} aria-hidden="true">
      <span />
    </div>
  );
}
