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

## Ronda 16 — Agendar a futuro (2026-11-02)

Origen: mañana a las 9:00, reunión con el jefe para instalar Claude Work. Ya se podía agendar desde el Day de mañana (una Secondary Task toma la fecha del Day donde se escribe).

| # | Decisión | Estado |
|---|---|---|
| Q115 | Reuniones | ✅ No hay Meeting, Event ni Appointment. Una reunión o cita es una Task si sirve a una Campaign, o una Secondary Task con su Slot si no: "las agendas normalmente no responden a un Alignment". |
| Q116 | El día de una Secondary Task | ✅ Aparece en el Check-in desde su día, nunca antes, y el ×N cuenta desde ahí. Se crea en el Day de esa fecha, como ya funciona; sin campo de fecha en el quick-add. |
| Q117 | Posponer y adelantar | ✅ Agendarla en un día futuro la pasa a ese día, "como si la Secondary no hubiera existido" antes. Agendarla hoy la trae a hoy si su día no había llegado; una arrastrada que se agenda hoy conserva su ×N. |
| Q118 | Cumpleaños | ⏸ Pendiente, para más adelante (el cumpleaños es de la Person). |
| Q119 | Antes de su día | ✅ Sin lista "Upcoming" en el Check-in: sería ruido todos los días. Mirar hacia adelante es trabajo de la vista Month. |
| Q120 | Recordatorio | ✅ Sin recordatorio por ahora. → Revisada en Q196: Reminder opcional en el Slot. |
| Q121 | Google Calendar | ❌ No. Sin sincronización. → Revisada en Q187: solo los Slots con campanita, en una sola vía. |

## Ronda 17 — La vista Month (2026-11-02)

Origen: Ivan quiere agendar cosas en los próximos 3 meses sin avanzar día por día.

| # | Decisión | Estado |
|---|---|---|
| Q122 | Vista, no nivel | ✅ El Month es una vista del calendario como el Day y la Week: sin metas, texto ni review del mes. Sigue sin haber nivel Mes en el plan. |
| Q123 | Qué muestra | ✅ Solo lo agendado: Slots de Tasks, Moves y Secondary Tasks con su hora, y las Secondary Tasks del día sin Slot. Sin Blocks, Exceptions, Habits, Highlights ni Cycles. Una pendiente aparece solo en su día; una hecha, tachada en el día en que se hizo. Días pasados en solo lectura. |
| Q124 | Crear | ✅ El Month solo mira y navega: un clic en un día abre su Day, donde se agrega y se arrastra como ya funciona. |
| Q125 | Navegación | ✅ `/os/month/YYYY-MM`, ← →, "This month", semanas de lunes a domingo, días de otros meses tenues. Botón "Month" junto a "Week" en el Day y la Week; no entra a la barra de navegación. En el teléfono, la misma cuadrícula con el texto recortado. |
| Q126 | Posponer una arrastrada | ✅ Desaparece de los Check-ins y del Month en sus días anteriores, como si no hubiera existido; sus Slots pasados quedan como historial. |

## Ronda 18 — El Plan en columnas (2026-11-02)

Origen: la página Plan es larga y obliga a hacer scroll (el texto de la Season, entero y siempre abierto, ocupa casi todo). Ivan quiere una vista tipo carpetas.

| # | Decisión | Estado |
|---|---|---|
| Q127 | Tres columnas | ✅ Seasons · Quarters · Campaigns llenan la pantalla. Cada columna tiene su propio scroll y la página no hace scroll. Elegir algo en una columna llena la siguiente. Es una forma de mirar el Plan: el modelo no cambia. |
| Q128 | Columna Seasons | ✅ Todas: la activa arriba y las cerradas debajo, de la más nueva a la más vieja. Cada una muestra su título, sus fechas y sus Season Goals siempre a la vista; el texto va plegado. "+ New Season" arriba, con aviso de que cierra la actual. Las cerradas se leen y se editan, pero no se reabren. |
| Q129 | Editar | ✅ En drawers ("amo los drawers"): título, texto con Dictate y Coach, y Save. En la Season, también las Season Goals. → Q139. |
| Q130 | Quarters de una Season | ✅ (afinado en Q140) Los Quarters que la Season toca, desde su inicio hasta su fin (o hasta hoy). Un Quarter partido aparece bajo las dos Seasons con las mismas Campaigns. "Mostrar arriba siempre el más reciente" → Q140. |
| Q131 | Un Quarter | ✅ Muestra su nombre, sus fechas y su título; el texto va plegado. Uno que aún no existe se crea solo al escribirle un título o al agregarle la primera Campaign. |
| Q132 | Prioridad | ✅ Las Campaigns del Quarter se reordenan arrastrando del ⠿. Ese orden es su prioridad, se ve igual en el Plan y en el Check-in y no sigue el orden de los Season Goals. Una nueva, o una candidata que se activa, entra de última. |
| Q133 | Stack | ✅ El "This week" del Stack sigue la prioridad de las Campaigns. |
| Q134 | Cerradas | ✅ Activas arriba en su orden; done y dropped debajo, tenues y sin arrastre. Reactivar una la devuelve de última entre las activas. |
| Q135 | Tarjeta | ✅ Número de prioridad, título, Season Goal, Block (color), línea del Goal e Infinite Games. Un clic abre la página de la Campaign; no hay cuarta columna. |
| Q136 | Crear Campaign | ✅ "+ New Campaign" pide solo el título y abre la página de la Campaign para escribir el GPS y elegir Season Goal, Block e Infinite Games. |
| Q137 | Backlog | ✅ Una carpeta "Backlog" fija al final de la columna Quarters: candidatas (ordenables por prioridad) y Loose Tasks. |
| Q138 | Teléfono | ✅ B: una columna a la vez con flecha de atrás, como la app Archivos. → Q141. |
| Q139 | Leer en el drawer | ✅ La columna muestra el título, las fechas y las Season Goals, sin texto desplegable. "Read" abre el drawer con el texto formateado y ancho; ahí mismo "Edit" pasa a edición, como en los Principles. Igual para la Season y el Quarter. |
| Q140 | El más reciente arriba | ✅ Orden estricto por fecha, el más nuevo arriba. El siguiente Quarter entra a la lista cuando existe (con título o una Campaign); mientras no exista, arriba hay un botón "+ Plan Q1 2027". Al entrar queda seleccionado el Quarter actual. Los Quarters pasados que nunca se crearon no aparecen. |
| Q141 | Teléfono | ✅ Abre en las Campaigns del Quarter actual. "‹ Q4 2026" lleva a los Quarters y "‹ Faithful to me" a las Seasons. El Backlog está en la columna Quarters. Los drawers ocupan toda la pantalla y el ⠿ funciona al tacto. |

## Resumen del diseño (v1) — ✅ confirmado 2026-10-30

**Qué es.** ivanandresdiaz.com: un solo usuario, interfaz toda en inglés. Ivan OS ejecuta; Obsidian sabe.

**Modelo.**
- Principles: lista ordenada de recordatorios, cada uno con MD opcional.
- Season (siempre una activa): título + MD + Season Goals + Radar.
- Quarter (trimestre calendario, MD sin versionar) → Campaign (3 meses, GPS, tipo de Block) → Move (cabe en una semana) → Task (opcional, se agenda en uno o varios días) → Step (checklist, no se agenda).
- Infinite Games: las 8 del manifiesto, fijas, como etiquetas múltiples; los Forks cuentan completo en cada juego. Backlog = Tasks sueltas + Campaigns candidatas.
- Habit = Habit Block de la Structure; se cumple o no, nunca se cronometra.

**Calendario.** Structure semanal de Blocks (Habit / Container) + Exceptions por fecha. Drag y resize. Vistas día, semana y mes (el mes solo mira lo agendado y navega; construido el 2026-11-02). Warnings no bloqueantes. Lo no hecho vuelve al stack como carried over ×N.

**Rituales.** Daily Note = Check-in (Principles, objetivos, 1–3 Highlights con why, Secondary Tasks con carry over y agenda opcional, eliminar, agendar) + Learning Log + Journal (texto libre, sin plantilla, ver Q232; navegación entre días). Weekly Review el domingo o el lunes: Learning Log, lo que pasó, elegir Moves.

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
- Learning Path (nombre de trabajo; no es el Roadmap, que es la vista del Quarter): "quiero aprender LangGraph" con un camino para ir clicando. Recibe Clips, también los que son solo enlace (2026-11-07)

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

## Agendar a futuro y vista Month — construido en local (2026-11-02)

- **El día de una Secondary Task:** el campo `createdOn` pasa a llamarse `day` (la columna sigue siendo `created_on`, sin migración). `dayAfterScheduling` en `src/domain/secondary-tasks.ts`: agendarla en un día futuro la pospone allí, agendarla hoy la adelanta si su día no había llegado, una arrastrada agendada hoy conserva su ×N y un Slot en un día pasado no cambia nada. `scheduleWork` y `updateSlot` lo aplican a las pendientes (soltar en el calendario y mover el Slot en la Week).
- **Month:** `/os/month/YYYY-MM` (y `/os/month` lleva al mes actual). Semanas de lunes a domingo, ← →, "This month", días de otros meses tenues, hoy resaltado; cada día es un enlace a su Day. `getMonth` trae solo lo agendado: Slots con su hora y las Secondary Tasks del día sin Slot (`secondaryTaskDate`: pendiente en su día, hecha en el día en que se hizo, tachada). En el teléfono se oculta la hora para que se lea el título. Botón "Month view" en el Day y la Week; en la navegación, Month marca "Week".
- Sin migraciones. Verificación: 84 tests, typecheck, lint y prueba en el navegador (agendar mañana a las 9:00, mover el Slot martes → jueves y jueves → hoy, posponer una arrastrada, conservar ×N al agendarla hoy, Month con pendientes, hechas y sin hora, navegación, clic a un Day, 404 con un mes inválido, ancho de teléfono); la base local quedó sin filas de prueba.

## Ronda 19 — La Campaign dentro del Plan (2026-11-02)

