# Los Stakeholders entran a Ivan OS con una sesión aparte

Ivan OS es de un solo usuario, pero las Discoveries viven dentro de él porque son parte del flujo de trabajo de Ivan, aunque eso deje entrar por primera vez a otras personas (sus colegas de El Alcaraván). Para que nadie llegue nunca a su vida privada (Journals, Vaults, Radar), un Stakeholder entra con un código por correo a una sesión propia, distinta de la de Auth.js y Google, que solo abre sus Interviews bajo `/d/`; todo lo de `/os` sigue exigiendo `requireIvan()`. Son dos cerraduras: un error en una no abre la otra.

## Considered Options

- **Un producto aparte** (otro repo, otro deploy, otra base): aísla del todo la vida de Ivan, pero lo saca de su flujo de trabajo. Ivan lo rechazó (Ronda 53, Q1).
- **Un segundo usuario de Auth.js con roles**: reutiliza el login, pero una sola sesión con roles hace que un error de autorización abra `/os`.

## Consequences

- Los Stakeholders comparten la base de Neon con la vida de Ivan. El Brief no lleva datos de clientes, y la IA rechaza los PDFs que los traen.
- Al cerrar una Discovery se cierran por defecto las sesiones de sus Stakeholders.
- Desde la Ronda 58 hay una segunda forma de entrar a esa misma sesión: un Handoff code que Ivan crea y entrega él mismo, sin correo. Las dos cerraduras siguen igual.
