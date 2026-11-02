---
status: rebanadas 1 y 2 desplegadas; correcciones del Check-in construidas en local (2026-10-31) — siguiente: validar UX, desplegar y rebanada 3
updated: 2026-10-31
resume: "Rebanadas 1 y 2 desplegadas. Correcciones del Check-in construidas en local: Secondary Tasks con carry over y agenda opcional, y Eliminate como Noise items del día. Siguiente: validar UX, aplicar migraciones 0002–0004 en Neon y desplegar; luego rebanada 3."
fuentes:
  - strategian/ivan/Manifesto_with_ai/Manifesto_with_ai.md (v1.0)
  - strategian/ivan/principles/From the inside out & own yourself.md
  - strategian/reference_players/ali_abdall/GPS/GPS.md
  - strategian/ivan/MyGame/MyGame.canvas
  - Areas/innovacion/innovacionUNIR/tipos de innovacion.md
  - Templates/str_daily.md (nota diaria: Morning + Night)
  (todas bajo /home/ivanandresdiaz/Documentos/Read/strategian_notes/)
---

# Ivan OS · ivanandresdiaz.com — Estado del grilling

> Documento vivo. Se actualiza cada ronda. Términos resueltos → [GLOSSARY.md](./GLOSSARY.md).
> Desde la Ronda 4 el vocabulario canónico es en inglés: Movimiento → **Campaign**, Jugada → **Move**.

## Raíz

ivanandresdiaz.com es **la página para la administración estratégica de mi vida, mis tácticas y mi ejecución sin fricción**. Esa es la columna vertebral. Encima, algún día: portafolio, servicios, tracking de YouTube, agentes, API hacia otros proyectos míos.

- Un solo usuario: yo. Se construye iterando; yo soy la retroalimentación.
- **Las fechas no importan. Lo que importa es diseñar con calidad** (Ronda 1, Q1). Esto reemplaza el "v0 el 15 de nov / solo 2 pantallas" del manifiesto como criterio de arranque.
- Las relaciones entre todo (metas ↔ juegos infinitos ↔ principios) deben ser explícitas: a la larga son el **harness para que una IA entienda quién soy y qué persigo**.

## Modelo mental (dictado por Ivan, 2026-10-29)

```
Principios (la raíz: cómo percibo y juego)
│
├── Juegos infinitos  — dimensiones de vida que nunca terminan
│     (salud, mente, relaciones sociales, dinero, éxito profesional…)
│     cada uno con su Backlog
│
└── Temporada  — indefinida, p. ej. "trabajando en microfinanzas en El Alcaraván"
      │   markdown libre: hablar de mi realidad, objetivos generales
      └── Capítulo — 3 meses del año
            │   título + markdown guiado por plantilla de preguntas (que itero)
            └── Metas (GPS): Goal · Por qué · Anti-goal/constraints
                  │   enlazadas a uno o más Juegos infinitos
                  └── Plan → Roadmap "barquito navegando por puertos", con fechas
                        allí selecciono objetivos concretos e infinitos
```

**Dos naturalezas de trabajo** (dentro de los juegos infinitos):
- **Hábitos**: fijos en el calendario. Ej.: gym 1 h a las 5 AM, hora del journal.
- **Estratégicas / medibles**: viven en horario laboral. Ej.: terminar autenticación con SSO. Alimentan una **gamificación** que siempre debe estar atada al **alineamiento**.

### Principios (ejemplos, no lista cerrada)

Tras Q14: los principios son **recordatorios** para alinear la mente, no reglas. Ivan agrega los que quiera, cada uno con un orden y un MD opcional para expandirlo. Los de abajo son el borrador inicial.