Origen: al dar clic en una Campaign, Ivan iba a otra página y perdía la visión: "no quiero ir a otra página porque pierdo la visión, el GRAN STRATEGY de mi juego". Esta ronda cambia Q135.

| # | Decisión | Estado |
|---|---|---|
| Q142 | La Campaign en el Plan | ✅ Un clic abre una cuarta columna con todo lo de su página, y la página aparte desaparece. Los enlaces del Check-in abren el Plan con la Campaign abierta; una Campaign nueva o una candidata se abren igual. |
| Q143 | Colapso automático | ✅ (afinado en Q149) "Por defecto se comporta como que tiene 3 columnas abiertas"; Quarter queda abierto al abrir la Campaign, y al abrir un Move se cierra Quarters. Ivan puede colapsarlas todas, horizontalmente. → Q149–Q152. |
| Q144 | Franjas con la cadena | 🔁 → Q151. |
| Q145 | Colapsar a mano | ✅ (afinado en Q152) "Puedo colapsarlas todas". |
| Q146 | Columna de la Campaign | ✅ Arriba, la prioridad, el título y el GPS recortado a dos líneas. "Read" abre un drawer con el GPS, Season Goal, Block, Infinite Games y las acciones de estado y borrar. Debajo, los Moves. (Dónde van sus Tasks y Steps → Q150.) |
| Q147 | Teléfono | ✅ Un nivel más en la navegación de una columna a la vez: "‹ Build Ivan OS" vuelve a las Campaigns. Sin franjas. |
| Q148 | Alignment | ✅ Sigue siendo solo la medida del tiempo. Ver la línea Season → Quarter → Campaign → Moves es una forma de mirar el Plan, no un concepto nuevo. |
| Q149 | Tres columnas abiertas | ✅ Por defecto hay tres columnas abiertas: al bajar un nivel, la de más arriba se colapsa; al subir, vuelve a abrirse. Al abrir una Campaign: Quarters, Campaigns y la Campaign. Ivan igual puede cerrarlas "para ver más espacio". |
| Q150 | El Move en su columna | ✅ La Campaign lista sus Moves de forma compacta (título, semana, hecho, "2/5 Tasks", "New Move"). Abrir un Move muestra en su columna sus Tasks con duración y sus Steps. En el teléfono, "‹ SSO login" vuelve a la Campaign. |
| Q151 | La cadena | ❌ Los títulos largos no caben en una franja vertical. Se pensó en un breadcrumb (Q153–Q154), pero cayó con Q159. |
| Q152 | Colapsar a mano | ✅ Un « en cada columna abierta. "Collapse all" deja solo la más profunda, que nunca se colapsa. Lo colapsado se guarda en el enlace, y al bajar o subir de nivel vuelve la regla de las tres columnas. |

## Ronda 20 — Una columna de estrategia (2026-11-02)

Origen: idea de último momento de Ivan. "Seasons realmente no es una info que constantemente esté cambiando": Seasons, Quarters y Campaigns pasan a una sola columna que se pliega hacia abajo, y por defecto queda elegido todo hasta el trabajo de mayor prioridad, "así puedo ver todo de una vez". Esto reemplaza las columnas de Q127 y la regla de Q149.

| # | Decisión | Estado |
|---|---|---|
| Q153–Q154 | Breadcrumb | ❌ Propuesto por Ivan y luego descartado en Q159. |
| Q155 | Tres columnas: Estrategia, Campaign y Move | ✅ La columna de estrategia tiene secciones plegables: Season, Quarter, Campaigns y Backlog. Por defecto las tres columnas están abiertas, y cada una se puede colapsar hacia el lado (Q152). |
| Q156 | Las secciones | ✅ Season va plegada: título, Season Goals numeradas y "Read"; abierta, muestra todas las Seasons y "+ New Season". Quarter va plegada: "Q4 2026 · título" y "Read"; abierta, muestra los Quarters de la Season y "+ Plan Q1 2027". Campaigns va abierta: la lista por prioridad, las cerradas debajo y "+ New Campaign". Backlog va plegada: candidatas ordenables y Loose Tasks. Pueden abrirse varias a la vez. |
| Q157 | Lo elegido al entrar | ✅ La Season activa, el Quarter actual (aunque exista el siguiente, como en Q140), la Campaign #1 no hecha y su primer Move. |
| Q158 | Prioridad de los Moves | ✅ "La tarea con mayor prioridad" es un Move. Los Moves de una Campaign se ordenan con el ⠿; se abre el primero no hecho y su columna muestra sus Tasks. Dentro de una Campaign, el Stack sigue ese orden. Las Tasks mantienen su orden, sin arrastre. |
| Q159 | Breadcrumb | ❌ "Con este nuevo diseño, siento que el breadcrumb puede esperar". No queda pendiente: Ivan avisará si lo necesita. |
| Q160 | Teléfono | ✅ Una columna a la vez: Estrategia → Campaign → Move. Abre en la de estrategia, y tocar una Campaign o un Move abre su columna. Sin breadcrumb (Q159), cada columna conserva su "‹" para volver. |

## El Plan en columnas — construido en local (2026-11-02)

- **Dominio:** `src/domain/plan.ts`. `seasonQuarters` lista los Quarters de una Season, del más nuevo al más viejo: los que existen dentro de sus fechas, el actual mientras la Season está activa y el elegido aunque todavía no exista. `landingQuarter` decide dónde abre el Plan y `quarterToPlan` ofrece "+ Plan" para el siguiente Quarter. `byPriority` separa las Campaigns abiertas de las cerradas, e `inCampaignPriority` ordena el "This week" del Stack según la prioridad de su Campaign.
- **Página:** `/os/plan?season=…&q=2026-Q4|backlog&col=…`. En el computador muestra las tres columnas, cada una con su propio scroll. En el teléfono muestra una a la vez: `col` dice cuál, y por defecto abre en Campaigns. Los drawers de la Season y del Quarter (`plan-drawers.tsx`) tienen Preview y Edit, como el de los Principles; en el de la Season también se editan las Season Goals. Las Campaigns se reordenan arrastrando del ⠿ (`campaign-priority.tsx`, dnd-kit).
- **Acciones:** `createCampaign` pide solo el título, crea el Quarter si falta y pone la Campaign de última. Las acciones nuevas son `reorderCampaigns` y `setCampaignStatus`: activar o reactivar una Campaign la pone de última, y la activación desde la página de la Campaign crea el Quarter actual si no existe. El "← Plan" de esa página vuelve a su Quarter o al Backlog.
- Sin migraciones: el campo `campaigns.position` ya existía. Verificación: 94 tests, typecheck, lint y prueba en el navegador. Se probaron la vista sin scroll de página, el drawer de la Season (leer, editar el título, agregar y borrar una Season Goal), crear Campaigns, reordenar y recargar, el Stack y el Check-in en orden de prioridad, done debajo y reactivada de última, una candidata activada de última, "+ Plan Q1 2027" con título y texto, el Quarter actual seleccionado con Q1 2027 encima, la Season cerrada con Q4 2026 partido, el teléfono (una columna, flechas atrás, drawer a pantalla completa) y la consola sin errores. La base local quedó sin filas de prueba.

## Ronda 21 — ¿El Quarter es hijo de la Season? (2026-11-02)

Origen: Ivan notó que el Quarter no quedaba dentro del colapso de la Season: "creí que los Quarters eran hijos de las Seasons". Su modelo mental del 2026-10-29 lo ponía así ("Temporada └── Capítulo — 3 meses"), pero el glosario lo definió como trimestre del calendario.

| # | Decisión | Estado |
|---|---|---|
| Q161 | El Quarter es del calendario | ✅ No le pertenece a una Season: la Season lo atraviesa, y un Quarter partido (Q4 2026) sigue siendo uno solo. En palabras de Ivan: un cambio de Season "no cambiará la agenda de un momento para otro… un cambio abrupto de las metas no me sirve". |
| Q162 | La pantalla muestra el árbol | ✅ En la columna de estrategia, lo elegido va con sangría: Season ▸ Quarter ▸ Campaigns. "All Seasons" es un solo árbol: cada Season se despliega con sus Quarters, y un Quarter partido aparece bajo las dos marcado "split". Campaigns va abierto por defecto y All Seasons cerrado. |

## Estrategia, Campaign y Move en el Plan — construido en local (2026-11-02)

- **Tres columnas:** Estrategia, Campaign y Move. La de estrategia tiene la Season y el Quarter elegidos, cada uno con "Read" y su lista "All…" desplegable; luego Campaigns, abierta, y Backlog, que se abre solo cuando la Campaign elegida es una candidata. La página `/os/campaigns/[id]` ya no existe: es una redirección a `/os/plan?campaign=…`, y el Check-in enlaza directo al Plan.
- **Qué se abre:** el Plan lee `season`, `q`, `campaign`, `move`, `col` (la columna que se ve en el teléfono) y `fold` (las columnas colapsadas). Sin parámetros abre la Season activa, el Quarter actual, la Campaign #1 no hecha y su primer Move no hecho (`firstOpen`). Una Campaign abierta desde afuera trae su Quarter.
- **Prioridad de los Moves:** se ordenan con el ⠿ (`reorderMoves`). `PriorityList` y `ClosedList` (`priority-list.tsx`) son la lista reordenable que comparten Campaigns y Moves; los Moves hechos van debajo. `createMove` pone el nuevo de último. El Stack usa `inPriority`, que ordena por Campaign y después por Move.
- **Drawers:** `plan-drawers.tsx` comparte `DrawerFrame`, `useEditMode` y `SaveForm`. `campaign-drawer.tsx` muestra el GPS y permite editarlo (con Dictate y Coach), además de Season Goal, Block, Infinite Games, el estado y borrar. El selector de Season Goal incluye la Goal que la Campaign ya sirve aunque sea de una Season cerrada, para no borrarla al guardar.
- **Colapsar:** el « de cada columna y "Collapse all"/"Expand all" en la del Move. Una columna colapsada queda como una franja con "»" y su nombre en vertical.
- Sin migraciones: `moves.position` ya existía. Verificación: 95 tests, typecheck, lint y prueba en el navegador. Se probaron:
  - abrir con todo elegido, crear una Campaign y que se abra en su columna, Moves nuevos de últimos, reordenar Moves con el teclado y recargar, y que el Move abierto por defecto sea el #1;
  - el Stack ordenado por prioridad de Move, el Check-in enlazando al Plan, la redirección de la dirección vieja con su Quarter, y una Task con su Step y su conteo;
  - un Move hecho debajo, editar el GPS, el Block y los Infinite Games en el drawer, colapsar Estrategia, "Collapse all" y "Expand all", una candidata abierta como #1 con el Backlog desplegado, y borrar una Campaign desde el drawer;
  - el teléfono (Estrategia → Campaign → Move con "‹"), que la página no hace scroll y la consola sin errores.
  La base local quedó sin filas de prueba.

