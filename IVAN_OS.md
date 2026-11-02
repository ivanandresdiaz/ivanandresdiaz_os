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
| Q120 | Recordatorio | ✅ Sin recordatorio por ahora. |
| Q121 | Google Calendar | ❌ No. Sin sincronización. |

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

## Despliegue (2026-10-30)

Ivan desplegó en **Vercel** con **Postgres en Neon** (migraciones aplicadas allí) y login de **Google** (OAuth client en el proyecto de Firebase/Google Cloud; redirect `/api/auth/callback/google`). El código vive en GitHub (`ivanandresdiaz/ivanandresdiaz_os`). Variables en Vercel: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL`, `APP_TIMEZONE`.
