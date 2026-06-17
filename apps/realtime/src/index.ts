import { createServer } from "node:http";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3001;

function getPort() {
  const rawPort = process.env.REALTIME_PORT;
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(rawPort, 10);
  if (Number.isNaN(port)) {
    throw new Error("REALTIME_PORT must be a valid number.");
  }

  return port;
}

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  response.writeHead(200, { "content-type": "text/plain" });
  response.end("hibi realtime placeholder\n");
});

server.listen(getPort(), process.env.REALTIME_HOST ?? DEFAULT_HOST, () => {
  const address = server.address();
  if (typeof address === "object" && address) {
    console.log(`Realtime placeholder listening on ${address.address}:${address.port}`);
  }
});