## Ronda 22 — La candidata no toca la semana (2026-11-02)

Origen: Ivan preguntó cómo funcionaba el Backlog. Al revisarlo apareció un hueco: el Stack tomaba los Moves por su semana sin mirar si la Campaign era candidata, y el formulario de nuevo Move traía "This week" por defecto. Una idea de "algún día" podía meterse en la semana.

| # | Decisión | Estado |
|---|---|---|
| Q163 | La candidata no toca la semana | ✅ Una candidata es solo una idea. Sus Moves no tienen semana, el formulario no la ofrece y la columna del Move dice que se elige al activarla. A la semana (el Stack) solo llega el trabajo suelto y el de Campaigns activas; lo de una Campaign hecha o descartada tampoco. Al activar una candidata, sus Moves quedan sin semana y se eligen en la Weekly Review. |
| Q164 | Activar a la vista | ✅ Una candidata muestra en la columna Campaign un botón primario "Activate", que la lleva al Quarter actual de última en la prioridad. Antes solo estaba dentro del drawer. Pide confirmación: abre una tarjeta "Play … in Q4 2026?" con Cancel y Activate; Escape o un clic afuera la cierran. |

## Ronda 23 — La Task suelta agendada sale del Stack (2026-11-02)

Origen: Ivan agendó una Task suelta para dentro de dos meses y le seguía apareciendo en el Stack de hoy: "me hace ruido tenerla ahí". El Stack mostraba toda Task suelta sin hacer, agendada o no. Además, una Task suelta que se quedaba sin hacer aparecía dos veces: en Carried over y en Loose Tasks.

| # | Decisión | Estado |
|---|---|---|
| Q165 | La Task suelta agendada sale del Stack | ✅ En Loose Tasks del Stack solo está la Task suelta que nunca se ha agendado. Agendada, para hoy o para cualquier fecha, vive en el calendario. Si se queda sin hacer, vuelve una sola vez, en Carried over. Los Moves de la semana no cambian: siguen en el Stack con su "on Wed 10:00". |
| Q166 | Lo agendado hoy se puede elegir | ✅ El Highlight y el Cycle eligen entre el trabajo del Stack y las Tasks sueltas agendadas ese día. Una agendada para otra fecha no se ofrece. |

## Ronda 24 — Los Principles del Check-in, cerrados (2026-11-02)

Origen: el Check-in mostraba los Principles abiertos desde la mejora de los Principles (drawer y References, 2026-10-31). Ivan quiere volver al original: cerrados por defecto, y abiertos solo cuando él quiera.

| # | Decisión | Estado |
|---|---|---|
| Q167 | Cerrados por defecto | ✅ Los Principles del Check-in arrancan cerrados. El título "Principles" los abre y los cierra, sin un botón extra. Lo demás no cambia: el título de cada uno abre su drawer y muestra cuántas References tiene. No son un paso del ritual: están a mano para leerlos. |
| Q168 | Recuerda la última elección | ✅ Si Ivan los abre, quedan abiertos la próxima vez, y cerrados si los cierra. Es algo sencillo: lo recuerda cada navegador (localStorage), así que el teléfono y el portátil llevan cada uno la suya. |

## Ronda 25 — Upkeep: lo recurrente que es responsabilidad (2026-11-02)

Origen: Ivan no lleva el control de cuándo cambiarle el aceite a la moto (cada 3 meses para su uso). Quiere algo recurrente que no es estrategia pero sí responsabilidad: al hacerlo se programa el siguiente, y si no se atiende se arrastra.

| # | Decisión | Estado |
|---|---|---|
| Q169 | "Tareas perdidas" | ✅ Son las Tasks sueltas del Backlog. No se introduce "someday". |
| Q170 | Se ve con antelación | ✅ Ivan quiere verla días antes en el Month; no puede nacer el mismo día en que toca. |
| Q171 | La cuenta arranca al hacerla | ✅ La siguiente se cuenta desde el día en que se marca hecha, no desde el día en que tocaba. Al marcarla, un modal confirma y muestra que la próxima queda en X días; X se puede corregir ahí. |
| Q172 | Fecha al crearla | ✅ Al crearla se elige la fecha. Después se puede mover arrastrándola a otro día en el Month (p. ej. de un martes al sábado). |
| Q173 | Una ocurrencia viva | ✅ Lo que se repite es la regla; cada vez que toca es una Secondary Task normal con su día. Siempre hay una sola pendiente por regla: nace al crear la regla o al marcar hecha la anterior, así que se ve en el Month desde ese momento. |
| Q174 | Nombre | ✅ **Upkeep**. _Evitar_: Recurring Task (choca con Task, que es estratégica), Chore. |
| Q175 | El X del modal | ✅ Corregir los días en el modal cambia el intervalo del Upkeep: vale para la próxima y para todas las que siguen. |
| Q176 | Unidad | ✅ Solo días, para que sea flexible. |
| Q177 | Arrastrar en el Month (revisa Q124) | ✅ En el Month se arrastran a otro día las Secondary Tasks pendientes, incluidas las ocurrencias de un Upkeep; si tienen Slot, conservan su hora. Solo hacia hoy o el futuro: el plan de un día vivido no se reescribe. Ver Q186. |
| Q178 | Dónde viven | ✅ Un botón "Upkeeps" en el encabezado del Month abre un drawer con la lista: título, "every N days", el próximo y la última vez. Arriba, un + para crear uno con título, primera fecha (por defecto hoy) e intervalo. |
| Q179 | Borrar una ocurrencia | ✅ La × pregunta "Stop this Upkeep?"; al confirmar, el Upkeep se detiene y su ocurrencia pendiente desaparece. No hay Skip: postergar es arrastrar, hacerla es marcarla. También se detiene desde el drawer. |
| Q180 | Desmarcar | ✅ Reabre la ocurrencia y borra la siguiente que nació de ella. El intervalo queda como se dejó en el modal. |
| Q181 | Cambiar el intervalo en el drawer | ✅ La ocurrencia ya pendiente no se mueve; el nuevo intervalo cuenta desde la próxima vez que se marque. Para moverla, se arrastra. |
| Q182 | Cómo se ve | ✅ Un ↻ pequeño junto al título, sin color. Tocarlo abre ese Upkeep en el drawer. |
| Q183 | El drawer | ✅ Ordenado por el próximo, el que toca antes primero. Un Upkeep detenido desaparece, sin archivo. Ahí se renombra, se cambia el intervalo y se detiene; la fecha de la ocurrencia pendiente se cambia arrastrándola en el Month. |
| Q184 | El Month no marca | ✅ El Month mira, navega y arrastra; no marca hecho. Se marca en el Check-in y en el calendario del Day o la Week, donde sale el modal del Upkeep. |
| Q185 | Cancelar el modal | ✅ Cancel o Escape la dejan sin marcar. Solo "Done" la completa y crea la siguiente. |
| Q186 | La estrategia no se mueve en el Month | ✅ Las Tasks y los Moves no se arrastran en el Month: se acomodan en el Day y la Week, donde se ven los Blocks. En el Month solo se mueve lo que no es estrategia. |

## Upkeep y arrastrar en el Month — construido en local (2026-11-02)

- **Modelo:** tabla `upkeeps` (título, `interval_days`) y `secondary_tasks.upkeep_id` (al detener el Upkeep, las hechas quedan como Secondary Tasks sueltas). Migración `drizzle/0009_upkeeps.sql`, aplicada en local; **falta aplicarla en Neon**.
- **Dominio:** `src/domain/upkeeps.ts`: la siguiente se cuenta desde el día en que se marca, el intervalo va en días con meses como pista, y `monthMove` decide qué pasa al soltar en el Month.
- **Marcar:** en el Check-in y en el Slot del calendario, una ocurrencia abre el modal "Done — Next in [N] days → fecha". Cambiar N cambia el intervalo del Upkeep. Cancel o Escape la dejan sin marcar; desmarcar borra la siguiente.
- **↻:** en el Check-in y en el calendario lleva a `/os/month/YYYY-MM?upkeep=<id>`, que abre el drawer sobre ese Upkeep. En el Month abre el drawer ahí mismo, salvo en el teléfono, donde gana el título.
- **Drawer "↻ Upkeeps":** en el encabezado del Month. Crear (título, primera fecha, cada N días, 90 por defecto), editar con ✎ (Save solo si algo cambió) y detener con confirmación.
- **Month:** con dnd-kit (ADR 0002) se arrastran las Secondary Tasks pendientes, solo a hoy o al futuro. Un Slot desde hoy conserva su hora; uno pasado queda como historial y solo se mueve el día. Las Tasks y los Moves no se mueven ahí.
- Verificación: 105 tests, typecheck, lint y prueba en el navegador (crear, arrastrar jueves → sábado, rechazar un día pasado, traerla a hoy, modal con 90 → 100, Escape, desmarcar, agendar y marcar desde el Slot, ↻ desde el Check-in y desde el Month, editar el intervalo sin mover la pendiente, detener desde la ×, ancho de teléfono). La base local quedó sin filas de prueba.

## Ronda 26 — Reminders: avisos a la hora de algunas tareas (2026-11-02)

