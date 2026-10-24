import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 8080);
const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`Filfilu app http://127.0.0.1:${port}/login.html`);
  console.log(`Filfilu API http://127.0.0.1:${port}/api/health`);
});
