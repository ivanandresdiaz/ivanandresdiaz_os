# Todo el arrastrar y soltar de Ivan OS usa dnd-kit

Ivan usa Ivan OS sobre todo en el iPhone, y la API nativa de arrastre del navegador (`draggable` + `dataTransfer`) responde mal al tacto. Por eso el arrastrar y soltar se hace con `@dnd-kit/react`: listas reordenables, soporte táctil (mantener presionado antes de arrastrar, para no pelear con el scroll), teclado y scroll automático ya resueltos. Empieza por el orden de los Principles. Ordenar References, llevar Secondary Tasks y tareas del Stack al calendario, y el arrastre del calendario se migran después, para que haya una sola forma de arrastrar en toda la app.

## Considered Options

- **use-gesture**: detecta gestos (movimiento, velocidad, swipe, pinch), pero no sabe de listas ni de dónde se suelta algo; el ordenamiento, las animaciones, el auto-scroll y la accesibilidad habría que escribirlos a mano. Sigue siendo la opción para gestos que no son arrastrar y soltar (p. ej. deslizar para marcar hecho), y convive con dnd-kit.
- **dnd-kit clásico** (`@dnd-kit/core` + `@dnd-kit/sortable`): estable, pero sin versiones nuevas desde diciembre de 2024. Se eligió la versión nueva (`@dnd-kit/react`, 0.x) porque es la que se mantiene; al ser una app de un solo usuario, un cambio de API antes de la 1.0 cuesta poco.

## Actualización (2026-11-02)

El contexto cambió: Ivan usa Ivan OS cerca del 90 % del tiempo desde el computador. En el iPhone y la tablet sobre todo lee y, a veces, agenda trabajo. Planear el día desde la Structure (las Exceptions en la Week) es solo con mouse, y no se invierte en edición táctil más allá de lo que ya existe. La decisión de usar dnd-kit no cambia.