Origen: Ivan quiere un aviso a la hora de algunas tareas, no de todas (p. ej. "mañana me reúno con mi jefe"). Usa la PWA desde el iPhone, donde las notificaciones locales no llegan con la app cerrada. Se compararon Web Push (necesita un servidor que despierte a la hora exacta; Vercel Cron en Hobby corre una vez al día), ntfy o Pushover, Telegram, un feed .ics suscrito y WhatsApp vía Compuzuly. Google Calendar gana porque Google se encarga de avisar a tiempo: Ivan OS solo escribe el evento.

| # | Decisión | Estado |
|---|---|---|
| Q187 | Canal (revisa Q121) | ✅ Google Calendar, en una sola vía: Ivan OS → Google. Telegram queda como plan B sin construir; WhatsApp descartado. |
| Q188 | Qué se sincroniza | ✅ Solo los Slots con campanita. Los demás se quedan solo en Ivan OS. |
| Q189 | Nombre y alcance | ✅ **Reminder**, opcional en el Slot y activado con la campanita. Vale para cualquier Slot: Task, Move o Secondary Task (también la ocurrencia agendada de un Upkeep). Sin Slot no hay hora y no hay Reminder. _Evitar_: Alert, Notification. |
| Q190 | Cuándo | ✅ Un Reminder por Slot, 10 min antes por defecto ("me encanta"). Opciones: a la hora, 5, 10, 15, 30 o 60 min antes. |
| Q191 | Sigue al Slot | ✅ Mover el Slot o cambiar su duración actualiza el evento. Marcarlo hecho, quitarle la campanita o borrar el Slot elimina el evento de Google. |
| Q192 | Ivan OS manda | ✅ Lo que se edite o borre en Google se ignora y se reescribe cuando el Slot vuelva a cambiar. |
| Q193 | Dónde | ✅ Un calendario aparte llamado "Ivan OS" en la cuenta de Google de Ivan; cada evento lleva el enlace al Day. |
| Q194 | Qué app avisa | ✅ La app de Google Calendar en el iPhone (Ivan ya activó sus notificaciones). |
| Q195 | Cycles | ✅ Fuera. Solo avisan los Slots con campanita. |
| Q196 | Q120 | ✅ "Sin recordatorio por ahora" queda reemplazada por el Reminder. |
| Q197 | Conectar | ✅ Google Calendar se conecta aparte del login, con "Connect Google Calendar", la primera vez que se toca una campanita sin conexión. El permiso de eventos se pide una vez y el acceso queda en el servidor. Ivan pasa la app de OAuth de *Testing* a *In production* para que el acceso no caduque cada 7 días. |
| Q198 | Dónde está la campanita | ✅ Se pone y se quita en el Slot del calendario del Day y la Week. Al tocarla abre un menú: Off, At start, 5, 10 ✓, 15, 30, 60 min before; al activarla queda en 10. En el Check-in y el Month solo se ve una 🔔 pequeña sin color junto al título, como el ↻. |
| Q199 | Slots ya empezados | ✅ No muestran la campanita. |
| Q200 | Slots pasados sin hacer | ✅ Su evento se queda en Google como pasado; no hay limpieza. |
| Q201 | No se arrastra | ✅ Cada Slot nuevo nace sin campanita, también el de una Secondary Task arrastrada que se vuelve a agendar. |
| Q202 | Si Google falla | ✅ El Slot se guarda igual en Ivan OS y la campanita muestra el error ("Reconnect Google Calendar"). Nunca debe parecer que va a avisar si no va a avisar. |

## Reminders — construido en local (2026-11-02)

- **Campanita en el Slot** (calendario del Day y la Week). Apagada se ve al pasar el mouse, o siempre tenue en pantalla táctil, hasta que el Slot empieza. Al tocarla queda en 10 min y abre el menú: Off, At start, 5, 10, 15, 30, 60 min before. En el Check-in (Secondary Tasks) y en el Month solo se ve una 🔔 sin color.
- **Google Calendar** se conecta aparte del login, con "Connect Google Calendar" desde la primera campanita. Pide solo el permiso `calendar.app.created`, que da acceso únicamente a los calendarios que crea la app y nunca a los demás de Ivan. Crea el calendario "Ivan OS" y, al volver, enciende la campanita que pidió la conexión. El refresh token se guarda cifrado (AES-256-GCM con una clave derivada de `AUTH_SECRET`). Se comprueba que la cuenta sea la de `ALLOWED_EMAIL`.
- **Sincronización de una vía.** Cada evento tiene un id fijo derivado del Slot, así que escribir dos veces no crea dos eventos, y un evento borrado a mano en Google se vuelve a escribir. Siguen al Slot:
  - moverlo o cambiar su duración en el calendario o arrastrarlo en el Month;
  - marcar o desmarcar hecho (también desde el modal de Upkeep y desde un Highlight);
  - renombrar la Task, el Move o el Upkeep;
  - borrar el Slot o lo que lo contiene.
  Los borrados en cascada los atrapa un trigger de Postgres que guarda el evento en `calendar_cleanups`, y se reintenta la próxima vez que Google responde.
- **Si Google falla**, el Slot se guarda igual y la campanita muestra "!" con "Try again" y "Reconnect Google Calendar". Una tarea hecha cuyo evento no se pudo borrar sigue mostrando "!", porque Google todavía avisaría. Si Google revoca el acceso, la conexión queda pendiente de reconectar.
- Migración `0010_reminders`, aplicada en local y en Neon (junto con la 0009).
- Pasos de Ivan en Google Cloud, en el proyecto del login:
  1. Activar la Google Calendar API.
  2. Añadir el permiso `.../auth/calendar.app.created` en la pantalla de consentimiento.
  3. Pasar la app a *In production*.
  4. Añadir los redirect URIs `http://localhost:3200/api/google-calendar/callback` y `https://<dominio de producción>/api/google-calendar/callback`.
- Verificación: 111 tests, typecheck, lint y prueba en el navegador. Se probó la campanita sin conexión (lleva a conectar), el callback con un `state` falso (se rechaza), un Slot ya empezado (sin campanita), al tocar → 10 ✓, cambiar a 30, Off, el error simulado ("!" en el calendario, el Check-in y el Month), hecho con un evento sin borrar ("!" se queda), el borrado (el trigger encola el evento), teléfono táctil y Week. Ivan hizo la configuración en Google Cloud y confirmó que la conexión real funciona en local. La base local quedó sin filas de prueba.

## Ronda 27 — Description y Links en las Tasks (2026-11-02)

Origen: Ivan agregó a la Campaign de SSO una Task para aprender las skills de IA de un profesional y quiso guardarle contexto y enlaces al curso. Quiere hacerlo de forma minimalista: nada vacío por defecto, todo desde un `+`.

| # | Decisión | Estado |
|---|---|---|
| Q203 | El texto | ✅ **Description**: un Long text opcional (Markdown, Dictation y English Coach). "Description" sigue en _Evitar_ solo para la Expansion de un Principle. |
| Q204 | Los enlaces | ✅ **Link**: una URL con título opcional; puede haber varios. _Evitar_: Resource, Reference. |
| Q205 | Quién los lleva | ✅ Tasks (también las sueltas) y Moves. Las Secondary Tasks no. |
| Q206 | El `+` de la Task | ✅ Abre un menú: Step · Description · Link. La Description sale del menú cuando ya existe. |
| Q207 | Dónde se ven | ✅ La Description en un panel lateral (drawer) con vista previa y edición, abierto con un ícono ≡ junto al título. Los Links, una línea cada uno debajo de los Steps; se abren en otra pestaña. |
| Q208 | Título del Link | ✅ Opcional; sin título se muestra el dominio y la ruta. La app no visita la página. Un Link se edita, se borra y se reordena. |
| Q209 | Pantalla de foco | ✅ Un Cycle sobre la Task muestra sus Links y su Description plegada. El calendario y el Stack solo muestran un ícono. |
| Q210 | Links aparte | ✅ Son una lista aparte de la Description, para pegar rápido desde el iPhone y abrir con un toque. La Description también acepta enlaces en Markdown. |

## Ronda 28 — Dónde viven en el plan (2026-11-02)

| # | Decisión | Estado |
|---|---|---|
| Q211 | El Move | ✅ Un `+` en su cabecera, junto a ✎ y ×, con Description · Link. El `+` de la sección Tasks sigue siendo solo para Tasks. Sus Links van debajo de la fila de la semana. |
| Q212 | Tasks sueltas | ✅ Usan la misma tarjeta que las Tasks de un Move (renombrar, Steps, `+`) y conservan sus Infinite Games. |

## Description y Links — construido en local (2026-11-02)

- **El `+` de la Task** abre Step · Description · Link; Description sale del menú cuando ya existe. **El Move** tiene su `+` en la cabecera (Description · Link) y sus Links debajo de la fila de la semana. **Las Tasks sueltas** del Backlog usan la misma tarjeta (renombrar, Steps, `+`) y muestran sus Infinite Games.
- **Description**: el ícono ≡ junto al título abre el panel lateral con vista previa y edición (Markdown, Dictation y English Coach). Una nueva abre directo en edición; guardarla vacía la quita.
- **Links**: una línea cada uno, abierta en otra pestaña. Se pega la dirección (sin `https://` también vale) y un título opcional; sin título se muestra el dominio y la ruta. Solo se aceptan páginas web (`http`/`https`), y la base de datos lo exige también. Cada Link se edita (✎), sube (↑) o se borra (×); en pantalla táctil esos botones siempre se ven.
- **Pantalla de foco**: un Cycle sobre la Task o el Move muestra sus Links y la Description plegada. **Calendario y Stack**: solo un ≡ pequeño junto al título.
- Migración `0011_task_details` (columna `description` en `tasks` y `moves`, tabla `links`), aplicada en local. **Falta aplicarla en Neon.**
- Verificación: 114 tests, typecheck, lint y prueba en el navegador (Link sin esquema, `javascript:` rechazado, título, reordenar, editar, Description con Markdown, ≡ en el calendario y el Stack, pantalla de foco, Task suelta con Step, teléfono). La base local quedó sin filas de prueba.