1. **Desde adentro hacia afuera / Own yourself.** Percibo el mundo como creador: la vida viene de mí, no hacia mí. Mi alma y mi ser son la fuente; lo externo es feedback e iteración.
2. **Flujo.** Diseño del flujo, cero fricción.
3. **Jugar por posición.**
4. **Decidir y comprometerme a ser feliz**, como acto de autoría de mi vida. (Ivan nota que se parece al #1.)
5. **Jugar por INPUTS, no por outputs.** Los inputs siempre están en el presente y traen flujo. Jugar por outputs trae ansiedad, frustración y desconexión del presente.

## Ronda 1 — resultados

| # | Decisión | Estado |
|---|---|---|
| Q1 | Punto de partida = v1 del manifiesto | ❌ Rechazado. Sin fechas; diseñar con calidad partiendo del modelo mental de arriba. Parking lot sigue vigente. |
| Q2 | Una sola app Next.js: raíz pública mínima + OS privado | ⏳ Sin responder → Ronda 3 |
| Q3 | Backend en Next.js, dominio en módulo TS puro, sin NestJS por ahora | ⏳ Sin responder → Ronda 3 |
| Q4 | Temporada vs Movimiento | ✅ Resuelto distinto: **Temporada** = indefinida; **Capítulo** = 3 meses. Se descarta "Movimiento" y "Ciclo". |
| Q5 | Las 8 capas del manifiesto son canónicas | 🔁 Reformulado como Q8 (¿capas = juegos infinitos?) |
| Q6 | v0 como PWA instalable sin offline/push | ⏳ Sin responder → Ronda 3 |

## Ronda 2 — resultados (2026-10-30)

| # | Decisión | Estado |
|---|---|---|
| Q7 | Principios arriba; eje del tiempo + eje transversal de Juegos infinitos | ✅ Aceptado. Ivan pide que proponga sin miedo: no tiene todo claro. |
| Q8 | Juego infinito = Capa; las 8 del manifiesto | ✅ Aceptado, con un añadido: **etiquetas múltiples** (gym = Body + Mind). Quiere ver **dónde invierte su tiempo** por juego. |
| Q9 | Vocabulario Meta / Hábito / Jugada | 🔁 Ivan reintroduce **Movimiento** = objetivo de 3 meses; dijo "jugada = movimientos de 3 meses". Choca con su plantilla diaria, donde "la jugada" es el día → Q16. |
| Q10 | Puntos y rachas solo premian inputs | ✅ Aceptado. |
| Q11 | Una Temporada activa; Ivan OS es una Meta | 🔁 Temporada = **título + MD + Personas en radar** (escala 1–10, cumpleaños) **+ objetivos estratégicos** (ej. "hacer 30.000"), de los que salen los Movimientos. "Una sola activa" sin responder → Q25. |
| Q12 | Capítulos = trimestres calendario | 🔁 "Más que capítulos, otro MD de los 3 meses"; los **Movimientos** son la jerarquía de objetivos, cada uno con su **por qué**. Lo de trimestre calendario sigue abierto → Q24. |
| Q13 | Plantillas versionadas | ⏳ Sin responder → Q23, Q24. |
| Q14 | Fusionar principios #1 y #4 | ✅ Resuelto distinto: lista libre, ordenada, cada principio con MD opcional. |
| Q15 | Rituales | 🔁 Check-in diario = **ritual de la mañana**: ver objetivos de Temporada, Movimientos y la semana → elegir el **Highlight** (Make Time) → acomodar tareas en los bloques de una **Estructura** semanal de calendario (nudge, editable, con excepciones y warnings). Vistas día/semana/mes. Además: **"¿Qué estoy aprendiendo?"** (captura durante el día) y **Journal** (autorreflexión, noche). Quiere una **vista rápida del alineamiento** de todos sus objetivos. |

Ejemplo de Estructura (lunes): 7:30–8 Lectura · 8–12 Deep work empresa · 12:20–1 Nap · 1–2 Side hustle · 2–4 Deep work empresa · 4–6 Learning…

## Ronda 3 — resultados (2026-10-30)

| # | Decisión | Estado |
|---|---|---|
| Q16 | Temporada → Objetivo de Temporada → Movimiento (3 m, GPS) → Jugada; Trimestre; sin Mes; Ivan OS = Movimiento | ✅ Aceptado. Añadidos: una Jugada se puede **subdividir opcionalmente**, y las subdivisiones también se agendan **arrastrando** en el calendario. **App toda en inglés**, con un botón para traducir al inglés lo que escriba en español. |
| Q17 | Highlight reemplaza 9/10 | ✅ Con cambio: **de 1 a 3 Highlights** por día, cada uno con su *por qué mueve la aguja*. Más Tareas secundarias. Navegar cómodo hacia ayer y por los journals. |
| Q18 | Estructura + Excepciones | ✅ |
| Q19 | Bloque-hábito / Bloque-contenedor | ✅ |
| Q20 | Etiquetas múltiples cuentan completo | ✅ Concepto **Fork** (ajedrez): buscar inputs que avanzan varios juegos. |
| Q21 | Persona global + Radar por Temporada | ✅ El 1–10 es cualitativo: importancia, cercanía y alineación conmigo. |
| Q22 | Calendario propio | ✅ Máximo poder de customización. |
| Q23 | Nota del día en Ivan OS, plantilla versionada | ✅ |
| Q24 | Trimestre calendario + plantilla versionada | 🔁 MD del Trimestre **sin versionar**. Trimestre calendario sin objeción. |
| Q25 | Una sola Temporada | ✅ Siempre una. |
| Q26 | Revisión semanal | ✅ Domingo, o lunes si quedó pendiente. Revisa aprendizajes del "¿Qué estoy aprendiendo?", lo que pasó, y elige Jugadas. |

## Ronda 4 — resultados (2026-10-30)

| # | Decisión | Estado |
|---|---|---|
| Q27 | Nombres canónicos en inglés | ✅ Con cambio: **Campaign** (3 meses) · **Move** · **Task** · **Step**. Cuatro niveles → Q36. |
| Q28 | Botón traducir | 🔁 Se vuelve **English Coach**, solo en MDs: muestra correcciones, Ivan las lee y decide si reemplaza. Títulos e inputs cortos los escribe en inglés. Leer en voz alta → parking lot. |
| Q29 | Un solo nivel de Steps | 🔁 Ivan dice "campaign, move, task and steps" → Q36. |
| Q30 | Tasks sueltas + Backlog | ✅ |
| Q31 | Highlights, "eliminar", Day Won | ✅ Idea de recompensa: "te mereces un premio" → ofrecer Secondary Tasks (p. ej. libros por leer) o el **modo ambicioso** ("¿quieres ganarle tiempo al juego? ¿seguro?"), con alerta de carrera de la rata de productividad e ignorar otros Infinite Games. Se itera después. |
| Q32 | Warnings no bloqueantes | ✅ Nuevo experimento: **sesiones de foco tipo pomodoro** (empezó a trabajar 8:12, no 8:00; a los 90 min café/moverse; descansos de 5 min). Clic → arranca el juego y se registra cómo usa realmente el tiempo → Q38–Q40. |
| Q33 | Alineamiento calculado + sentido | ✅ (revisar con sesiones → Q40) |
| Q34 | Roadmap como vista con Ports | ✅ |
| Q35 | Export de contexto para IA, sin Radar por defecto | ✅ |

## Ronda 5 — resultados (2026-10-30)

| # | Decisión | Estado |
|---|---|---|
| Q36 | Campaign → Move → Task → Step con roles distintos | ✅ Añadido: una Task que no se termina en un día se agenda otro día → Q41. |
| Q37 | English Coach simple (cambios marcados + por qué + Replace) | ✅ Iterar después. |
| Q38 | Plan (Block) y realidad, por separado | ✅ |
| Q39 | Ritmo configurable | ✅ Se llaman **Cycles** (ciclos de trabajo). Animación de enfoque al entrar; se puede cerrar el Cycle en cualquier momento y reiniciar. Prioridad: experimentar e iterar. |
| Q40 | Alineamiento con tiempo real | ❌ Rechazado. Importan **la planeación y que se logró el objetivo**. El tiempo real es ayuda de foco y gamificación, métrica adicional. Algunas cosas (ejercicio) no se miden por tiempo. |
| Q2 | Una sola app Next.js | ✅ Menciona "estar pendiente de mi app y los mensajes que lleguen" → Q44. |
| Q3 | Backend en Next.js, dominio en TS puro | ✅ Iterar rápido; migrar cuando el producto esté maduro y claro, si hace falta. |

## Ronda 6 — resultados (2026-10-30)

Todo aceptado: Q41 (carried over ×N), Q42 (Cycle opcional, presets, pantalla de foco), Q43 (alignment = horas planeadas en Campaign work hechas ÷ horas de Container Blocks), Q44 (mensajes → parking lot), Q45 (qué da XP), Q46 (XP y nivel por Infinite Game), Q47 (never miss twice; **lo importante es elegir el Highlight del día** → la racha principal es esa), Q48 (Day Won + Ambitious Mode sin XP extra), Q6 (PWA instalable, notificaciones locales, sin offline), Q49 (Google login restringido a la cuenta de Ivan), Q50 (Postgres administrado + ORM tipado, Vercel, Claude API para el Coach).

## Ronda 7 — resultados (2026-10-30)

Todo aceptado: Q51 (rebanada 1 = loop de la mañana), Q52 (orden de rebanadas), Q53 (día + semana), Q54 (8 Infinite Games fijos + seed), Q55 (esta carpeta = repo), Q56 (Vitest en el dominio). ADR escrito: [0001](docs/adr/0001-alignment-sobre-lo-planeado.md).

## Ronda 8 — correcciones del Check-in (2026-10-31)

| # | Decisión | Estado |
|---|---|---|
| Q57 | Descripción de Eliminate | ✅ Texto en inglés como placeholder, un recordatorio suave que desaparece al escribir: “Low ROI. Doesn’t move the needle. Pulls me away from my goals. Irrelevant.” |
| Q58 | Secondary Goals | ✅ Nombre canónico: **Secondary Task**; sección **Secondary Tasks**. No se introduce Secondary Goal. |
| Q59 | Secondary Task, Alignment y Noise | ✅ Es válida pero no estratégica: no aporta Alignment ni XP, no cuenta para Day Won, no necesita why y no es Highlight. Tampoco es Noise; se ajusta la definición de Signal / Noise. |

## Ronda 9 — Secondary Tasks (2026-10-31)

| # | Decisión | Estado |
|---|---|---|
| Q60 | Carry over | ✅ Una Secondary Task pendiente vuelve automáticamente al día siguiente hasta completarla o eliminarla. Ivan prefiere verla y decidir; no estratégica no significa que pueda olvidarse. |
| Q61 | Captura y calendario | ✅ Sección entre Highlights y Eliminate. Quick-add solo con título, checkbox y drag al calendario del día. Al soltarla: 30 min por defecto, redimensionable; checklist y calendario sincronizan el estado hecho. |
| Q62 | Alcance | ✅ Acciones únicas, sin recurrencia, Steps, Infinite Games, Backlog ni relación con Campaigns o Moves. |

## Ronda 10 — Carry over y cierre de Secondary Tasks (2026-10-31)

| # | Decisión | Estado |
|---|---|---|
| Q63 | Sin duplicados | ✅ El carry over muestra la misma Secondary Task, no copias diarias. Las pendientes arrastradas aparecen primero, con insignia ×N. |
| Q64 | Secondary Task agendada y pendiente | ✅ El Slot pasado queda como historial; vuelve al día siguiente sin horario. Puede completarse directamente desde el checklist, sin volver a agendarla. |
| Q65 | Completar y eliminar | ✅ Completarla detiene el carry over y queda chequeada ese día. Eliminarla la quita definitivamente y detiene el carry over; sin papelera. |
| Q66 | Cantidad y orden | ✅ Sin límite ni prioridad manual: carried over pendientes → nuevas pendientes → completadas. El límite de 1–3 es solo para Highlights. |

## Ronda 11 — Eliminate como ítems (2026-10-31)

| # | Decisión | Estado |
|---|---|---|
| Q67 | De dónde salen | ✅ Cada mañana me pregunto qué debo ignorar hoy; los ítems salen del momento (p. ej. "AI news"). Se escriben ese día; no hay lista reutilizable ni lista fija. |
| Q68 | Nombre | ✅ **Noise item**. La sección sigue siendo **Eliminate (the noise for today)**. |
| Q69 | Texto libre | ✅ El textarea desaparece; no queda nota opcional. |
| Q70 | Sin mecánicas | ✅ Es solo un nudge para ignorar cosas: sin XP, Streak, calendario, carry over ni revisión nocturna. |
| Q71 | Forma del ítem | ✅ Solo el texto y una × para borrarlo; sin checkbox, sin drag, sin edición. Por defecto no hay ruido: solo existe el que identifico y agrego. |
| Q72 | Cada día empieza vacío | ✅ Los Noise items de ayer no aparecen hoy; los días pasados conservan los suyos como historial. |
| Q73 | Texto existente | ✅ Cada línea no vacía del Eliminate guardado se convierte en un Noise item de esa fecha; luego se elimina la columna de texto. |
| Q74 | Recordatorio | ✅ Los cuatro criterios pasan a una línea tenue bajo el título "Eliminate"; el input lleva un placeholder propio (texto exacto en Q77). |
| Q75 | No es requisito | ✅ "Complete check-in" funciona con cero Noise items. |
| Q76 | Día vacío | ✅ La sección muestra solo el título, los criterios y un botón "+ Add noise"; el input aparece al hacer clic. Si no hago clic, ese día no hay ruido. |
| Q77 | Placeholder | ✅ "What noise do I eliminate today?", con el mismo verbo del título. |

## Ronda 12 — Crear Blocks arrastrando en la Structure (2026-10-31)

| # | Decisión | Estado |
|---|---|---|
| Q78 | Alcance | ✅ Solo la página Structure. El calendario del día conserva su formulario; se revisa en otra ronda. |
| Q79 | Gesto | ✅ Presionar en un espacio vacío de una columna y arrastrar vertical; un Block fantasma punteado muestra el rango en vivo ("Mon 08:00–10:30"), con snap de 15 min. Una sola columna. Presionar un Block existente lo sigue moviendo o redimensionando. |
| Q80 | Clic sin arrastrar | ✅ Un clic o tap crea un rango de 1 h desde ahí y abre el modal. En pantallas táctiles, arrastrar en vacío sigue haciendo scroll. |
| Q81 | Varios días | ✅ El modal tiene toggles M T W T F S S, con el día arrastrado preseleccionado. Cada día seleccionado recibe su propio Block independiente. |
| Q82 | Modal | ✅ Muestra el rango y los toggles, y lista los Block types activos con su color, agrupados en Habit y Container. Un clic en un Block type lo crea y cierra; sin botón "Add". Escape o clic afuera cancela. |
| Q83 | Horas en el modal | ✅ Solo lectura. Las horas se corrigen arrastrando en la grilla. |
| Q84 | Superposición | 🔄 Primero "no se permite"; revisada en Q87: se permite y muestra un Warning. |
| Q85 | Formulario lateral | ✅ Se elimina "Add a Block"; queda una pista "Drag on the calendar to add a Block". La sección Block types se queda. |
| Q86 | Cambiar el Block type | ✅ Clic (sin arrastrar) en un Block existente abre el mismo modal para cambiar su Block type, de hoy en adelante. La × sigue siendo la forma de quitarlo. |

## Ronda 13 — Superposición en la Structure (2026-10-31)

| # | Decisión | Estado |
|---|---|---|
| Q87 | Arrastrar sobre un vecino | ✅ Se permite superponer, no por lógica sino por UX: superpongo y luego ajusto. El fantasma no se detiene en el borde del vecino. |
| Q88 | Clic en un hueco menor a 1 h | ✅ El rango se encoge para caber en el hueco (mínimo 15 min). |
| Q89 | Mover y redimensionar | ✅ Igual que Q87: mover o redimensionar un Block puede superponerlo; no rebota ni se rechaza. |
| Q91 | Tocarse no es superponerse | ✅ Un Block que termina a las 09:00 y otro que empieza a las 09:00 no generan Warning. |
| Q92 | Servidor | ✅ El servidor acepta la superposición; la página Structure muestra un Warning. |
| Q93 | Superposiciones existentes | ✅ Sin migración: como se permiten, las que haya en Neon solo mostrarán su Warning. |

## Ronda 14 — Warning y resize (2026-10-31)

| # | Decisión | Estado |
|---|---|---|
| Q95 | Toggles con choque (reemplaza Q90) | ✅ El toggle de un día donde el rango choca sigue activo, con ⚠ y tooltip ("Overlaps Reading 08:00–08:30"). Si lo creo igual, la grilla muestra el Warning. |
| Q96 | Forma del Warning | ✅ Los Blocks superpuestos llevan borde ámbar y tooltip "⚠ Overlaps …"; arriba de la grilla una línea resume las superposiciones ("⚠ 2 overlaps: Mon 08:00 Reading / Deep work") y desaparece cuando no hay. |
| Q97 | Dibujo de superposiciones | ✅ Se mantienen los carriles lado a lado, para ver y agarrar ambos Blocks. |
| Q98 | Resize por ambos bordes | ✅ El borde superior también redimensiona, además del inferior. |
| Q99 | Dónde aplica el borde superior | ✅ En toda la grilla compartida (Structure, día y semana; Blocks y Slots). |
| Q100 | Calendario del día | ✅ Fuera de eso, sin cambios: conserva su formulario, sin drag-to-create ni Warning de superposición, hasta su propia ronda. |

## Ronda 15 — Editar un día en la Week (2026-11-02, festivo)

| # | Decisión | Estado |
|---|---|---|
| Q101 | Festivo | ✅ No existe "Holiday": un festivo es una fecha con Exceptions. Sin calendario de festivos precargado. En la Week cada Block lleva una × pequeña para quitarlo de esa fecha, y se puede arrastrar y reasignar. Solo en la Week. |
| Q102 | Usar los Blocks de otro día | ❌ Descartado. La idea de Ivan es la × y reasignar (Q101): Pareto, no la excepción. |
| Q103 | Gestos en la Week | ✅ Los de la Structure: dibujar en vacío abre el modal de Block types para esa fecha (sin toggles de días); un clic en un Block abre el mismo modal. |
| Q104 | iPhone y tablet | ✅ La Week sigue siendo de solo lectura en pantallas táctiles. Ivan trabaja ~90% desde el computador; el teléfono y la tablet son para leer. |
| Q105 | Day | ✅ El Day no edita los Blocks. La Structure define el default; la Week cambia los días que Ivan quiera. |
| Q106 | Slots | ✅ Un Slot se queda en su fecha y horario si una Exception quita o cambia el Block de debajo. |
| Q107 | Plan real | ✅ Las Exceptions son el plan del día: un Habit quitado no es fallo de Streak, y las horas de Container Blocks del Alignment salen de los Blocks con Exceptions. |
| Q108 | Reasignar | ✅ Es cambiar el Block type con un clic (modal). Arrastrar un Block es solo dentro de su día. |
| Q109 | Deshacer | ✅ La × aparece al pasar el mouse (como en los Slots) y no pide confirmación. Si la fecha tiene Exceptions, su encabezado en la Week muestra ↺, que devuelve todo el día a la Structure. |
| Q110 | Modal de la Week | ✅ Lista de Block types (el actual marcado) y "Back to Structure" si el Block tiene Exception. Sin "Skip this day"; horas de solo lectura. |
| Q111 | Días pasados | ✅ Solo hoy y los días futuros se editan; los pasados quedan de solo lectura para no reescribir el plan ya vivido. |
| Q112 | Superposición | ✅ Borde ámbar con tooltip, como en la Structure, sin la línea de resumen. |
| Q113 | Day | ✅ Se quita la sección "This day's Blocks" (skip today, reset, Add a Block for this day); queda un enlace "Change this day's Blocks in the Week". |
| Q114 | ADR 0002 | ✅ Nota con fecha: ~90% desde el computador. Planear desde la Structure es solo en el computador; en el iPhone, leer y quizá agendar trabajo. Optimizar el Pareto, no la excepción. |

## Resumen del diseño (v1) — ✅ confirmado 2026-10-30

**Qué es.** ivanandresdiaz.com: un solo usuario, interfaz toda en inglés. Ivan OS ejecuta; Obsidian sabe.

**Modelo.**
- Principles: lista ordenada de recordatorios, cada uno con MD opcional.
- Season (siempre una activa): título + MD + Season Goals + Radar.
- Quarter (trimestre calendario, MD sin versionar) → Campaign (3 meses, GPS, tipo de Block) → Move (cabe en una semana) → Task (opcional, se agenda en uno o varios días) → Step (checklist, no se agenda).
- Infinite Games: las 8 del manifiesto, fijas, como etiquetas múltiples; los Forks cuentan completo en cada juego. Backlog = Tasks sueltas + Campaigns candidatas.
- Habit = Habit Block de la Structure; se cumple o no, nunca se cronometra.

**Calendario.** Structure semanal de Blocks (Habit / Container) + Exceptions por fecha. Drag y resize. Vistas día y semana (mes después). Warnings no bloqueantes. Lo no hecho vuelve al stack como carried over ×N.

**Rituales.** Daily Note = Check-in (Principles, objetivos, 1–3 Highlights con why, Secondary Tasks con carry over y agenda opcional, eliminar, agendar) + Learning Log + Journal (plantilla de preguntas versionada; navegación entre días). Weekly Review el domingo o el lunes: Learning Log, lo que pasó, elegir Moves.

**Juego.** XP y nivel por Infinite Game, solo por inputs que son señal. Streaks con "never miss twice"; la principal es elegir el Highlight. Day Won → premio + sugerencias de los juegos con menos tiempo. Ambitious Mode sin XP extra. Cycles opcionales con presets y pantalla de foco.

**Alignment.** Horas planeadas en trabajo de Campaign que quedó hecho ÷ horas de Container Blocks, contrastado con un 1–10 sentido. El tiempo real de los Cycles es una métrica adicional.

**Técnico.** Una app Next.js (raíz pública mínima + OS privado); dominio en TS puro con Vitest; Postgres administrado + Drizzle; Vercel; login con Google restringido a la cuenta de Ivan; PWA instalable con notificaciones locales, sin offline; Claude API para el English Coach.

**Rebanadas.** 1 loop de la mañana · 2 Cycles + PWA · 3 Daily Note completa + Weekly Review · 4 XP/Streaks/Day Won/Ambitious · 5 Alignment + barras + Warnings · 6 Radar · 7 English Coach · 8 Roadmap · 9 Export IA.

**Rebanada 1.** Login · Principles · Season + Season Goals · Quarter + Campaigns · Moves/Tasks/Steps · Structure + Exceptions · calendario día/semana con drag/resize · Check-in con Highlights · marcar hecho · carried over. Seed: Season "Working in microfinance at El Alcaraván", Quarter oct–dic 2026, Campaign "Build Ivan OS", Structure del lunes.

## Parking lot (fuera del diseño inicial)

- Portafolio y "lo que quiero que la gente conozca de mí"
- Servicios
- Tracking de consumo de YouTube
- Agentes / API hacia otros proyectos
- Generador de cursos (Remotion + Claude + ElevenLabs)
- Frameworks de innovación dentro de la app (Design Thinking, Lean Startup)
- Sync con Obsidian, gráficas
- Formulario de contacto / mensajes en la raíz pública → inbox del OS
- English Coach que lee en voz alta (TTS); historial de errores de inglés
- Dictation en vivo: el texto aparece mientras hablo (hoy aparece al terminar)
- "Pill of the day" (modelos mentales de Obsidian en el check-in)

## Rebanada 1 — construida (2026-10-30)

Next.js 16 + Drizzle/Postgres + Auth.js (Google restringido a ALLOWED_EMAIL; login "dev" solo en local). Dominio puro en `src/domain/` con Vitest (24 tests). Rutas: `/os/day/[date]` (Check-in, Highlights, Eliminate, Blocks del día, calendario, Stack), `/os/week/[date]`, `/os/plan` (Season, Season Goals, Quarter, Campaigns, Backlog), `/os/campaigns/[id]` (GPS, Moves, Tasks, Steps), `/os/structure`, `/os/principles`.

Decisiones tomadas al construir (revisables):
- **Slot** y **Block type** entran al glosario.
- Mover un Block en el calendario de un día crea una Exception; moverlo en `/os/structure` cambia la Structure desde hoy (la fila vieja se cierra ayer).
- Una Task carried over que pertenece a un Move de esta semana se muestra con ×N dentro de "This week's Moves", no duplicada.
- Un Highlight enlazado a una Task o Move se marca hecho cuando esa Task/Move se marca hecha (y al revés).
- Todo se ajusta a 15 minutos.

## Rebanada 2 — construida (2026-10-30): Cycles + PWA

- **Cycles:** presets editables (Deep work 90+15, Steady 50+10, Pomodoro 25+5; el primero es el predeterminado) en `/os/cycles`, con el historial de 7 días. ▶ en cada Slot del calendario y en cada ítem del Stack arranca un Cycle con el preset predeterminado; `/os/focus` permite elegir preset y trabajo, o un Cycle libre con etiqueta.
- **Pantalla de foco:** respiración de 6 s al entrar (se salta con clic), cuenta regresiva grande con anillo, Steps de la Task, marcar hecha, cerrar el Cycle en cualquier momento; luego el descanso y "Next Cycle". El título de la pestaña muestra el tiempo.
- **Plan vs realidad, por separado:** el foco real aparece como una barra fina a la izquierda de la columna del calendario; la tarjeta Reality del día muestra el foco real y cuántos Cycles quedaron completos; "+12m" = empezó 12 min después del Slot planeado.
- **Insignia en el encabezado** con el Cycle en curso (foco o descanso), visible en todo el OS.
- **PWA:** manifest, íconos, service worker sin offline, notificaciones locales al terminar el foco y el descanso (más un sonido suave). Instalable desde el navegador.

Decisiones tomadas al construir (revisables):
- Solo un Cycle a la vez: empezar otro cierra el anterior.
- Las notificaciones salen de la página abierta (no hay servidor de push). Con la pestaña en segundo plano el navegador puede retrasarlas hasta ~1 min.
- Un Cycle sin Task/Move es "libre" con etiqueta; la XP (rebanada 4) decidirá si cuenta.

## Correcciones del Check-in — construidas en local (2026-10-31)

- **Eliminate:** placeholder en inglés: “Low ROI. Doesn’t move the needle. Pulls me away from my goals. Irrelevant.”
- **Secondary Tasks:** sección entre Highlights y Eliminate, quick-add por título, checkbox sin agenda obligatoria, delete y drag al calendario con 30 min iniciales y resize.
- **Carry over:** la misma Secondary Task vuelve cada día con ×N, sin copias, hasta completarla o eliminarla. Si estaba agendada, su Slot pasado queda como historial y vuelve al Check-in sin horario.
- Completada queda visible el día en que se completó. Orden: carried over pendientes → nuevas pendientes → completadas.
- Sin Cycles, XP, Alignment, Day Won, Highlights, Infinite Games, Backlog ni jerarquía estratégica. Noise quedó redefinido como lo que se decide eliminar, no simplemente lo no alineado.
- Migraciones `0002` y `0003` aplicadas en Postgres local. Verificación: 39 tests, typecheck, lint y build de producción. Pendiente aplicar migraciones en Neon y desplegar.

## Eliminate como Noise items — construido en local (2026-10-31)

- Tabla `noise_items` (fecha + texto). El textarea y la columna `daily_notes.eliminate` desaparecen.
- Sección **Eliminate (the noise for today)**: los cuatro criterios en una línea tenue, los Noise items del día con × para borrar, y "+ Add noise", que abre el input ("What noise do I eliminate today?"). El input queda abierto para agregar varios; Escape o "Done" lo cierran.
- Migración `0004_noise_items`: cada línea no vacía del Eliminate guardado pasa a ser un Noise item de su fecha, en el mismo orden y sin viñetas (`-`, `*`, `•`); luego se elimina la columna. Probada en local ("facebook" del 2026-10-31 quedó como Noise item).
- Verificación: 39 tests, typecheck, lint, build de producción y prueba en el navegador (agregar, borrar, el día siguiente vacío). Pendiente aplicar `0002`–`0004` en Neon y desplegar.

## Editar un día en la Week — construido en local (2026-11-02)

- **Week, solo con mouse y solo hoy o días futuros:** clic en un Block abre el modal (Block types y "Back to Structure" si tiene Exception); dibujar en vacío agrega un Block a esa fecha; × al pasar el mouse lo quita; arrastrar y redimensionar dentro del día; ↺ en el encabezado devuelve el día a la Structure; superposición con borde ámbar y tooltip.
- **Solo lectura:** días pasados, pantallas táctiles y el Day. El Day perdió "This day's Blocks"; queda el enlace "Change this day's Blocks in the Week".
- **Dominio:** `isDayEditable` y `planDayBlockChange` en `src/domain/structure.ts`. Acciones `changeDayBlock`, `addDayBlock` y `backToStructure` (rechazan fechas pasadas); se fueron `setException`, `updateExceptionTimes`, `setExceptionForm` y `deleteException`. El modal comparte `BlockDialog` y `BlockTypeChoices` con la Structure.
- Sin migraciones. Verificación: 76 tests, typecheck, lint y prueba en el navegador (reasignar, ×, dibujar, mover, superposición, Back to Structure, ↺, pasado y táctil en solo lectura, Day y Structure); la base local quedó sin filas de prueba.

## Despliegue (2026-10-30)

Ivan desplegó en **Vercel** con **Postgres en Neon** (migraciones aplicadas allí) y login de **Google** (OAuth client en el proyecto de Firebase/Google Cloud; redirect `/api/auth/callback/google`). El código vive en GitHub (`ivanandresdiaz/ivanandresdiaz_os`). Variables en Vercel: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL`, `APP_TIMEZONE`.
