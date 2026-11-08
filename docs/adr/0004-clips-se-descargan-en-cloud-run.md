# Los Clips se descargan en Cloud Run Jobs que no tienen llaves

Ivan OS sigue en Vercel con Neon; lo único que corre aparte es la descarga de los Clips. Cada Clip que hay que bajar lanza un Cloud Run Job en el proyecto `andresdiaz` de Google Cloud, con yt-dlp y ffmpeg, que corre hasta terminar y no cuesta nada mientras no hay descargas. El Job no tiene llaves de Neon ni de R2: Ivan OS le entrega dos enlaces de subida de un solo uso, uno para el archivo y otro para el resultado, y lee ese resultado de R2 cada vez que se miran los Clips. Así, si el Job o su imagen se filtran, nadie puede leer ni tocar los datos de Ivan OS, e Ivan OS no expone ningún endpoint para que el Job le avise.

## Considered Options

- **Descargar dentro de Vercel**: yt-dlp y ffmpeg no caben bien en una función (tamaño del paquete, límites de tiempo), y un video largo no termina a tiempo.
- **Mover Ivan OS a Railway** y montar ahí microservicios: rehacer el despliegue, el login, los dominios y los cron sin ganar nada para la app. Un servicio aparte nace solo cuando un trabajo lo pide; este es el primero.
- **Un worker en el computador de Ivan**: su IP de casa es la que menos bloquean YouTube e Instagram, pero solo descarga mientras el computador está prendido, y el Clip debe bajarse solo, sin pensar en eso.
- **Cobalt** (descargador de código abierto con API, autoalojado): resuelve lo mismo, pero sigue en una IP de datacenter y es otro servicio que mantener vivo.
- **Que el Job avise a Ivan OS al terminar** (un endpoint con firma): sería inmediato, pero abre una puerta pública y no funciona en local. Leer el resultado de R2 al mirar los Clips basta, porque nadie espera mirando.

## Consequences

- Ivan OS lanza el Job con la llave de una cuenta de servicio que solo puede ejecutar ese Job. El Job corre con otra cuenta sin ningún rol.
- Las IP de Google Cloud son de datacenter. Probado el 2026-11-07: YouTube las bloquea ("confirm you're not a bot"), así que sus Clips quedan solo como enlace; Instagram descarga sin sesión, pero a ratos pide login, y por eso cada descarga se reintenta dos veces antes de darse por fallida.
- Si Instagram insiste, se le da la sesión de una cuenta desechable, nunca la principal; Instagram puede cerrarla o bloquearla, y renovarla es un paso manual descrito en `worker/clips/README.md`.
- Cada intento escribe con las llaves de su propia corrida, así que un Retry nunca lee el resultado de una corrida anterior.