## Ronda 29 — Las Campaigns del Check-in, solo títulos (2026-11-04)

Origen: en el Check-in cada Campaign mostraba título y Goal. Los Goals de producción son frases completas e Ivan quiere ver por defecto solo los títulos.

| # | Decisión | Estado |
|---|---|---|
| Q213 | Cómo se ven los Goals | ✅ Un solo toggle para toda la lista: la etiqueta "Q4 2026 Campaigns" muestra u oculta todos los Goals. |
| Q214 | Los títulos bastan | ✅ Los títulos cargan la mirada de la mañana. No hay regla nueva sobre cómo se escriben. |
| Q215 | Alcance | ✅ Solo cambia la lista de Campaigns del Check-in. Las Season Goals y las tarjetas del Plan se quedan igual. |
| Q216 | Rebanada 3 | ✅ Ivan quiere ver las Campaigns con sus Goals en la Weekly Review, plegables hacia el lado, y pide construir la rebanada. |
| Q217 | El toggle | ✅ La etiqueta con una flecha, como Principles. Los títulos siempre se ven; la flecha solo muestra u oculta los Goals. |
| Q218 | Recuerda la última elección | ✅ Cada navegador recuerda si los dejó abiertos, como en Q168. |
| Q219 | Goal abierto | ✅ En su propia línea debajo del título. Una Campaign sin Goal muestra solo el título. |

## Ronda 30 — Rebanada 3: alcance y Learning Log (2026-11-04)

| # | Decisión | Estado |
|---|---|---|
| Q220 | Alcance y orden | ✅ Toda la rebanada 3, en este orden: toggle del Check-in, Learning Log, Weekly Review, Journal. El XP sigue en la rebanada 4 y el cálculo de Alignment en la 5. |
| Q221 | Dónde vive la Review | 🔁 No es una pantalla aparte: vive en la Week, para ver el tiempo gastado y los datos reales. Revisado en Q224. |
| Q222 | Qué semana planea | ✅ Una Review por semana. El domingo 8 de noviembre o el lunes 9 mira la semana del 2 y planea la del 9. Después del lunes queda saltada, sin deuda. Ivan quiere ver el historial para sacar estadísticas algún día. |
| Q223 | Learning Log | ✅ Una lista rápida en el Day: una línea por entrada, con día y hora, sin etiquetas, y se puede editar o borrar. Ivan la ajustará si no le gusta. |

## Ronda 31 — La Weekly Review en la Week (2026-11-04)

| # | Decisión | Estado |
|---|---|---|
| Q224 | Panel, no drawer | ✅ Un panel a la izquierda de la Week que empuja el calendario y se pliega hacia el lado. Los drawers de la derecha taparían el Stack y bloquearían el arrastre. En el teléfono llena la pantalla. El Stack conserva su ancho. |
| Q225 | Dos pasos | ✅ Look back con el calendario de la semana que cierra; "Next" lleva el calendario y el Stack a la semana que viene para elegir Moves, con el panel abierto. |
| Q226 | Lo que guarda | ✅ Una copia de los Moves elegidos con sus títulos, el puntaje sentido del 1 al 10 y notas opcionales (Long text). El puntaje se recoge desde ahora porque el sentir de una semana no se recupera. |
| Q227 | Look back | ✅ Solo el Learning Log de la semana y sus Moves, hechos o no. El calendario ya muestra el tiempo. |
| Q228 | Cómo se abre | ✅ Un botón en la cabecera de la Week y, domingo y lunes mientras esté pendiente, un enlace arriba en el Day. Sin notificaciones. |

## Ronda 32 — Historial de Reviews y Journal (2026-11-04)

| # | Decisión | Estado |
|---|---|---|
| Q229 | Historial | ✅ Un plegable "All Reviews" en el panel: semana, puntaje y Moves hechos. Las saltadas van en gris. Al abrir una, el calendario salta a su semana. |
| Q230 | Editar una terminada | ✅ El puntaje y las notas se pueden corregir; los Moves guardados no. Una Review no se reabre entera. |
| Q231 | Para terminar | ✅ Solo el puntaje es obligatorio. Se puede terminar sin notas y sin Moves. |
| Q232 | Journal sin plantilla | ✅ Un solo Long text en blanco por día. Revisa Q23: la sección nocturna de la plantilla quedó vacía en las últimas 14 notas diarias (13–31 de octubre), mientras Ivan seguía escribiendo reflexiones libres en `journal/reflections/`. |
| Q233 | Dónde vive | ✅ Una tarjeta en el Day que abre un drawer a la derecha, con flechas entre días con Journal. Los días pasados se pueden escribir. |

Detalles que Ivan aceptó al confirmar el plan: de martes a sábado el panel solo lee el historial; las saltadas se muestran desde la primera Review terminada; se eligen Moves de Campaigns activas del Quarter del lunes que se planea; los Moves sin terminar siguen en la lista de su Campaign; un Move borrado conserva su título en la Review y cuenta como no hecho; cada navegador recuerda si el panel quedó plegado.

## Rebanada 3 — construida en local (2026-11-04)

- **Check-in:** los títulos de las Campaigns siempre se ven; la etiqueta con su flecha muestra u oculta los Goals, cada uno en su línea. Cada navegador recuerda la elección.
- **Learning Log:** una tarjeta en el Day con el `+` de siempre. Cada entrada lleva su hora y se edita (✎) o se borra (×).
- **Weekly Review:** un panel a la izquierda de la Week. Un botón en la cabecera la abre siempre; domingo y lunes, mientras esté pendiente, también hay un enlace en el Day.
  - **Look back** (`?review=look`) sobre la semana que cierra; **Next** lleva a **Choose Moves** (`?review=choose`) sobre la que planea. Un paso que ya no aplica cae en lectura (`?review=read`).
  - **Finish Review** exige solo el puntaje. El puntaje y las notas se guardan como borrador en el navegador hasta terminar, así que volver un paso no los pierde.
  - **All Reviews**: semana, puntaje y Moves hechos; las saltadas en gris desde la primera Review terminada.
- **Journal:** una tarjeta en el Day con su primera línea; el drawer a la derecha tiene flechas entre días con Journal.
- **`DrawerFrame`:** Next conserva oculta la ruta que deja, con sus efectos limpiados. Un `<dialog>` modal abierto ahí congelaba la página visible, así que ahora se suelta al ocultarse y se reabre al volver.
- Migración `0012_slice_3_notes_and_reviews` (`daily_notes.journal`, `learning_entries`, `weekly_reviews`, `review_moves`), aplicada en local. **Falta aplicarla en Neon, antes de desplegar:** el Day lee `daily_notes.journal`.
- Limitación de la primera Review: como ninguna Review anterior guardó los Moves de esa semana, un Move que se vuelve a elegir para la semana siguiente sale de "Moves of this week". Desde la segunda Review la copia guardada lo conserva.
- Verificación: 132 tests, typecheck, lint, `next build` y prueba en el navegador con el reloj del servidor movido a domingo, lunes y martes. Se probó el toggle y su recuerdo, agregar, editar y borrar entradas, el panel plegado (devuelve 300 px al calendario) y recordado, elegir un Move y verlo en el Stack, el borrador al volver un paso, terminar, corregir puntaje y notas, Moves congelados con un Move borrado, semanas saltadas, arrastrar del Stack al calendario con el panel abierto, las flechas del Journal con cambios sin guardar, el teléfono y la consola sin errores. La base local quedó sin filas de prueba.

## Ronda 33 — El Feed terminado sigue terminado (2026-11-04)

Origen: Ivan quiere que, si ya vio el Feed del día, `/feed` muestre "Done for today" y le deje verlo de nuevo, porque esas References le pegan fuerte y quiere practicarlas para memorizarlas. En el código, "Done" dependía de la posición guardada: Watch again la devolvía a la primera, y salir en la última Reference la dejaba antes del final. En los dos casos `/feed` mostraba "10 of 10 seen" con Continue.

| # | Decisión | Estado |
|---|---|---|
| Q234 | Qué es terminar | ✅ Llegar a la última Reference termina el Feed del día; no hace falta pasar a la pantalla final. |
| Q235 | Dura todo el día | ✅ Una vez terminado, `/feed` muestra Done hasta mañana, sin importar cuántas veces vuelva a verlo o lo deje a medias. Nunca Continue. |
| Q236 | Dónde arranca Watch again | ✅ Siempre desde la primera Reference, en el orden de hoy. No recuerda dónde quedó la vez anterior. |
| Q237 | Volver a ver no deja registro | ✅ Sin contador, XP ni Streak. Los Likes siguen igual, hasta 5 por Reference al día. |
| Q238 | Qué se puede practicar | ✅ Las 10 de hoy y además el Top 10, que gana un botón Watch y se ve en el mismo reproductor. Una marca "to memorize" queda para después, si hace falta. |
| Q239 | La pantalla final | ✅ No cambia: "Done for today" con Watch again y See your Top 10. |

## Ronda 34 — Ver el Top 10 (2026-11-04)

| # | Decisión | Estado |
|---|---|---|
| Q240 | Dónde aparece | ✅ Solo en la pantalla Done. Primero va la ronda de hoy. |
| Q241 | Cómo arranca | ✅ Watch arranca en el #1; tocar una fila arranca en esa Reference y sigue hacia abajo. |
| Q242 | Orden | ✅ De más a menos Likes, fijo mientras se ve. La lista se actualiza al volver. |
| Q243 | Likes | ✅ Los mismos del Feed, con el mismo límite de 5 por Reference al día, compartido con la ronda de hoy. Practicar y dar Likes sube una Reference en el Top 10. |
| Q244 | Pantalla final | ✅ "That was your Top 10" con Watch again y Back; Back vuelve a Done. |
| Q245 | Separado del Feed | ✅ Ver el Top 10 no cambia el avance ni el Done de hoy. Solo se guardan los Likes. |

## Feed terminado y Top 10 — construido en local (2026-11-04)

