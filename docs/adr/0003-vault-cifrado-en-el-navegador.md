# Los Vaults se cifran y descifran solo en el navegador

Los Secrets se cifran en el navegador con una llave derivada de la Passphrase; el servidor y Neon solo guardan texto cifrado, y la Passphrase nunca sale del navegador. Así, lo que hay en los Vaults queda a salvo aunque alguien se siente frente al computador con la sesión abierta, aunque se filtre la base de datos o el deploy de Vercel, y también de Ivan OS mismo: ni el Context, ni el English Coach, ni los logs, ni una IA que lea la base de datos para depurar pueden leerlo. A cambio, nadie puede recuperar la Passphrase, y ninguna función del servidor puede tocar el texto de un Secret (buscar en él, por ejemplo).

## Considered Options

- **Cifrado en el servidor** (llave en una variable de entorno): permitiría recuperar el acceso y buscar en los Secrets, pero quien controle el servidor (una variable de entorno filtrada, un deploy comprometido, la propia app) puede leerlo todo. No protege de lo que más importa.
- **Un gestor de contraseñas externo** (Bitwarden, 1Password, KeePassXC): resuelve lo mismo y mejor para contraseñas de uso diario, pero Ivan quiere su almacenamiento frío dentro de Ivan OS. Los Vaults no compiten con ellos: no hay autocompletado ni extensión.

## Consequences

- Todos los Vaults comparten una sola Passphrase. Abrirlos una vez los abre todos y se cierran juntos; la llave solo vive en la memoria de la página, nunca en localStorage ni en una cookie.
- La Passphrase se estira (PBKDF2-SHA256, 600 000 rondas) en dos mitades: la llave AES-GCM y una prueba. El servidor guarda solo el hash de la prueba y la exige en todo cambio a los Vaults, así que una sesión abierta sin la Passphrase no puede borrar ni sobrescribir lo que no puede leer.
- Con Cache Components, Next.js no desmonta una página al salir de ella: la esconde con su estado (React Activity). Los Vaults reinician todo su estado al esconderse, para que salir de verdad los cierre.
- Cambiar la Passphrase vuelve a cifrar todos los Secrets en el navegador.
- Los nombres de los Vaults y los títulos de los Secrets no se cifran, para poder navegarlos con los Vaults cerrados. Son una pista de lo que hay, nunca su contenido.
- Los códigos que mantienen vivo a Ivan OS (Google, Vercel, Neon, GitHub) pueden quedar atrapados en un Vault al que no se llega si se pierde una de esas cuentas. Para eso existe el Backup: un archivo que se abre sin internet en cualquier navegador con la Passphrase.
