FROM denoland/deno:latest

WORKDIR /app

# The server runs standalone in the image, so its member deno.json becomes the
# root config here; the workspace lockfile still pins its dependencies.
COPY deno.lock ./
COPY gjallarhorn-server/deno.json gjallarhorn-server/main.ts ./
COPY gjallarhorn-server/webpush-server/ ./webpush-server/

RUN deno cache main.ts

EXPOSE 1234

CMD ["run", "--allow-net", "--allow-read=/app", "main.ts"]