- **Done:** ahora sale de cuántas References se han visto, no de la posición guardada. Volver a ver no guarda nada, así que no puede deshacerlo. No hay migración: el dato ya existía, y el Feed de un día que ya llegó a la última Reference pasa a Done al desplegar.
- **Top 10:** botón Watch y filas que se tocan, en el mismo reproductor. El botón no aparece sin Likes.
- La vista del Feed ahora trae los Likes de todas las References con Likes, no solo los de las de hoy, para que el Top 10 respete el límite diario.
- Verificación: 133 tests, typecheck, lint, `next build` y prueba en el navegador con References de prueba. Se probó salir en la última Reference, recargar, dejar a medias un Watch again, ir y volver por la navegación, arrancar el Top 10 desde una fila, el tope de 5 Likes, el orden fijo y la lista actualizada al volver, el límite compartido con el Feed, el avance intacto en la base, Continue cuando no está terminado, el Top 10 vacío, el teléfono y la consola sin errores. La base local quedó sin filas de prueba.

## Ronda 35 — De total a Like Average (2026-11-06)

| # | Decisión | Estado |
|---|---|---|
| Q246 | Qué días cuentan | ✅ Cada día que una Reference llegó a mí en el Feed, aunque no le diera Likes (vale 0), y cada día que le di Likes. Ver el Top 10 sin dar Likes no deja registro (Q245). |
| Q247 | Hoy | ✅ El promedio solo cubre días terminados. Revisa Q243: dar Likes ya no sube una Reference al momento, y unos Likes bajos pueden bajarla al día siguiente. |
| Q248 | Orden | ✅ Promedio simple, sin mínimo de días, para el Top 10 y la última del Feed. Empates: más días contados, luego al azar. El Top 10 desempata por id para no cambiar durante el día. |
| Q250 | El total | ✅ Sale de la pantalla. Se guardan las filas diarias, así que puede volver. |
| Q251 | "Categorizar" | ✅ La escala más fina basta: sin niveles con nombre ni filtros. |
| Q252 | El corazón | ✅ Tres filas de 5 puntos, con el promedio arriba a un decimal. Un toque sigue siendo un Like. |

## Ronda 36 — Empezar de cero (2026-11-06)

Datos reales de Neon: 59 puntajes diarios en 6 días, 36 de ellos en el tope de 5 (61%), en 40 de 119 References.

| # | Decisión | Estado |
|---|---|---|
| Q249 | Likes viejos | ✅ Se borran. Multiplicar por 3 era mi primera recomendación, pero habría llenado el Top 10 de empates en 15.0. |
| Q255 | Puntos vacíos | ✅ Solo se ven los Likes dados: los puntos vacíos pedían llenarse. |
| Q256 | Qué significa 15 | ✅ Raro a propósito. La reacción crece rápido: 5 ya es bueno, 10 es "hell yeah", 15 es "dude, WTF, stop and reassess how you think". Vive en el glosario, no en la pantalla. |

## Ronda 37 — Cierre (2026-11-06)

| # | Decisión | Estado |
|---|---|---|
| Q253 | Qué se borra | ✅ Todos los Likes y todos los días del Feed, incluido el de hoy, sin copia. Si los días del Feed quedaran, contarían como ceros. Las References subidas no se tocan. El Feed se redibuja una vez el día que salga. |
| Q254 | Sin número o 0.0 | ✅ Sin número hasta tener un día terminado; después el promedio real, incluido `0.0`. El Top 10 solo lleva References por encima de 0. |
| Q257 | Promedio de una escala exponencial | ✅ Promedio simple. Se puede cambiar después porque se guardan los puntajes diarios. |

## Like Average — construido en local (2026-11-06)

- **Regla:** `likeAverages` y `topReferences` en `src/domain/feed.ts`. Si menos de 10 References tienen promedio, la última del Feed completa su grupo con otras al azar, como antes.
- **Migración 0013:** borra `reference_likes` y `feeds` y sube el tope a 15. Aplicada en Neon el 2026-11-06, antes del push: borró 62 Likes y 6 días del Feed; las 119 References quedaron.
- **Top 10 vacío:** el mensaje dice que las References entran al día siguiente, porque el día de hoy no cuenta.
- Verificación: 142 tests, typecheck, lint, `next build` y prueba en el navegador con imágenes de prueba a ancho de teléfono: `0.0`, sin número, `5.0` con días en cero, `15.0`, 17 toques guardan 15, el corazón no se mueve al llenarse los puntos, quitar un Like al mantener, el orden del Top 10, una Reference con Likes de hoy fuera del Top 10, y el Feed y el Top 10 tras borrar todo. Un cambio de día real solo está cubierto por tests. Video y audio reales no se probaron. La base local quedó sin filas de prueba.

## Ronda 38 — Hasta 30 Likes (2026-11-06)

| # | Decisión | Estado |
|---|---|---|
| Q258 | Qué significa 30 | ✅ Revisa el tope de Q256. 5, 10 y 15 no cambian; 30 es aún más raro que 15: la Reference que me hace cambiar algo en mi vida, no solo repensarlo. Los Likes ya dados siguen valiendo. |
| Q259 | Imágenes | ✅ Cada Like reinicia los 6 segundos de una imagen, que sigue 6 segundos después del último. Video y audio no cambian. |
| Q260 | Puntos | ✅ Seis filas de 5. Revisa Q252. El corazón queda unos 24 px más arriba en todas las References. |

- **Migración 0014:** sube el tope a 30 y no borra nada.
- Verificación: 142 tests, typecheck, lint, `next build` y prueba en el navegador con imágenes de prueba a ancho de teléfono: 32 toques en 8 segundos guardan 30, la imagen se queda mientras llegan Likes y sigue unos 6 segundos después, y el corazón no se mueve. Video y audio reales no se probaron. La base local quedó sin filas de prueba.

## Ronda 39 — Reordenar Tasks y Steps (2026-11-06)

Origen: Ivan quiere reordenar las Tasks y los Steps como reordena la prioridad de las Campaigns. Revisa Q158 ("Las Tasks mantienen su orden, sin arrastre").

| # | Decisión | Estado |
|---|---|---|
| Q261 | Tasks de un Move | ✅ Las abiertas llevan ⠿ y número de prioridad, como las Campaigns y los Moves. El Stack y el Check-in siguen ese orden. |
| Q262 | Steps | ✅ Llevan ⠿ sin número: su orden es una secuencia, no una prioridad. La pantalla de Focus sigue ese orden. |
| Q263 | Lo hecho | ✅ Las Tasks hechas bajan, sin ⠿, y al desmarcarlas vuelven a su lugar. Los Steps hechos se quedan en su lugar y se pueden arrastrar. |
| Q264 | Tasks sueltas | ✅ Tienen la misma prioridad en el Backlog, como una sola lista para todos los Infinite Games, y la sección Loose Tasks del Stack la sigue. |
| Q265 | Límites | ✅ Solo se arrastra dentro de la misma lista: una Task no pasa a otro Move ni un Step a otra Task. Las Secondary Tasks siguen sin prioridad manual (Q66). |

- **Código:** `TaskList` usa `PriorityList` y `ClosedList`; `OrderedList` es la lista sin número de los Steps. Las acciones nuevas son `reorderTasks` y `reorderSteps`. `createTask` ahora pone la Task nueva de última; antes todas nacían en la posición 0.
- **Stack:** antes mostraba las Tasks de un Move sin orden fijo. Ahora van por prioridad, con las hechas de últimas, igual que en el Plan.
- **Bug corregido:** las Tasks sueltas hechas salían encima de las abiertas.
- Sin migraciones: `tasks.position` y `steps.position` ya existían, y el orden actual se conserva.
- Verificación: 142 tests, typecheck, lint, `next build` y prueba en el navegador con mouse, teclado y toques reales a ancho de teléfono. Se probaron arrastrar una Task por encima de otra con Steps, arrastrar un Step sin mover su Task, recargar, una Task nueva de última, marcar y desmarcar, las Tasks sueltas y el orden del Stack. La base local quedó sin filas de prueba.

## Ronda 53 — Entrevistas a stakeholders (2026-11-09)

Origen: Ivan va a avanzar el módulo gestor de cartera en El Alcaraván y quiere recoger las necesidades de varios stakeholders (su jefe, Mauricio el líder de cartera, los ejecutivos) con una IA que los entrevista al estilo grilling, sabiendo ya el contexto del proyecto que Ivan le da. Le sirve para muchos casos, no solo este.

| # | Decisión | Estado |
|---|---|---|
| Q1 | Dónde vive | ✅ Dentro de Ivan OS, porque es parte de su flujo de trabajo. Es la primera vez que entra alguien que no es Ivan. |
| Q2 | Permiso de la empresa | ✅ Ivan ya lo confirmó: en El Alcaraván todos usan Anthropic. Ningún dato de clientes (nombres, documentos, saldos) entra al contexto ni a las respuestas. |
| Q3 | Quién pregunta | ✅ Solo Ivan. Los stakeholders entran con un código OTP que llega a su correo. |
| Q4 | Qué sale | ✅ (Revisado por Q30: Insights por Interview, sin mapa curado.) Las necesidades importan más que las propuestas de qué haga la app. Nadie explica qué es la UIF ni qué es Microfinanzas El Alcaraván: eso ya está en el contexto. |
| Q5 | El contexto oculto | ✅ Oculto solo en la UX: el stakeholder entra y empieza a hablar. La IA abre diciendo lo que entiende ("estamos haciendo X, Y, Z; Ivan quiere entender tus necesidades y propuestas"). Las opiniones sobre otras personas no entran. |
| Q6 | Qué se le dice al stakeholder | ✅ Que habla con una IA cuyo trabajo es entender sus necesidades, ideas y propuestas para construir un producto pensado para todos; que Ivan lee sus respuestas con su nombre; que los demás no las ven. |
| Q7 | Idioma y stack | ✅ El lado del stakeholder en español. Next.js y TypeScript dentro de Ivan OS, sin Python ni Cloud Run. |
| Q8 | Cómo se siente | ✅ Un chat, primero en el teléfono, con voz y con botones para no escribir "Q1 estoy de acuerdo". Cada ronda se ve como un stepper, para saber dónde va la conversación. |
| Q9 | Nombres | ✅ Discovery, Brief, Theme, Stakeholder (con su nota de rol), Interview, Need, Proposal y Needs Map. "Topic" sigue siendo solo de la Library. |
| Q10 | Stakeholder y Person | ✅ Separados: un Stakeholder no es una Person ni toca el Radar. |
| Q11 | Cómo entran | ✅ Un enlace por Discovery que Ivan comparte él mismo; el Stakeholder escribe su correo y, si está invitado, le llega un código de 6 dígitos. El código sale del dominio de Ivan (Namecheap) por un servicio de correo. |
| Q12 | Aislamiento | ✅ El Stakeholder tiene su propia sesión, que solo abre sus Interviews y nunca llega a /os. |
| Q13 | Qué Themes ve cada uno | ✅ Ivan elige qué Themes ve y responde cada Stakeholder. El Stakeholder puede responder solo algunos, y está bien. |
| Q14 | Necesidades y visión | ✅ Dos etapas: primero sus necesidades; después, el producto que imaginan. Ivan elige a quién le pide cada una. No hay aprobación de por medio: Ivan solo quiere sus inputs (Q20). |
| Q15 | Largo | ✅ Unas 3 rondas por Theme, con stepper. Al final la IA pregunta si quiere agregar algo más. Se puede parar y volver; lo que quede a medias cuenta. |
| Q16 | Mensaje de apertura | ✅ La IA propone un borrador e Ivan lo edita; es el mismo para todos. Lleva texto e imágenes (los diagramas de Ivan). |
| Q17 | Brief | ✅ Un Markdown pegado: el proyecto, cómo está construido, la visión de Ivan y la empresa (dónde está, sus metas). |
| Q18 | Uso del Needs Map | ✅ Se copia como Markdown, con citas literales, para alimentar el grilling o un skill de diseño de producto en el repo del trabajo (Q30). |
| Q19 | Dónde vive en la navegación | ✅ Una opción más del Profile: Discoveries. |
| Q20 | Etapas en orden | ❌ No hay una etapa de visión después de que Ivan apruebe las necesidades. Ivan solo quiere inputs e insights de calidad, que luego usa con un skill de diseño de producto; si necesita aprobación, hace una reunión. |
| Q21 | Sugerencias | ✅ En necesidades, opciones y preguntas sobre experiencias reales; en visión, la IA sugiere ideas del Brief, incluso lo que el Stakeholder no había considerado. Se ve de dónde salió cada cosa. |
| Q22 | Una ronda en el teléfono | ✅ La IA manda 2 a 4 preguntas; se ven de a una tarjeta con stepper ("Ronda 2 · pregunta 1 de 3"), con opciones, "Otra cosa", texto y 🎤. La ronda se manda completa. Hay una barra de "hasta ahora entendí". |
| Q23 | Voz | ✅ Dictation en español: el texto cae en el campo y se corrige antes de mandarlo. El audio no se guarda. Mientras habla ve barras que se mueven con su voz y un aviso si no se le oye; en computador, además, un borrador en vivo dentro del campo (reconocimiento del navegador: Chrome manda ese audio a Google). Al tocar Detener ese borrador **se queda tal cual** en el campo, con el cursor al final, para corregir la redacción; no se reemplaza ni se espera. Sin borrador (teléfono, Firefox) se transcribe la grabación. En el teléfono no hay borrador en vivo: el reconocimiento y la grabación se pelean el micrófono. Mientras graba el campo no se edita; "Enviar" no exige revisar. (2026-11-10) |
| Q24 | Imágenes de la apertura | ✅ La IA también las ve, e Ivan le pone a cada una su descripción. El Brief sigue siendo solo texto. |
| Q25 | Lo que ve Ivan | ✅ Una cuadrícula Stakeholder × Theme con el estado de cada Interview y su conversación. Sin notificaciones. |
| Q26 | Atribución | ✅ Ivan quiere ver "esto dijo Diana, esto dijo Mauricio" y decidir él cómo usa cada cosa. |
| Q27 | Después de responder | ✅ El Stakeholder ve su conversación, puede agregar más y subir archivos (PDFs y, desde Q53, fotos). No edita lo que ya mandó. |
| Q28 | Modelo e idioma | ✅ Claude Opus 5.5 para las Interviews. Ivan elige el idioma al crear la Discovery. |
| Q29 | Borrar | ✅ Borrar una Discovery borra todo y siempre pide confirmación. Quitar un Stakeholder le corta el acceso y conserva lo que dijo, salvo que Ivan borre sus Interviews. |
| Q30 | Insights en vez de Needs Map | ✅ Después de cada Interview la IA escribe sus Insights: las Needs y Proposals que oyó, con citas literales y de dónde salió cada una (sus palabras, eligió una opción, reaccionó a una idea de la IA). Se ven por Theme y persona por persona. No hay síntesis entre personas ni curaduría: Ivan decide. Copy as Markdown exporta todo atribuido. Revisa Q4 y Q18. |
| Q31 | Needs y Vision por Stakeholder | ✅ Al invitarlo, Ivan marca Needs, Vision o ambas. Dentro de cada Interview van primero las rondas de Needs y luego las de Vision. Una Proposal es del Theme y puede responder a una Need. "Todo input que me den vale." |
| Q32 | PDFs y datos de clientes | ✅ Antes de subir: "No subas datos personales, solo información con el contexto relacionado." La IA revisa cada PDF y, si trae datos personales de clientes, lo rechaza, lo borra y explica por qué. Máximo 10 MB y 30 páginas. |
| Q33 | Para qué sirve un PDF | ✅ Es parte de la Interview: la IA lo lee y pregunta por él, sale en los Insights como fuente e Ivan lo abre y lo descarga. |
| Q34 | Idioma | ✅ Uno por Discovery, español por defecto; en inglés todo cambia (botones, preguntas, apertura), p. ej. para un cliente de EE. UU. El lado de Ivan sigue en inglés. |
| Q35 | Remitente del código | ✅ `Ivan Díaz <codigo@ivanandresdiaz.com>`, asunto "Tu código para <Discovery>: 482913", 10 minutos, 5 intentos. |
| Q36 | Ciclo de vida | ✅ Draft (enlace apagado) → Open → Closed ("Esta Discovery ya cerró. Gracias por tu tiempo."), y se puede reabrir. Cerrada, el Stakeholder tampoco ve su conversación, y por defecto se cierran las sesiones de todos (Q40). |
| Q37 | Opening y leyendas | ✅ La primera pantalla se llama Opening. La descripción de cada diagrama es su leyenda para el Stakeholder y su explicación para la IA. |
| Q38 | Qué escribe Ivan por Theme | ✅ Título y una línea de descripción, visibles; "What I want to learn", oculto, solo para la IA. |
| Q39 | Inicio del Stakeholder | ✅ El Opening la primera vez (después, un enlace para volver a verlo) y sus Themes como tarjetas con estado, en el orden que quiera. |
| Q40 | Sesión | ✅ 30 días por dispositivo, con cerrar sesión. Al cerrar la Discovery, Ivan cierra las sesiones de todos por defecto. |
| Q41 | Colegas | ✅ Si un Stakeholder se queja de alguien, la IA lleva la conversación al proceso y los Insights no llevan nombres de terceros. La conversación literal queda como fue. |
| Q42 | Cuándo se actualizan los Insights | ✅ Después de cada ronda, también en las Interviews de prueba. |
| Q43 | Probar antes de abrir | ✅ En Draft, Ivan entra como Stakeholder de prueba (cualquier nota de rol y Themes) y vive la experiencia real. Las Interviews de prueba se borran al abrir la Discovery. |
| Q44 | Cómo se ve | ✅ Una apariencia propia, limpia, clara y primero en el teléfono, con el nombre de Ivan ("Ivan Díaz te invita a…"), sin la marca ni la navegación de Ivan OS. |
| Q45 | Copy as Markdown | ✅ Título de la Discovery; por Theme y por Stakeholder (nombre y rol), sus Insights con citas y de dónde salió cada una; la lista de PDFs. Sin el Brief. Casilla opcional "Include full conversations". |

## Ronda 54 — El método de entrevista (2026-11-09)

Origen: Ivan le pidió a Claude Fable (xhigh) una opinión sobre cómo debe entrevistar la IA. Su respuesta quedó en [docs/discovery-interview-method.md](docs/discovery-interview-method.md). Idea central: una opción también es una sugerencia; lo que importa es quién lo dijo primero.

| # | Decisión | Estado |
|---|---|---|
| Q46 | Quién lee | ✅ El Opening dice: solo Ivan lee las respuestas con nombre; ni el jefe ni los compañeros las ven; si Ivan comparte algo, es en una presentación y sin nombres. Ivan no planea compartir nada más. |
| Q47 | Método | ✅ El de Fable. Needs en 3 rondas: anclar (un dato fácil y "cuéntame la última vez"), profundizar en esa historia y dimensionar (sus propios puntos y al final un checklist con las hipótesis que no mencionó). Vision en 2 rondas: hablan primero; luego 2 o 3 ideas, cada una con su precio, y eligen una y dicen por qué. Nunca "Ivan está pensando en…". Lo implacable es profundizar en una historia real. Revisa Q15 y Q21. |
| Q48 | Tipos de tarjeta | ✅ Abierta (sin botones), una opción o varias (solo el checklist). Las opciones se barajan, llevan "Otra cosa" y "Ninguna" cuando aplica, y su origen (escala neutra, sus palabras, la IA). Se mide cuántos segundos tomó cada tarjeta. Revisa Q22. |
| Q49 | Insights | ✅ Los escribe una llamada aparte del entrevistador: sin cita no hay Insight, un toque no se vuelve frase, lo inferido se marca, y el código verifica que cada cita esté en la conversación. Campos de Fable y una fuerza: Strong, Medium o Weak. Copy as Markdown la lleva y dice que lo Weak son hipótesis, no votos. |
| Q50 | Cierre | ✅ "Hasta ahora entendí" y "¿Algo está mal o falta? ¿Hay algo más que quieras agregar?" en la misma pantalla. |
| Q51 | Plantillas | ✅ El Brief nace con los encabezados de Fable (con [known] / [assumed]) y "What I want to learn" con Decision / Learn / Hypotheses / Already known. |
| Q52 | Números en las historias | ✅ Lo que parezca un documento o un teléfono se enmascara antes de guardar, y se le avisa al Stakeholder que escribió datos de un cliente (también nombres). |
| Q53 | Archivos | ✅ PDFs y fotos (p. ej. una página del cuaderno), con advertencia de no subir datos personales y la misma revisión de la IA. Revisa Q27 y Q32. |
| Q54 | Punto de partida | ✅ El prompt y el formato de ronda de Fable son la v1. Antes de Mauricio, Ivan juega tres Stakeholders de prueba: uno cooperativo, uno que toca todo en 3 segundos y uno que se queja de un colega. Después, Mauricio solo, y luego los ejecutivos. |

## Ronda 55 — Qué sigue al terminar un Theme (2026-11-10)

Origen: al terminar una Interview, el Stakeholder solo veía "Agregar algo más" y se quedaba en un limbo, sin saber si había terminado ni qué hacer.

| # | Decisión | Estado |
|---|---|---|
| Q55 | Lo siguiente, primero | ✅ La tarjeta de "¡Gracias!" lleva los botones de qué sigue; "Agregar algo más" queda debajo como "¿Se te ocurrió algo más?". Revisa Q27. |
| Q56 | Siguiente tema | ✅ "Siguiente tema: X →" lleva al siguiente Theme no terminado en el orden de Ivan, dando la vuelta (los que van a medias cuentan), con "Te faltan N de M temas". Debajo, discreto, "Terminar por ahora y cerrar sesión". |
| Q57 | Último tema | ✅ "Terminaste todos los temas 🎉", con "Terminar y cerrar sesión" como botón principal y "Volver al menú". |
| Q58 | En el menú | ✅ Con todos los Themes terminados, el menú muestra arriba "Terminaste todos los temas. Gracias, <nombre>." y el botón grande "Terminar y cerrar sesión". Mientras falten, solo el enlace pequeño "Cerrar sesión". |
| Q59 | Despedida | ✅ Al cerrar sesión, una despedida con su nombre ("Gracias por tu tiempo… Ya puedes cerrar esta pestaña") en vez del formulario de correo, con "¿Quieres volver? Entra con tu correo". Sin confirmación. |
| Q60 | Qué hace "Terminar" | ✅ Solo cierra la sesión: no avisa a Ivan ni guarda un estado nuevo (Q25). |
| Q61 | Stakeholder de prueba | ✅ El botón dice "Terminar la prueba" y vuelve al editor de la Discovery en Ivan OS. |

## Ronda 56 — La cara de Ivan e Ivan AI (2026-11-10)

Origen: Ivan quiere humanizar las Discoveries con su caricatura (con audífonos, "entrevistando"): que lo reconozcan de una, le dé confianza y novedad al Stakeholder, y un toque de juego para su marca personal. No toca Q44: es la cara de Ivan, no la marca de Ivan OS.

| # | Decisión | Estado |
|---|---|---|
| Q62 | Dónde | ✅ La caricatura con una nube de diálogo en el ingreso, en el menú de Themes y en la despedida. En el ingreso va grande, a todo el ancho, con la nube arriba, para que lo reconozcan de una; en el menú y la despedida, pequeña y con la nube al lado. Nunca dentro de la Interview: ahí no se quiere ruido. Revisa Q3 de la Ronda 55 (despedida). |
| Q63 | Honestidad | ✅ La nube del ingreso dice quién pregunta: "¡Hola! Soy Ivan. Quiero conocer y entender tus necesidades, perspectivas e ideas. Ivan AI, mi entrevistador, te hace las preguntas y yo leo todo." |
| Q64 | Ivan AI | ✅ El entrevistador se llama **Ivan AI**, "mi entrevistador" (no "agente": palabra trillada). En el lado del Stakeholder reemplaza a "la IA" en "Antes de empezar" y en el error; el lado de Ivan sigue diciendo "the AI". Dentro de la Interview no aparece su nombre. |
| Q65 | Nube del menú | ✅ Cambia con el avance: "¡Hola, <nombre>! Elige un tema…", "¡Vas muy bien, <nombre>! Te faltan N de M temas." y "¡Lo lograste, <nombre>! Gracias por tu tiempo." con "Terminar y cerrar sesión" debajo. Reemplaza el saludo "<nombre> 👋" y el aviso de Q58. |
| Q66 | Una sola imagen | ✅ Fija en la app, igual en todas las Discoveries; la nube en el idioma de la Discovery. Entra una vez con una animación suave, sin animación si el teléfono pide reducir movimiento. |

## Ronda 57 — Sensación de avance entre Themes (2026-11-10)

Origen: al terminar un Theme, la gente creía que había terminado toda la entrevista; se desconcentraba, se ponía a leer la conversación y le daba pereza seguir. Además, el contador de rondas volvía a empezar en Vision ("3 de 3" y luego "1 de 2") y daba miedo de un bucle infinito de preguntas.

| # | Decisión | Estado |
|---|---|---|
| Q67 | Palabras | ✅ Las pantallas hablan de **temas** ("Tema 1 de 4"); un Theme terminado nunca se presenta como el fin de la entrevista. Sin término nuevo en el glosario. |
| Q68 | Barra de avance | ✅ Una barra con un segmento por Theme: delgada mientras responde (con "Tema 1 de 4 · Ronda 4 de 5" y la etiqueta Needs/Vision), grande en la tarjeta de fin de Theme y en el menú, bajo la nube de Ivan. |
| Q69 | Qué la mueve | ✅ Cada ronda respondida y el cierre de cada etapa son un paso (Needs + Vision = 7); el segmento solo se llena cuando el Theme termina. Las rondas son fijas, así que el total es honesto. |
| Q70 | Rondas por Theme | ✅ Se cuentan en todo el Theme ("Ronda 4 de 5"), no por etapa. |
| Q71 | Fin de un Theme | ✅ En vez de "¡Gracias!" y ✓: "¡Tema 1 de 4 listo! 💪", la barra llenándose, Ivan pequeño ("¡Vas muy bien, Mauricio! Faltan 3.") y "Te faltan 3 temas. Vamos con el siguiente.". El último sigue con "Terminaste todos los temas 🎉". Revisa Q55–Q57. |
| Q72 | Sin trampas para leer | ✅ La conversación queda cerrada ("Ver la conversación") y, mientras falten Themes, "Agregar algo más a este tema" es un enlace. Revisa Q27. |
| Q73 | El botón del cierre | ✅ En la última etapa dice "Terminar y pasar al siguiente tema" y lleva directo al siguiente Theme, con la celebración arriba de "Empezar" (o sobre sus preguntas si iba a medias). En el último Theme dice "Terminar". La tarjeta de fin de Theme solo se ve al volver a un Theme terminado. Sin saltos automáticos. |


## Discoveries — construido en local (2026-11-09)

Rondas 53–54 construidas, sin commit. Migración 0024 aplicada en local; pendiente en Neon.

- **Ivan**: Profile → Discoveries. Lista y crear (título e idioma). La página de una Discovery tiene, en este orden: estado y enlace (Draft → Open → Close → Reopen, con lista de "listo para abrir"), Brief, Opening (Draft with AI y diagramas con su descripción), Themes (con "What I want to learn"), Stakeholders (invitar, editar, quitar acceso, borrar), Try it (solo en Draft), Progress (persona × Theme), Insights (Copy as Markdown, con o sin conversaciones) y Settings (título, idioma, borrar). Cada Interview tiene su página: Insights, archivos y la conversación completa.
- **Stakeholder**: `/d/<slug>`, con su propio aspecto claro (verde azulado). Correo, luego código; después el home (aviso de quién lee, Opening con diagramas, sus Themes) y el Interview en tarjetas.
- **Ajustes al construir**: una escala (cuántos, cada cuánto) no se baraja y conserva el orden de la IA, incluso su "Ninguna"; lo demás sí se baraja. Los Insights solo se guardan si salen de las últimas respuestas: las rondas tardan unos 20 s y los Insights más, así que dos reescrituras podían cruzarse. El aviso de números ocultos se va solo a los 12 s.
- **Probado en el navegador** (ancho de teléfono, contra el 3200): crear la Discovery, Brief, Opening con IA, diagrama a R2, invitar, Try it con 3 rondas reales de Needs (enmascaró un teléfono, aceptó una foto y la revisó con IA, "Ninguna" excluyente), cierre, terminado, "Agregar algo más", Insights (fuertes, con citas verificadas), Open (borra la prueba), código incorrecto y correcto, Close (cierra sesiones) y borrar (sin filas ni archivos en R2).
- **Sin probar en el navegador**: el paso de Needs a Vision, el dictado por voz de un Stakeholder, los PDFs, el correo real (sin RESEND_API_KEY el código va a la consola del servidor) y Copy as Markdown pegado (se copió, pero el navegador de prueba no deja leer el portapapeles).
- **Pendiente**: aplicar 0024 en Neon; RESEND_API_KEY en Vercel y los DNS de Resend en Namecheap (DKIM, MX/SPF de `send.`, DMARC). El "Esto fue lo que entendí" del cierre viene de antes de la última ronda, así que no incluye sus respuestas. El nombre de la app instalada sigue siendo "Ivan OS" (el manifest es de todo el sitio).

## Despliegue (2026-10-30)

Ivan desplegó en **Vercel** con **Postgres en Neon** (migraciones aplicadas allí) y login de **Google** (OAuth client en el proyecto de Firebase/Google Cloud; redirect `/api/auth/callback/google`). El código vive en GitHub (`ivanandresdiaz/ivanandresdiaz_os`). Variables en Vercel: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL`, `APP_TIMEZONE`.
